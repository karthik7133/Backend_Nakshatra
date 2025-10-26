const jwt = require('jsonwebtoken');
const { admin } = require('../config/firebase');
const User = require('../models/User');
const Admin = require('../models/Admin');

// Authenticate user token (supports both JWT and Firebase tokens)
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    let user = null;

    // Try Firebase token first
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Find user by Firebase UID
      user = await User.findOne({ firebaseUid: decodedToken.uid }).select('-passwordHash');
      
      if (!user) {
        console.log('⚠️ User not found in database for Firebase UID:', decodedToken.uid);
        return res.status(401).json({
          success: false,
          message: 'User not found in database. Please complete registration.'
        });
      }
    } catch (firebaseError) {
      console.log('⚠️ Firebase token verification failed, trying JWT...');
      
      // Fallback to JWT token
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.userId).select('-passwordHash');
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Invalid JWT token. User not found.'
          });
        }
        
        console.log('✅ JWT token verified for user:', user.email);
      } catch (jwtError) {
        console.log('❌ Both Firebase and JWT token verification failed');
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Authentication failed.'
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

// Authenticate admin token
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No admin token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.adminId).select('-passwordHash');
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Admin not found or inactive.'
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid admin token.'
    });
  }
};

// Authorization middleware for specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Check if user is the owner of the resource
const checkOwnership = (req, res, next) => {
  if (req.params.userId !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources.'
    });
  }
  next();
};

// Authenticate admin OR user token (for routes that need both)
const authenticateAdminOrUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Try to verify as Admin JWT token first
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if it's an admin token
      if (decoded.adminId) {
        const admin = await Admin.findById(decoded.adminId).select('-passwordHash');
        
        if (admin && admin.isActive) {
          req.user = admin; // Set admin as user for unified handling
          req.isAdmin = true; // Flag to indicate this is an admin
          console.log('✅ Admin token verified:', admin.email);
          return next();
        }
      }
      
      // Check if it's a user JWT token
      if (decoded.userId) {
        const user = await User.findById(decoded.userId).select('-passwordHash');
        
        if (user) {
          req.user = user;
          req.isAdmin = false;
          console.log('✅ User JWT token verified:', user.email);
          return next();
        }
      }
    } catch (jwtError) {
      // If JWT fails, try Firebase token
      console.log('⚠️ JWT verification failed, trying Firebase token...');
    }

    // Try Firebase token as fallback
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      const user = await User.findOne({ firebaseUid: decodedToken.uid }).select('-passwordHash');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found in database. Please complete registration.'
        });
      }
      
      req.user = user;
      req.isAdmin = false;
      console.log('✅ Firebase token verified:', user.email);
      return next();
    } catch (firebaseError) {
      console.log('❌ Firebase token verification also failed');
    }

    // If all verification methods fail
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Authentication failed.'
    });

  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

module.exports = {
  authenticate,
  authenticateAdmin,
  authenticateAdminOrUser,
  authorize,
  checkOwnership
};