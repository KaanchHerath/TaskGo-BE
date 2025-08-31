import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
// Cookie utilities (avoid extra deps)
const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...v] = part.trim().split('=');
    if (!key) return acc;
    acc[decodeURIComponent(key)] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
};

const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

const issueAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const issueRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id, tokenType: 'refresh' },
    getRefreshSecret(),
    { expiresIn: '7d' }
  );
};

const setRefreshCookie = (res, token) => {
  // Use Secure + SameSite=None for cross-site cookies; path limited to refresh/logout
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};


// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Password strength validation
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return "Password must be at least 8 characters long";
  }
  if (!hasUpperCase) {
    return "Password must contain at least one uppercase letter";
  }
  if (!hasLowerCase) {
    return "Password must contain at least one lowercase letter";
  }
  if (!hasNumbers) {
    return "Password must contain at least one number";
  }
  if (!hasSpecialChar) {
    return "Password must contain at least one special character";
  }
  return null;
};

// Input validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^\+?[\d\s-]{10,}$/;
  return phoneRegex.test(phone);
};



router.post("/register", async (req, res) => {
  try {
    const { 
      username, 
      email, 
      phone,
      password, 
      role,
      fullName,
      // Customer specific fields
      province,
      // Tasker specific fields
      skills,
      country,
      area,
      identificationDocument,
      qualificationDocuments
    } = req.body;
    
    // Validate basic inputs
    if (!username || !email || !phone || !password || !role || !fullName) {
      return res.status(400).json({ 
        message: "Please complete all required fields to continue with registration.",
        errorType: "missing_fields",
        fields: {
          username: !username,
          email: !email,
          phone: !phone,
          password: !password,
          role: !role,
          fullName: !fullName
        }
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ 
        message: "Please enter a valid email address in the format: example@domain.com",
        errorType: "invalid_email",
        field: "email"
      });
    }

    // Validate phone format
    if (!validatePhone(phone)) {
      return res.status(400).json({ 
        message: "Please enter a valid phone number. Format: +94XXXXXXXXX or 07XXXXXXXX",
        errorType: "invalid_phone",
        field: "phone"
      });
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ 
        message: passwordError,
        errorType: "weak_password",
        field: "password"
      });
    }

    // Validate role
    if (!['customer', 'tasker'].includes(role)) {
      return res.status(400).json({ 
        message: "Please select a valid account type (Customer or Tasker).",
        errorType: "invalid_role",
        field: "role"
      });
    }

    // Validate required fields based on role
    if (role === 'customer' && !province) {
      return res.status(400).json({ 
        message: "Please select your province to help us provide location-based services.",
        errorType: "missing_province",
        field: "province"
      });
    }

    if (role === 'tasker') {
      if (!skills || !skills.length) {
        return res.status(400).json({ 
          message: "Please select at least one skill to help customers find you for relevant tasks.",
          errorType: "missing_skills",
          field: "skills"
        });
      }
      if (!country) {
        return res.status(400).json({ 
          message: "Please select your country to help us provide location-based services.",
          errorType: "missing_country",
          field: "country"
        });
      }
      if (!area) {
        return res.status(400).json({ 
          message: "Please specify your service area to help customers find you.",
          errorType: "missing_area",
          field: "area"
        });
      }
      if (!identificationDocument) {
        return res.status(400).json({ 
          message: "Please upload your identification document for verification purposes.",
          errorType: "missing_id_document",
          field: "identificationDocument"
        });
      }
      if (!qualificationDocuments || !qualificationDocuments.length) {
        return res.status(400).json({ 
          message: "Please upload at least one qualification document to verify your expertise.",
          errorType: "missing_qualification_documents",
          field: "qualificationDocuments"
        });
      }
    }

    // Check if user already exists with specific field checks
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ 
        message: "An account with this email address already exists. Please use a different email or try logging in.",
        errorType: "duplicate_email",
        field: "email"
      });
    }

    const existingPhone = await User.findOne({ phone: phone });
    if (existingPhone) {
      return res.status(400).json({ 
        message: "This phone number is already registered. Please use a different phone number or contact support if this is your number.",
        errorType: "duplicate_phone",
        field: "phone"
      });
    }

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({ 
        message: "This username is already taken. Please choose a different username.",
        errorType: "duplicate_username",
        field: "username"
      });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const userData = {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      role,
      fullName,
      customerProfile: role === 'customer' ? { province } : undefined,
      taskerProfile: role === 'tasker' ? {
        skills,
        country,
        area,
        identificationDocument,
        qualificationDocuments
      } : undefined
    };
    
    const user = new User(userData);
    await user.save();

    // Create token
    const token = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user);
    setRefreshCookie(res, refreshToken);
    
    res.status(201).json({ 
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific database errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: "Please check your input and try again.",
        errorType: "validation_error",
        details: validationErrors
      });
    }
    
    if (error.name === 'MongoError' && error.code === 11000) {
      // Handle duplicate key errors
      const field = Object.keys(error.keyPattern)[0];
      let message = "This information is already registered.";
      
      if (field === 'email') {
        message = "An account with this email address already exists. Please use a different email or try logging in.";
      } else if (field === 'phone') {
        message = "This phone number is already registered. Please use a different phone number or contact support if this is your number.";
      } else if (field === 'username') {
        message = "This username is already taken. Please choose a different username.";
      }
      
      return res.status(400).json({ 
        message,
        errorType: "duplicate_field",
        field: field
      });
    }
    
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(503).json({ 
        message: "Database connection timeout. Please try again later.",
        errorType: "db_timeout"
      });
    }
    
    if (error.name === 'MongoNetworkError') {
      return res.status(503).json({ 
        message: "Database network error. Please try again later.",
        errorType: "db_network_error"
      });
    }
    
    res.status(500).json({ 
      message: "We're experiencing technical difficulties. Please try again later or contact support if the problem persists.",
      errorType: "server_error"
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check database connection status
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Ready state:', mongoose.connection.readyState);
      return res.status(503).json({ 
        message: "Database connection is not available. Please try again later.",
        error: "DB_CONNECTION_ERROR"
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if user is suspended
    if (user.isSuspended) {
      return res.status(403).json({ 
        message: "Account is suspended. Please contact support for assistance.",
        accountStatus: "suspended"
      });
    }

    // Check tasker approval status
    let approvalStatus = null;
    if (user.role === 'tasker') {
      approvalStatus = user.taskerProfile?.approvalStatus || 'pending';
      
      // If tasker is not approved, provide specific message
      if (approvalStatus !== 'approved') {
        return res.status(403).json({
          message: approvalStatus === 'pending' 
            ? "Your account is pending approval. You will be notified once approved."
            : "Your account has been rejected. Please contact support for more information.",
          accountStatus: "not_approved",
          approvalStatus: approvalStatus,
          rejectionReason: user.taskerProfile?.rejectionReason || null
        });
      }
    }
    
    const token = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user);
    setRefreshCookie(res, refreshToken);
    
    // Prepare user response data
    const userData = {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role
    };

    // Add approval status for taskers
    if (user.role === 'tasker') {
      userData.approvalStatus = approvalStatus;
      userData.isApproved = user.taskerProfile?.isApproved || false;
    }
    
    res.json({ 
      token, 
      user: userData,
      accountStatus: "active"
    });
  } catch (error) {
    console.error('Login error:', error);
    
    // Provide more specific error messages based on error type
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return res.status(503).json({ 
        message: "Database connection timeout. Please try again later.",
        error: "DB_TIMEOUT_ERROR"
      });
    }
    
    if (error.name === 'MongoNetworkError') {
      return res.status(503).json({ 
        message: "Database network error. Please try again later.",
        error: "DB_NETWORK_ERROR"
      });
    }
    
    res.status(500).json({ 
      message: "An error occurred during login",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Tasker registration endpoint
router.post("/register-tasker", async (req, res) => {
    try {
      const {
        email,
        password,
        fullName,
        phone,
        skills,
        province,
        district
      } = req.body;
      
      // Validate required fields
      if (!email || !password || !fullName || !phone || !skills || !province || !district) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Validate email format
      if (!validateEmail(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Validate phone format
      if (!validatePhone(phone)) {
        return res.status(400).json({ message: "Invalid phone number format" });
      }
      
      // Validate email and phone uniqueness
      const existingUser = await User.findOne({
        $or: [
          { email: email.toLowerCase() },
          { phone: phone }
        ]
      });
      if (existingUser) {
        return res.status(400).json({ message: "User with this email or phone already exists" });
      }

      // Handle file uploads using express-fileupload
      if (!req.files || !req.files.idDocument) {
        return res.status(400).json({ message: "ID Document is required" });
      }

      const idDocumentFile = req.files.idDocument;
      const qualificationFiles = req.files.qualificationDocuments || [];

      // Ensure qualificationFiles is an array
      const qualificationFilesArray = Array.isArray(qualificationFiles) ? qualificationFiles : [qualificationFiles];

      // Save files to disk
      const uploadPath = path.join(__dirname, '../../uploads/tasker-docs');
      fs.mkdirSync(uploadPath, { recursive: true });

      // Save ID document
      const idDocumentFileName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + idDocumentFile.name;
      const idDocumentPath = path.join(uploadPath, idDocumentFileName);
      await idDocumentFile.mv(idDocumentPath);

      // Store relative path for database (for serving via /uploads route)
      const idDocumentRelativePath = `uploads/tasker-docs/${idDocumentFileName}`;

      // Save qualification documents
      const qualificationPaths = [];
      for (const file of qualificationFilesArray) {
        if (file && file.name) {
          const fileName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + file.name;
          const filePath = path.join(uploadPath, fileName);
          await file.mv(filePath);
          // Store relative path for database
          qualificationPaths.push(`uploads/tasker-docs/${fileName}`);
        }
      }
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      // Save user
      const user = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'tasker',
        fullName,
        phone,
        taskerProfile: {
          skills: Array.isArray(skills) ? skills : [skills],
          province,
          district,
          idDocument: idDocumentRelativePath,
          qualificationDocuments: qualificationPaths
        }
      });
      await user.save();
      // Create JWT with approval status for taskers
      const tokenPayload = { userId: user._id, role: user.role };
      if (user.role === 'tasker') {
        tokenPayload.isApproved = false; // New taskers are not approved by default
        tokenPayload.approvalStatus = 'pending';
      }
      
      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );
      res.status(201).json({ 
        token, 
        user: { 
          id: user._id, 
          email: user.email, 
          fullName: user.fullName,
          phone: user.phone,
          role: user.role 
        } 
      });
    } catch (error) {
      console.error('Tasker registration error:', error);
      res.status(500).json({ message: "An error occurred during tasker registration" });
    }
  }
);

export default router;
 
// Refresh access token using httpOnly refresh cookie
router.post('/refresh', async (req, res) => {
  try {
    const cookies = req.headers.cookie ? parseCookies(req.headers.cookie) : {};
    const token = cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'No refresh token' });
    }
    const decoded = jwt.verify(token, getRefreshSecret());
    if (!decoded || decoded.tokenType !== 'refresh' || !decoded.userId) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    const newAccess = issueAccessToken(user);
    // Optionally rotate refresh
    const newRefresh = issueRefreshToken(user);
    setRefreshCookie(res, newRefresh);
    return res.json({ token: newAccess });
  } catch (err) {
    return res.status(401).json({ message: 'Failed to refresh token' });
  }
});

// Logout clears refresh cookie
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/auth', httpOnly: true, secure: true, sameSite: 'none' });
  return res.json({ message: 'Logged out' });
});