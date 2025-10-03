import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

const sendError = (res, status, message, errorType = null, field = null) => {
  const errorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (errorType) errorResponse.errorType = errorType;
  if (field) errorResponse.field = field;
  
  return res.status(status).json(errorResponse);
};

const handleDatabaseError = (error, res) => {
  console.error('Database error:', error);
  
  if (error.name === 'ValidationError') {
    const validationErrors = Object.values(error.errors).map(err => err.message);
    return sendError(res, 400, "Please check your input and try again.", "validation_error");
  }
  
  if (error.name === 'MongoError' && error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    let message = "This information is already registered.";
    
    if (field === 'email') {
      message = "An account with this email address already exists. Please use a different email or try logging in.";
    } else if (field === 'phone') {
      message = "This phone number is already registered. Please use a different phone number or contact support if this is your number.";
    } else if (field === 'username') {
      message = "This username is already taken. Please choose a different username.";
    }
    
    return sendError(res, 400, message, "duplicate_field", field);
  }
  
  if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
    return sendError(res, 503, "Database connection timeout. Please try again later.", "db_timeout");
  }
  
  if (error.name === 'MongoNetworkError') {
    return sendError(res, 503, "Database network error. Please try again later.", "db_network_error");
  }
  
  return sendError(res, 500, "We're experiencing technical difficulties. Please try again later or contact support if the problem persists.", "server_error");
};

export const register = async (req, res) => {
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
    
    // Check if user already exists with specific field checks
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return sendError(res, 400, "An account with this email address already exists. Please use a different email or try logging in.", "duplicate_email", "email");
    }

    const existingPhone = await User.findOne({ phone: phone });
    if (existingPhone) {
      return sendError(res, 400, "This phone number is already registered. Please use a different phone number or contact support if this is your number.", "duplicate_phone", "phone");
    }

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return sendError(res, 400, "This username is already taken. Please choose a different username.", "duplicate_username", "username");
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
      success: true,
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
    handleDatabaseError(error, res);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check database connection status
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Ready state:', mongoose.connection.readyState);
      return sendError(res, 503, "Database connection is not available. Please try again later.", "DB_CONNECTION_ERROR");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return sendError(res, 401, "Invalid email or password");
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return sendError(res, 401, "Invalid email or password");
    }

    // Check if user is suspended
    if (user.isSuspended) {
      return sendError(res, 403, "Account is suspended. Please contact support for assistance.", "suspended");
    }

    // Check tasker approval status
    let approvalStatus = null;
    if (user.role === 'tasker') {
      approvalStatus = user.taskerProfile?.approvalStatus || 'pending';
      
      // If tasker is not approved, provide specific message
      if (approvalStatus !== 'approved') {
        return sendError(res, 403, 
          approvalStatus === 'pending' 
            ? "Your account is pending approval. You will be notified once approved."
            : "Your account has been rejected. Please contact support for more information.",
          "not_approved"
        );
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
      success: true,
      token, 
      user: userData,
      accountStatus: "active"
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      return sendError(res, 503, "Database connection timeout. Please try again later.", "DB_TIMEOUT_ERROR");
    }
    
    if (error.name === 'MongoNetworkError') {
      return sendError(res, 503, "Database network error. Please try again later.", "DB_NETWORK_ERROR");
    }
    
    return sendError(res, 500, "An error occurred during login", "server_error");
  }
};

export const registerTasker = async (req, res) => {
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
    
    // Validate email and phone uniqueness
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phone: phone }
      ]
    });
    if (existingUser) {
      return sendError(res, 400, "User with this email or phone already exists", "duplicate_user");
    }

    // Handle file uploads using express-fileupload
    if (!req.files || !req.files.idDocument) {
      return sendError(res, 400, "ID Document is required", "missing_id_document");
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
      success: true,
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
    handleDatabaseError(error, res);
  }
};

export const refreshToken = async (req, res) => {
  try {
    const cookies = req.headers.cookie ? parseCookies(req.headers.cookie) : {};
    const token = cookies.refreshToken;
    if (!token) {
      return sendError(res, 401, 'No refresh token', "no_refresh_token");
    }
    const decoded = jwt.verify(token, getRefreshSecret());
    if (!decoded || decoded.tokenType !== 'refresh' || !decoded.userId) {
      return sendError(res, 401, 'Invalid refresh token', "invalid_refresh_token");
    }
    const user = await User.findById(decoded.userId);
    if (!user) {
      return sendError(res, 401, 'User not found', "user_not_found");
    }
    const newAccess = issueAccessToken(user);
    // Optionally rotate refresh
    const newRefresh = issueRefreshToken(user);
    setRefreshCookie(res, newRefresh);
    return res.json({ 
      success: true,
      token: newAccess 
    });
  } catch (err) {
    return sendError(res, 401, 'Failed to refresh token', "refresh_failed");
  }
};

export const logout = (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/auth', httpOnly: true, secure: true, sameSite: 'none' });
  return res.json({ 
    success: true,
    message: 'Logged out' 
  });
};
