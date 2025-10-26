// routes/found.js (Finalized with Admin Delete Bypass and Logging)

const express = require('express');
const { body, validationResult, check } = require('express-validator');
const FoundReport = require('../models/FoundReport');
const MissingReport = require('../models/MissingReport');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const admin = require('../utils/firebaseAdmin');
const { compareFaces } = require('../utils/faceRecognition'); // Assumed utility for compareFaces
const axios = require('axios'); // Required for the new check-face endpoint

const router = express.Router();

// Base URL for Face++ API (Ensure this matches your configuration)
const FACEPLUSPLUS_BASE_URL = 'https://api-us.faceplusplus.com/facepp/v3';


// --- START: SECURE URL VALIDATOR (PATCH for GHSA-9965-vmph-33xx) ---
const isSecureUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
};
// --- END: SECURE URL VALIDATOR ---

// --- HELPER FOR FACE++ IMAGE SIZE FIX ---
function getFaceRecognitionUrl(originalUrl) {
    const uploadSegment = '/upload/';
    const transformation = 'w_500,h_500,c_limit';
    
    if (!originalUrl || typeof originalUrl !== 'string') return originalUrl;

    const index = originalUrl.indexOf(uploadSegment);
    
    if (index !== -1) {
        const base = originalUrl.substring(0, index + uploadSegment.length);
        const rest = originalUrl.substring(index + uploadSegment.length);
        
        // Check if transformation already exists to prevent duplication
        if (rest.startsWith('w_') || rest.startsWith('h_')) {
            return originalUrl; 
        }

        const transformedUrl = `${base}${transformation}/${rest}`;
        return transformedUrl;
    }
    
    return originalUrl; 
}


// =========================================================
// NEW ENDPOINT: CHECK FOR DETECTABLE FACE BEFORE SUBMISSION
// =========================================================
router.post('/check-face', authenticate, [
  check('photoUrl').custom(isSecureUrl).withMessage('Valid HTTP/HTTPS photo URL required')
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

    const { photoUrl } = req.body;
    
    const transformedUrl = getFaceRecognitionUrl(photoUrl);
    const checkFaceUrl = `${FACEPLUSPLUS_BASE_URL}/detect`;

    const formData = new URLSearchParams();
    formData.append('api_key', process.env.FACEPLUSPLUS_API_KEY);
    formData.append('api_secret', process.env.FACEPLUSPLUS_API_SECRET);
    formData.append('image_url', transformedUrl);
    formData.append('return_attributes', 'gender'); 
    
    const faceResponse = await axios.post(checkFaceUrl, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const result = faceResponse.data;
    const faceCount = result.faces.length;
    
    if (faceCount > 0) {
      return res.status(200).json({
        success: true,
        message: 'Face detected successfully.',
        faceCount: faceCount,
      });
    } else {
      return res.status(200).json({
        success: false,
        message: 'No detectable face found in the image. Please use a clearer photo.',
        faceCount: 0,
      });
    }

  } catch (error) {
    const errorMessage = error.response?.data?.error_message || error.message;

    if (errorMessage.includes('INVALID_IMAGE_SIZE') || errorMessage.includes('IMAGE_ERROR')) {
        return res.status(400).json({
            success: false,
            message: 'Image quality error: The photo is too blurry or the resolution is invalid. Please upload a clear, focused photo.',
            errorDetails: errorMessage
        });
    }
    
    console.error('❌ Check Face API Error:', errorMessage);
    res.status(500).json({
      success: false,
      message: 'Failed to process image due to a temporary API error. Try again.',
      error: errorMessage
    });
  }
});


