const express = require('express');
const { body, validationResult } = require('express-validator');
const MissingReport = require('../models/MissingReport');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { authenticate, authorize, authenticateAdminOrUser } = require('../middleware/auth');
const admin = require('../utils/firebaseAdmin');

const router = express.Router();

// ============================================================
// DEBUG: Test FCM directly — GET /api/missing/system/test-fcm?userId=xxx&secret=xxx
// ============================================================
router.get('/system/test-fcm', async (req, res) => {
  const { userId, secret } = req.query;
  const expectedSecret = process.env.SYSTEM_SECRET || 'nakshatra_system_2024';
  if (secret !== expectedSecret) return res.status(403).json({ success: false, message: 'Unauthorized' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.fcmToken) return res.status(200).json({ success: false, message: 'No FCM token stored', fcmToken: null });

    const msg = {
      notification: { title: 'Test Notification', body: 'FCM test from Nakshatra backend' },
      data: { type: 'test', click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: { priority: 'high', notification: { channelId: 'nakshatra_alerts' } },
      token: user.fcmToken
    };

    const result = await admin.messaging().send(msg);
    return res.status(200).json({ success: true, fcmSent: true, messageId: result, tokenPreview: user.fcmToken.substring(0, 30) + '...' });
  } catch (err) {
    return res.status(200).json({ success: false, fcmSent: false, error: err.message, errorCode: err.code, tokenPreview: (await User.findById(userId))?.fcmToken?.substring(0, 30) + '...' });
  }
});

// ============================================================
// INTERNAL SYSTEM ENDPOINT — Called by Python scanner
// POST /api/missing/system/camera-alert
// Body: { missingId, similarityScore, systemSecret }
// ============================================================
router.post('/system/camera-alert', async (req, res) => {
  try {
    const { missingId, similarityScore, systemSecret } = req.body;

    // Simple secret key auth (set SYSTEM_SECRET in .env)
    const expectedSecret = process.env.SYSTEM_SECRET || 'nakshatra_system_2024';
    if (systemSecret !== expectedSecret) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!missingId) {
      return res.status(400).json({ success: false, message: 'missingId required' });
    }

    // Find the missing report
    const { ObjectId } = require('mongoose').Types;
    let query = { missingId: missingId };
    if (ObjectId.isValid(missingId)) {
      query = { $or: [{ _id: new ObjectId(missingId) }, { missingId: missingId }] };
    }
    const report = await MissingReport.findOne(query);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Missing report not found' });
    }

    // Get parent user
    const userId = report.reportedBy;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Parent user not found' });
    }

    const childName = report.name;
    const simPct = similarityScore ? `${(similarityScore * 100).toFixed(1)}%` : 'High';

    // 1. Save notification to DB
    const notification = new Notification({
      type: 'found_alert',
      title: `🚨 Possible Match Found: ${childName}`,
      message: `Our camera system detected a ${simPct} confidence facial recognition match for ${childName} in video surveillance. Please check your email for the photo.`,
      targetUsers: [userId],
      relatedMissingId: report._id,
      priority: 'urgent',
      isRead: [],
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      actionUrl: 'CAMERA_FOUND_REPORT'
    });
    await notification.save();

    // 2. Send FCM push notification
    let fcmResult = null;
    let fcmError = null;
    if (user.fcmToken) {
      try {
        const fcmMessage = {
          notification: {
            title: `🚨 Possible Match Found: ${childName}`,
            body: `Camera system detected ${simPct} confidence match. Check your email for photo.`
          },
          data: {
            type: 'camera_found_alert',
            missingId: report._id.toString(),
            missingIdStr: report.missingId || '',
            actionUrl: 'CAMERA_FOUND_REPORT',
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'nakshatra_alerts',
              priority: 'max',
              defaultSound: true,
              defaultVibrateTimings: true,
              visibility: 'PUBLIC'
            }
          },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: { aps: { sound: 'default', badge: 1, contentAvailable: true } }
          },
          token: user.fcmToken
        };
        fcmResult = await admin.messaging().send(fcmMessage);
        console.log(`[CAMERA-ALERT] FCM sent to ${user.email}: ${fcmResult}`);
      } catch (fcmErr) {
        fcmError = fcmErr.message;
        console.error('[CAMERA-ALERT] FCM send failed:', fcmErr.message);
      }
    } else {
      fcmError = 'No FCM token stored for this user';
      console.warn(`[CAMERA-ALERT] No FCM token for user ${userId}`);
    }

    res.status(200).json({
      success: true,
      message: 'Alert sent successfully',
      notificationId: notification._id,
      fcmSent: !!fcmResult,
      fcmMessageId: fcmResult || null,
      fcmError: fcmError || undefined
    });

  } catch (error) {
    console.error('[CAMERA-ALERT] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Create missing report
router.post('/', authenticate, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('age').isInt({ min: 0, max: 18 }).withMessage('Age must be 0-18 years'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('photoUrl').isURL().withMessage('Valid photo URL required'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('lastSeenLocation.coordinates').isArray({ min: 2, max: 2 }).withMessage('Coordinates required [longitude, latitude]'),
  body('lastSeenLocation.address').trim().isLength({ min: 5, max: 200 }).withMessage('Address must be 5-200 characters'),
  body('contactNumber').matches(/^[0-9]{10}$/).withMessage('Valid 10-digit contact number required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, age, gender, photoUrl, description, lastSeenLocation, contactNumber } = req.body;

    const missingReport = new MissingReport({
      name,
      age,
      gender,
      photoUrl,
      description,
      lastSeenLocation,
      reportedBy: req.user._id,
      contactNumber
    });

    await missingReport.save();

    console.log('\n🔍 ===== SEARCHING FOR NEARBY USERS =====');
    console.log(`📍 Missing Location: [${lastSeenLocation.coordinates[0]}, ${lastSeenLocation.coordinates[1]}]`);
    console.log(`📍 Address: ${lastSeenLocation.address}`);
    console.log(`📏 Search Radius: 20 km (20,000 meters)`);
    console.log(`👤 Excluding Reporter: ${req.user._id}`);

    // First, check total users in database
    const totalUsers = await User.countDocuments();
    const usersWithLocation = await User.countDocuments({ 
      'location.coordinates': { $exists: true, $ne: [0, 0] } 
    });
    console.log(`\n📊 Database Stats:`);
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Users with location: ${usersWithLocation}`);
    console.log(`   Users without location: ${totalUsers - usersWithLocation}`);

    // Find nearby users to notify (within 20km radius)
    // Uses $geoWithin/$centerSphere (supports .sort() unlike $near), falls back to all users if none found
    let nearbyUsers = [];
    let usedFallback = false;
    try {
      const radiusRadians = 20 / 6371; // 20km in Earth radians
      nearbyUsers = await User.find({
        $and: [
          {
            'location.coordinates': {
              $geoWithin: {
                $centerSphere: [lastSeenLocation.coordinates, radiusRadians]
              }
            }
          },
          // Exclude users with default [0,0] location (location not set)
          { 'location.coordinates': { $ne: [0, 0] } },
          { _id: { $ne: req.user._id } }
        ]
      }).select('_id name fcmToken location');
    } catch (geoError) {
      console.error('❌ Geospatial query error:', geoError.message);
      nearbyUsers = []; // fall through to fallback
    }

    console.log(`\n📊 SEARCH RESULTS:`);
    console.log(`✅ Total users found within 20km: ${nearbyUsers.length}`);

    // 🔑 FALLBACK: If no nearby users found (location not updated yet), notify ALL users with FCM tokens
    if (nearbyUsers.length === 0) {
      console.log(`⚠️  No nearby users — falling back to ALL users with FCM tokens`);
      nearbyUsers = await User.find({
        _id: { $ne: req.user._id },
        fcmToken: { $ne: null, $exists: true }
      }).select('_id name fcmToken location');
      usedFallback = true;
      console.log(`📢 Fallback: found ${nearbyUsers.length} total users with FCM tokens`);
    }
    
    if (nearbyUsers.length > 0) {
      const usersWithFCM = nearbyUsers.filter(user => user.fcmToken);
      console.log(`📱 Users with FCM tokens: ${usersWithFCM.length}`);
      console.log(`📵 Users without FCM tokens: ${nearbyUsers.length - usersWithFCM.length}`);
      
      console.log(`\n👥 Target Users Details:`);
      nearbyUsers.forEach((user, index) => {
        const coords = user.location && user.location.coordinates;
        const distance = coords && !(coords[0]===0 && coords[1]===0)
          ? calculateDistance(
              lastSeenLocation.coordinates[1], 
              lastSeenLocation.coordinates[0],
              coords[1], 
              coords[0]
            ).toFixed(2)
          : usedFallback ? 'fallback' : 'N/A';
        console.log(`   ${index + 1}. ${user.name} (${user._id}) - ${distance} km - FCM: ${user.fcmToken ? '✓' : '✗'}`);
      });
    }
    console.log('========================================\n');

    // Create notification for nearby users (or all users via fallback)
    if (nearbyUsers.length > 0) {
      const notification = new Notification({
        type: 'missing_alert',
        title: `Missing Child Alert: ${name}`,
        message: `A ${age}-year-old ${gender} child named ${name} has gone missing near ${lastSeenLocation.address}. Please keep an eye out and help if you can.`,
        targetUsers: nearbyUsers.map(user => user._id),
        relatedMissingId: missingReport._id,
        priority: 'high'
      });

      await notification.save();
      console.log(`✅ Database notification created for ${nearbyUsers.length} users`);

      // 🔔 Send Push Notifications via FCM
      const fcmTokens = nearbyUsers
        .filter(user => user.fcmToken)
        .map(user => user.fcmToken);

      if (fcmTokens.length > 0) {
        console.log(`\n📲 SENDING PUSH NOTIFICATIONS:`);
        console.log(`   Attempting to send to ${fcmTokens.length} devices...`);
        
        try {
          // Send to each token individually to handle errors better
          let successCount = 0;
          let failureCount = 0;
          
          for (let i = 0; i < fcmTokens.length; i++) {
            try {
              const message = {
                notification: {
                  title: `Missing Child Alert: ${name}`,
                  body: `A ${age}-year-old ${gender} child has gone missing near ${lastSeenLocation.address}. Please help!`
                },
                data: {
                  type: 'missing_alert',
                  missingId: missingReport._id.toString(),
                  click_action: 'FLUTTER_NOTIFICATION_CLICK'
                },
                android: {
                  priority: 'high',
                  notification: {
                    channelId: 'nakshatra_alerts',
                    priority: 'max',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    visibility: 'public',
                  },
                },
                apns: {
                  headers: { 'apns-priority': '10' },
                  payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } },
                },
                token: fcmTokens[i]
              };

              await admin.messaging().send(message);
              successCount++;
              console.log(`   ✅ Token ${i + 1}: Sent successfully`);
            } catch (tokenError) {
              failureCount++;
              console.log(`   ❌ Token ${i + 1}: ${tokenError.code || tokenError.message}`);
              
              // Remove invalid tokens from user
              if (tokenError.code === 'messaging/invalid-registration-token' || 
                  tokenError.code === 'messaging/registration-token-not-registered') {
                const user = nearbyUsers[i];
                if (user) {
                  await User.findByIdAndUpdate(user._id, { fcmToken: null });
                  console.log(`   🗑️  Removed invalid token for user: ${user.name}`);
                }
              }
            }
          }
          
          console.log(`\n📊 Notification Summary: ${successCount} successful, ${failureCount} failed`);
        } catch (fcmError) {
          console.error('❌ FCM Error:', fcmError.message);
          console.error('   Error Code:', fcmError.code);
          console.error('   Make sure:');
          console.error('   1. Firebase Cloud Messaging API is enabled in Firebase Console');
          console.error('   2. Service account has proper permissions');
          console.error('   3. FCM tokens are valid and from the same Firebase project');
        }
      } else {
        console.log(`⚠️  No users with FCM tokens to send push notifications`);
      }
    } else {
      console.log(`ℹ️  No nearby users found - skipping notifications`);
    }

    res.status(201).json({
      success: true,
      message: 'Missing report created successfully',
      missingId: missingReport._id,
      notifiedUsers: nearbyUsers.length
    });

  } catch (error) {
    console.error('Create missing report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create missing report',
      error: error.message
    });
  }
});

// Get all missing reports (with pagination and filters)
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || 'active';
    const skip = (page - 1) * limit;

    let query = { status };

    // Location-based filtering if coordinates provided
    // NOTE: Using $geoWithin/$centerSphere instead of $near to allow .sort() on createdAt
    if (req.query.lat && req.query.lng && req.query.radius) {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const radiusKm = parseFloat(req.query.radius);
      const radiusRadians = radiusKm / 6371; // Earth radius in km

      query['lastSeenLocation.coordinates'] = {
        $geoWithin: {
          $centerSphere: [[lng, lat], radiusRadians]
        }
      };
    }

    const missingReports = await MissingReport.find(query)
      .populate('reportedBy', 'name phoneNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await MissingReport.countDocuments(query);

    res.status(200).json({
      success: true,
      missingReports,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReports: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get missing reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch missing reports',
      error: error.message
    });
  }
});

// Get specific missing report
router.get('/:missingId', authenticate, async (req, res) => {
  try {
    const missingReport = await MissingReport.findById(req.params.missingId)
      .populate('reportedBy', 'name email phoneNumber profilePhotoUrl');

    if (!missingReport) {
      return res.status(404).json({
        success: false,
        message: 'Missing report not found'
      });
    }

    res.status(200).json({
      success: true,
      missingReport
    });

  } catch (error) {
    console.error('Get missing report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch missing report',
      error: error.message
    });
  }
});

// Get missing reports by user
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const missingReports = await MissingReport.find({ reportedBy: req.params.userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      missingReports
    });

  } catch (error) {
    console.error('Get user missing reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user missing reports',
      error: error.message
    });
  }
});

// Update missing report
router.put('/:missingId', authenticateAdminOrUser, [
  body('description').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('contactNumber').optional().matches(/^[0-9]{10}$/).withMessage('Valid 10-digit contact number required'),
  body('status').optional().isIn(['active', 'found', 'closed']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const missingReport = await MissingReport.findById(req.params.missingId);

    if (!missingReport) {
      return res.status(404).json({
        success: false,
        message: 'Missing report not found'
      });
    }

    // Check if user is the owner of the report OR is an Admin
    const isOwner = missingReport.reportedBy && (missingReport.reportedBy.toString() === req.user._id.toString());
    if (!isOwner && !req.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own reports unless you are an admin.'
      });
    }

    const { description, contactNumber, status } = req.body;
    const updateData = {};

    if (description) updateData.description = description;
    if (contactNumber) updateData.contactNumber = contactNumber;
    if (status) updateData.status = status;

    const updatedReport = await MissingReport.findByIdAndUpdate(
      req.params.missingId,
      updateData,
      { new: true, runValidators: true }
    ).populate('reportedBy', 'name email phoneNumber');

    res.status(200).json({
      success: true,
      message: 'Missing report updated successfully',
      updatedReport
    });

  } catch (error) {
    console.error('Update missing report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update missing report',
      error: error.message
    });
  }
});

// Delete missing report
router.delete('/:missingId', authenticateAdminOrUser, async (req, res) => {
  try {
    const missingReport = await MissingReport.findById(req.params.missingId);

    if (!missingReport) {
      return res.status(404).json({
        success: false,
        message: 'Missing report not found'
      });
    }

    // Check if user is the owner of the report OR is an Admin
    const isOwner = missingReport.reportedBy && (missingReport.reportedBy.toString() === req.user._id.toString());
    if (!isOwner && !req.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own reports unless you are an admin.'
      });
    }

    await MissingReport.findByIdAndDelete(req.params.missingId);

    res.status(200).json({
      success: true,
      message: 'Missing report deleted successfully'
    });

  } catch (error) {
    console.error('Delete missing report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete missing report',
      error: error.message
    });
  }
});

module.exports = router;