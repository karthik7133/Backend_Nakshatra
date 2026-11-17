const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const User = require("../models/User");
const Admin = require("../models/Admin");
const { authenticate } = require("../middleware/auth");

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
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
};
// --- END: SECURE URL VALIDATOR ---

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Firebase User Registration
router.post(
  "/register",
  [
    body("firebaseUid").notEmpty().withMessage("Firebase UID is required"),
    body("name")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Name must be 2-50 characters"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email required"),
    body("phoneNumber")
      .optional()
      .matches(/^[0-9]{10}$/)
      .withMessage("Valid 10-digit phone number required"),
    body("role").optional().isIn(["user", "admin"]).withMessage("Invalid role"),
    // PATCH: Added validation for profilePhotoUrl using secure custom function
    body("profilePhotoUrl")
      .optional()
      .custom(isSecureUrl)
      .withMessage("Valid HTTP/HTTPS URL required for profile photo"),
    body("emailVerified")
      .optional()
      .isBoolean()
      .withMessage("Email verified must be boolean"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const {
        firebaseUid,
        name,
        email,
        phoneNumber,
        role,
        profilePhotoUrl,
        emailVerified,
      } = req.body;

      // Check if user already exists by Firebase UID or email
      const existingUser = await User.findOne({
        $or: [{ firebaseUid }, { email }],
      });

      if (existingUser) {
        // Update existing user instead of creating new one
        const updatedUser = await User.findOneAndUpdate(
          { $or: [{ firebaseUid }, { email }] },
          {
            firebaseUid,
            name,
            email,
            phoneNumber: phoneNumber || existingUser.phoneNumber,
            role: role || existingUser.role,
            profilePhotoUrl: profilePhotoUrl || existingUser.profilePhotoUrl,
            emailVerified:
              emailVerified !== undefined
                ? emailVerified
                : existingUser.emailVerified,
          },
          { new: true, runValidators: true }
        );

        return res.status(200).json({
          success: true,
          message: "User updated successfully",
          user: {
            _id: updatedUser._id,
            firebaseUid: updatedUser.firebaseUid,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            profilePhotoUrl: updatedUser.profilePhotoUrl,
            emailVerified: updatedUser.emailVerified,
          },
        });
      }

      // Create new user
      const user = new User({
        firebaseUid,
        name,
        email,
        phoneNumber: phoneNumber || "",
        role: role || "user",
        profilePhotoUrl,
        emailVerified: emailVerified || false,
      });

      await user.save();

      console.log(
        `✅ New user registered: ${user.name} (${user._id}) - Firebase UID: ${user.firebaseUid}`
      );

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: {
          _id: user._id,
          firebaseUid: user.firebaseUid,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePhotoUrl: user.profilePhotoUrl,
          emailVerified: user.emailVerified,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Registration failed",
        error: error.message,
      });
    }
  }
);

// User Login
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      // ... rest of the login route
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePhotoUrl: user.profilePhotoUrl,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Login failed",
        error: error.message,
      });
    }
  }
);

// User Logout (Optional - for token blacklisting if needed)
router.post("/logout", authenticate, (req, res) => {
  // In a production app, you might want to blacklist the token
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// Verify Token
router.get("/verify", authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Token is valid",
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      profilePhotoUrl: req.user.profilePhotoUrl,
    },
  });
});

// Upload Profile Photo
router.post(
  "/upload-profile",
  upload.single("profileImage"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file provided",
        });
      }

      // Upload to Cloudinary
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "missing-person/profiles",
          resource_type: "image",
          transformation: [
            { width: 500, height: 500, crop: "limit" },
            { quality: "auto" },
          ],
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return res.status(500).json({
              success: false,
              message: "Failed to upload image",
              error: error.message,
            });
          }

          res.status(200).json({
            success: true,
            message: "Profile photo uploaded successfully",
            profilePhotoUrl: result.secure_url,
          });
        }
      );

      uploadStream.end(req.file.buffer);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload profile photo",
        error: error.message,
      });
    }
  }
);

module.exports = router;