// =========================================================
// MAIN ENDPOINT: SUBMIT FOUND REPORT
// =========================================================
router.post('/', authenticate, [
  body('missingId').isMongoId().withMessage('Valid missing report ID required'),
  check('photoUrl').custom(isSecureUrl).withMessage('Valid HTTP/HTTPS photo URL required'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('locationFound.coordinates').isArray({ min: 2, max: 2 }).withMessage('Coordinates required [longitude, latitude]'),
  body('locationFound.address').trim().isLength({ min: 5, max: 200 }).withMessage('Address must be 5-200 characters'),
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

    const { missingId, photoUrl, description, locationFound, contactNumber } = req.body;

    const missingReport = await MissingReport.findById(missingId)
      .populate('reportedBy', 'name email photoUrl fcmToken');

    if (!missingReport) {
      return res.status(404).json({
        success: false,
        message: 'Missing report not found'
      });
    }

    if (missingReport.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This missing case is no longer active'
      });
    }
    
    // --- FACE COMPARISON LOGIC ---
    const transformedMissingUrl = getFaceRecognitionUrl(missingReport.photoUrl);
    const transformedFoundUrl = getFaceRecognitionUrl(photoUrl);
    
    const faceComparisonResult = await compareFaces(transformedMissingUrl, transformedFoundUrl);

    let notificationTitle = `Possible Match Found for ${missingReport.name}`;
    let notificationMessage = `Someone has reported finding a child matching ${missingReport.name}'s description.`;
    let pushBody = `Someone reported finding a child matching your description.`;

    if (faceComparisonResult.confidence > 0) {
        notificationTitle = `${faceComparisonResult.strength}: Match Found for ${missingReport.name}`;
        notificationMessage = `A report with a **${faceComparisonResult.strength}** match has been submitted for ${missingReport.name}. Confidence score: ${faceComparisonResult.confidence}%. Please check the found report and verify if this is your child.`;
        pushBody = `A ${faceComparisonResult.strength} match (Score: ${faceComparisonResult.confidence}%) has been reported for ${missingReport.name}. Please verify immediately!`;
    } else {
         notificationMessage += `\n(Match Strength: ${faceComparisonResult.strength}).`;
         pushBody += ` (Match Strength: ${faceComparisonResult.strength}). Please verify immediately!`;
    }
    // --- END COMPARISON LOGIC ---

    const foundReport = new FoundReport({
      missingId,
      photoUrl,
      description,
      locationFound,
      foundBy: req.user._id,
      contactNumber,
      // --- PERSIST NEW FIELDS ---
      matchConfidence: faceComparisonResult.confidence,
      matchStrength: faceComparisonResult.strength
    });

    await foundReport.save();

    const notification = new Notification({
      type: 'found_alert',
      title: notificationTitle,
      message: notificationMessage,
      targetUsers: [missingReport.reportedBy._id],
      relatedMissingId: missingId,
      relatedFoundId: foundReport._id,
      priority: 'urgent'
    });

    await notification.save();

    const parent = missingReport.reportedBy;
    if (parent && parent.fcmToken) {
      try {
        await admin.messaging().send({
          notification: {
            title: notificationTitle,
            body: pushBody
          },
          data: {
            type: 'found_alert',
            foundId: foundReport._id.toString(),
            missingId: missingId.toString(),
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          },
          token: parent.fcmToken
        });
        console.log('✅ Push notification sent to parent');
      } catch (fcmError) {
        console.error('❌ FCM Error sending to parent:', fcmError);
      }
    }

    res.status(201).json({
      success: true,
      message: `Found report submitted successfully. ${faceComparisonResult.strength} match detected. The family has been notified.`,
      foundId: foundReport._id,
      matchDetails: {
          confidence: faceComparisonResult.confidence,
          strength: faceComparisonResult.strength,
          message: faceComparisonResult.message
      }
    });

  } catch (error) {
    console.error('Create found report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit found report',
      error: error.message
    });
  }
});

// Get all found reports
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const foundReports = await FoundReport.find()
      .select('-__v')
      .populate('missingId', 'name age gender photoUrl')
      .populate('foundBy', 'name phoneNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FoundReport.countDocuments();

    res.status(200).json({
      success: true,
      foundReports,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReports: total
      }
    });

  } catch (error) {
    console.error('Get found reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch found reports',
      error: error.message
    });
  }
});

// Get count of found reports by authenticated user
router.get('/user/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    const totalFound = await FoundReport.countDocuments({ foundBy: userId });

    const verifiedFound = await FoundReport.countDocuments({ 
      foundBy: userId, 
      verifiedByParent: true 
    });

    const pendingVerification = await FoundReport.countDocuments({ 
      foundBy: userId, 
      status: 'pending' 
    });

    res.status(200).json({
      success: true,
      stats: {
        totalFound,
        verifiedFound,
        pendingVerification
      }
    });

  } catch (error) {
    console.error('Get user found stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: error.message
    });
  }
});

// Get specific found report (UPDATED to return match details from DB)
router.get('/:foundId', authenticate, async (req, res) => {
  try {
    const foundReport = await FoundReport.findById(req.params.foundId)
      .populate('missingId', 'name age gender photoUrl description reportedBy')
      .populate('foundBy', 'name email phoneNumber profilePhotoUrl');

    if (!foundReport) {
      return res.status(404).json({
        success: false,
        message: 'Found report not found'
      });
    }

    res.status(200).json({
      success: true,
      foundReport: {
        ...foundReport.toObject(),
        matchDetails: {
          confidence: foundReport.matchConfidence,
          strength: foundReport.matchStrength,
          message: `Match confidence: ${foundReport.matchConfidence}%. Strength: ${foundReport.matchStrength}.`
        }
      }
    });

  } catch (error) {
    console.error('Get found report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch found report',
      error: error.message
    });
  }
});

