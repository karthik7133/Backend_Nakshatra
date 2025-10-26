const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, checkOwnership } = require('../middleware/auth');
const admin = require('../utils/firebaseAdmin'); // 🎯 CRITICAL: Import Firebase Admin SDK

const router = express.Router();

// --- START: SECURE URL VALIDATOR (PATCH for GHSA-9965-vmph-33xx) ---
/**
 * Custom validator to securely check if a string is a valid HTTP/HTTPS URL.
 * Mitigates the validator.js bypass vulnerability.
 * @param {string} value The URL string to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
const isSecureUrl = (value) => {
  if (!value) return true; // Allows optional fields to be skipped
  try {
    const url = new URL(value);
    // Enforce safe protocols (http: and https:)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
};
// --- END: SECURE URL VALIDATOR ---


// Update FCM Token
router.put('/fcm-token', authenticate, [
  body('fcmToken').notEmpty().withMessage('FCM token is required')
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

    const { fcmToken } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { fcmToken },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`✅ FCM Token updated for user: ${req.user.name} (${req.user._id})`);

    res.status(200).json({
      success: true,
      message: 'FCM token updated successfully'
    });

  } catch (error) {
    console.error('Update FCM token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update FCM token',
      error: error.message
    });
  }
});

// Get current user profile (using token)
router.get('/profile', authenticate, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: {
        _id: req.user._id,
        firebaseUid: req.user.firebaseUid,
        name: req.user.name,
        email: req.user.email,
        phoneNumber: req.user.phoneNumber,
        role: req.user.role,
        profilePhotoUrl: req.user.profilePhotoUrl,
        emailVerified: req.user.emailVerified,
        location: req.user.location,
        fcmToken: req.user.fcmToken,
        createdAt: req.user.createdAt
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error.message
    });
  }
});

// Get user profile by ID
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

// Update user profile by Firebase UID
router.put('/:firebaseUid', authenticate, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('phoneNumber').optional().matches(/^[0-9]{10}$/).withMessage('Valid 10-digit phone number required'),
  // PATCH: Replaced isURL() with custom secure validator
  body('profilePhotoUrl').optional().custom(isSecureUrl).withMessage('Valid HTTP/HTTPS URL required for profile photo'),
  body('emailVerified').optional().isBoolean().withMessage('Email verified must be boolean'),
  body('location.address').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Address must be 3-200 characters'),
  body('location.coordinates').optional().isArray({ min: 2, max: 2 }).withMessage('Coordinates must be [longitude, latitude]')
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

    const { name, phoneNumber, profilePhotoUrl, emailVerified, location } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (profilePhotoUrl) updateData.profilePhotoUrl = profilePhotoUrl;
    if (emailVerified !== undefined) updateData.emailVerified = emailVerified;
    if (location) updateData.location = location;

    const updatedUser = await User.findOneAndUpdate(
      { firebaseUid: req.params.firebaseUid },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Update user profile by MongoDB ID
router.put('/id/:userId', authenticate, checkOwnership, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('phoneNumber').optional().matches(/^[0-9]{10}$/).withMessage('Valid 10-digit phone number required'),
  // PATCH: Replaced isURL() with custom secure validator
  body('profilePhotoUrl').optional().custom(isSecureUrl).withMessage('Valid HTTP/HTTPS URL required for profile photo'),
  body('location.address').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Address must be 3-200 characters'),
  body('location.coordinates').optional().isArray({ min: 2, max: 2 }).withMessage('Coordinates must be [longitude, latitude]')
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

    const { name, phoneNumber, profilePhotoUrl, location } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (profilePhotoUrl) updateData.profilePhotoUrl = profilePhotoUrl;
    if (location) updateData.location = location;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      updatedUser
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});


// Delete user account
router.delete('/:userId', authenticate, async (req, res) => {
  console.log(`\n🔒 USER DELETE REQUEST: User ${req.user._id} (Role: ${req.user.role}) attempting to delete ${req.params.userId}`);

  try {
    // 🎯 FIX: Authorization check: Admin bypasses ownership.
    const isSelfDeletion = req.user._id.toString() === req.params.userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

    if (!isSelfDeletion && !isAdmin) {
        console.warn(`❌ DELETE FAILED (403): User is not owner and not Admin. Role: ${req.user.role}`);
        return res.status(403).json({
            success: false,
            message: 'Access denied. You can only delete your own account unless you are an admin.'
        });
    }

    // 1. Find the user first to get their Firebase UID
    const userToDelete = await User.findById(req.params.userId);

    if (!userToDelete) {
      console.warn(`❌ DELETE FAILED (404): User not found in DB.`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 2. Delete user from Firebase Authentication
    try {
        await admin.auth().deleteUser(userToDelete.firebaseUid);
        console.log(`✅ Firebase user deleted: ${userToDelete.firebaseUid}`);
    } catch (firebaseError) {
        console.error('⚠️ Could not delete Firebase user (ID may be stale):', firebaseError.message);
    }

    // 3. Delete user from MongoDB
    await User.findByIdAndDelete(req.params.userId);

    console.log(`🎉 DELETE SUCCESS: User ${req.params.userId} removed by Admin/Owner.`);
    res.status(200).json({
      success: true,
      message: 'Account deleted successfully from DB and Firebase'
    });

  } catch (error) {
    console.error('❌ CRITICAL DELETE ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
});


// Update user location
router.post('/update-location', authenticate, [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  body('address').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Address must be 1-200 characters')
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

    const { latitude, longitude, address } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
          address: address || 'Current Location'
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      location: updatedUser.location
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location',
      error: error.message
    });
  }
});

// Get users by location (for finding nearby helpers)
router.post('/nearby', authenticate, [
  body('coordinates').isArray({ min: 2, max: 2 }).withMessage('Coordinates must be [longitude, latitude]'),
  body('radius').optional().isInt({ min: 1, max: 50 }).withMessage('Radius must be 1-50 km')
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

    const { coordinates, radius = 10 } = req.body; // Default 10km radius
    
    const nearbyUsers = await User.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      },
      _id: { $ne: req.user._id } // Exclude current user
    }).select('name role location profilePhotoUrl').limit(50);

    res.status(200).json({
      success: true,
      nearbyUsers
    });

  } catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby users',
      error: error.message
    });
  }
});

module.exports = router;