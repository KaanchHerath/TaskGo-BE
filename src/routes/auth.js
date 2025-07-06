import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rate limiter for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window (increased from 5)
  message: { message: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many login attempts, please try again after 15 minutes",
      retryAfter: Math.ceil(15 * 60 / 1000), // seconds
      error: "RATE_LIMIT_EXCEEDED"
    });
  }
});

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
      return res.status(400).json({ message: "All basic fields are required" });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate phone format
    if (!validatePhone(phone)) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    // Validate role
    if (!['customer', 'tasker'].includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    // Validate required fields based on role
    if (role === 'customer' && !province) {
      return res.status(400).json({ message: "Province is required for customers" });
    }

    if (role === 'tasker') {
      if (!skills || !skills.length) {
        return res.status(400).json({ message: "At least one skill is required for taskers" });
      }
      if (!country) {
        return res.status(400).json({ message: "Country is required for taskers" });
      }
      if (!area) {
        return res.status(400).json({ message: "Area is required for taskers" });
      }
      if (!identificationDocument) {
        return res.status(400).json({ message: "Identification document is required for taskers" });
      }
      if (!qualificationDocuments || !qualificationDocuments.length) {
        return res.status(400).json({ message: "At least one qualification document is required for taskers" });
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phone: phone },
        { username: username.toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ message: "User with this email, phone, or username already exists" });
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
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    
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
    res.status(500).json({ message: "An error occurred during registration" });
  }
});

// Rate limit reset endpoint (for development/testing only)
router.post("/reset-rate-limit", (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: "Rate limit reset not available in production" });
  }
  
  // Clear the rate limit store for the current IP
  const key = `rl:login:${req.ip}`;
  if (loginLimiter.store && loginLimiter.store.resetKey) {
    loginLimiter.store.resetKey(key);
  }
  
  res.json({ message: "Rate limit reset successfully" });
});

router.post("/login", loginLimiter, async (req, res) => {
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
    
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    
    res.json({ 
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
      // Create JWT
      const token = jwt.sign(
        { userId: user._id, role: user.role },
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