// Get found reports for specific missing case
router.get('/missing/:missingId', authenticate, async (req, res) => {
  try {
    const foundReports = await FoundReport.find({ missingId: req.params.missingId })
      .populate('foundBy', 'name phoneNumber profilePhotoUrl')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      foundReports
    });

  } catch (error) {
    console.error('Get missing found reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch found reports for this missing case',
      error: error.message
    });
  }
});

// Verify found report by parent
router.patch('/:foundId/verify', authenticate, [
  body('verifiedByParent').isBoolean().withMessage('Verification status must be boolean'),
  body('verificationNotes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
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

    const foundReport = await FoundReport.findById(req.params.foundId)
      .populate('missingId');

    if (!foundReport) {
      return res.status(404).json({
        success: false,
        message: 'Found report not found'
      });
    }

    // Check if user is the parent who reported the missing child
    if (foundReport.missingId.reportedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the parent who reported the missing child can verify this.'
      });
    }

    const { verifiedByParent, verificationNotes } = req.body;

    foundReport.verifiedByParent = verifiedByParent;
    foundReport.status = verifiedByParent ? 'verified' : 'rejected';
    if (verificationNotes) {
      foundReport.verificationNotes = verificationNotes;
    }

    await foundReport.save();

    // If verified, update missing report status AND clear closeReason
    if (verifiedByParent) {
      await MissingReport.findByIdAndUpdate(
        foundReport.missingId._id,
        { 
          status: 'found',
          closeReason: null 
        }
      );

      // Notify the finder
      const notification = new Notification({
        type: 'found_alert',
        title: 'Your Found Report Verified!',
        message: `Thank you for helping! The family has confirmed that you found their missing child. You've helped reunite a family!`,
        targetUsers: [foundReport.foundBy],
        relatedMissingId: foundReport.missingId._id,
        relatedFoundId: foundReport._id,
        priority: 'high'
      });

      await notification.save();

      // 🔔 Send Push Notification to Finder
      const finder = await User.findById(foundReport.foundBy);
      if (finder && finder.fcmToken) {
        try {
          await admin.messaging().send({
            notification: {
              title: 'Your Found Report Verified!',
              body: `Thank you for your help! The family confirmed you found their missing child. You've helped reunite a family!`
            },
            data: {
              type: 'verification_confirmed',
              foundId: foundReport._id.toString(),
              missingId: foundReport.missingId._id.toString(),
              click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            token: finder.fcmToken
          });
          console.log('✅ Verification notification sent to finder');
        } catch (fcmError) {
          console.error('❌ FCM Error sending to finder:', fcmError);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: verifiedByParent ? 'Found report verified successfully!' : 'Found report marked as incorrect',
      updatedFoundReport: foundReport
    });

  } catch (error) {
    console.error('Verify found report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify found report',
      error: error.message
    });
  }
});

// Delete found report
router.delete('/:foundId', authenticate, async (req, res) => {
  console.log(`\n🔒 FOUND REPORT DELETE REQUEST: User ${req.user._id} (Role: ${req.user.role}) attempting to delete ${req.params.foundId}`);
  try {
    const foundReport = await FoundReport.findById(req.params.foundId);

    if (!foundReport) {
      console.warn(`❌ DELETE FAILED: Report not found.`);
      return res.status(404).json({
        success: false,
        message: 'Found report not found'
      });
    }

    // 🎯 FIX: Authorization check. Allow deletion if user is the report owner OR is an Admin
    const isOwner = foundReport.foundBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    
    if (!isOwner && !isAdmin) {
      console.warn(`❌ DELETE FAILED (403): Not owner and not Admin. Current Role: ${req.user.role}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own found reports unless you are an admin.'
      });
    }

    await FoundReport.findByIdAndDelete(req.params.foundId);

    console.log(`🎉 DELETE SUCCESS: Found Report ${req.params.foundId} removed.`);
    res.status(200).json({
      success: true,
      message: 'Found report deleted successfully'
    });

  } catch (error) {
    console.error('❌ CRITICAL DELETE ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete found report',
      error: error.message
    });
  }
});

module.exports = router;