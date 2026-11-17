const jwt = require('jsonwebtoken');
const admin = require('../utils/firebaseAdmin');
const User = require('../models/User');
const Admin = require('../models/Admin');

// Authenticate user token (supports both Firebase ID tokens and custom JWTs)
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

    // 1. Try Firebase ID Token verification
    try {
      if (admin && admin.auth) {
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Find user by Firebase UID first, fallback to email
        user = await User.findOne({ firebaseUid: decodedToken.uid }).select('-passwordHash');
        
        if (!user && decodedToken.email) {
          user = await User.findOne({ email: decodedToken.email.toLowerCase() }).select('-passwordHash');
          if (user) {
            user.firebaseUid = decodedToken.uid;
            if (decodedToken.email_verified !== undefined) {
              user.emailVerified = decodedToken.email_verified;
            }
            await user.save();
          }
        }

        if (user) {
          req.user = user;
          return next();
        }
      }
    } catch (firebaseErr) {
      // Not a valid Firebase token, fallback to standard JWT
    }

    // 2. Fallback to standard backend JWT verification
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.userId).select('-passwordHash');
      
      if (user) {
        req.user = user;
        return next();
      }
    } catch (jwtErr) {
      // Both verifications failed
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });

  } catch (error) {
    console.error('Authentication middleware error:', error);
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
    const adminUser = await Admin.findById(decoded.adminId).select('-passwordHash');
    
    if (!adminUser || !adminUser.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Admin not found or inactive.'
      });
    }

    req.admin = adminUser;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid admin token.'
    });
  }
};

// Authenticate admin OR user token
const authenticateAdminOrUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Try Admin JWT
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.adminId) {
        const adminUser = await Admin.findById(decoded.adminId).select('-passwordHash');
        if (adminUser && adminUser.isActive) {
          req.user = adminUser;
          req.isAdmin = true;
          return next();
        }
      }
      if (decoded.userId) {
        const user = await User.findById(decoded.userId).select('-passwordHash');
        if (user) {
          req.user = user;
          req.isAdmin = false;
          return next();
        }
      }
    } catch (e) {}

    // Try Firebase
    try {
      if (admin && admin.auth) {
        const decodedToken = await admin.auth().verifyIdToken(token);
        let user = await User.findOne({ firebaseUid: decodedToken.uid }).select('-passwordHash');
        if (!user && decodedToken.email) {
          user = await User.findOne({ email: decodedToken.email.toLowerCase() }).select('-passwordHash');
        }
        if (user) {
          req.user = user;
          req.isAdmin = false;
          return next();
        }
      }
    } catch (e) {}

    return res.status(401).json({
      success: false,
      message: 'Invalid token. Authentication failed.'
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication failed.'
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

module.exports = {
  authenticate,
  authenticateAdmin,
  authenticateAdminOrUser,
  authorize,
  checkOwnership
};
