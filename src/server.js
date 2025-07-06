import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import fileUpload from "express-fileupload";
import connectDB from "./config/db.js";
import jobRequestRoutes from "./routes/jobRequests.js";
import authRoutes from "./routes/auth.js";
import statsRoutes from "./routes/statsRoutes.js";
import healthRoutes from "./routes/health.js";
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import taskerRoutes from './routes/taskerRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { verifyToken, authorize } from "./middleware/auth.js";
import path from 'path';

dotenv.config();

const app = express();

// Add CORS middleware with options
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// File upload middleware
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true,
  responseOnLimit: "File size limit has been reached"
}));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Increase JSON body parser limits to handle large base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request/Response Logging Middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  // Log incoming request
  console.log('\n' + '='.repeat(80));
  console.log(`📥 INCOMING REQUEST [${requestId}]`);
  console.log('='.repeat(80));
  console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
  console.log(`🔗 Method: ${req.method}`);
  console.log(`🌐 URL: ${req.originalUrl}`);
  console.log(`📍 IP: ${req.ip || req.connection.remoteAddress}`);
  console.log(`🏷️  User-Agent: ${req.get('User-Agent') || 'Not provided'}`);
  
  // Log headers (excluding sensitive ones)
  const headers = { ...req.headers };
  if (headers.authorization) {
    headers.authorization = headers.authorization.substring(0, 20) + '...';
  }
  console.log(`📋 Headers:`, JSON.stringify(headers, null, 2));
  
  // Log query parameters
  if (Object.keys(req.query).length > 0) {
    console.log(`❓ Query Params:`, JSON.stringify(req.query, null, 2));
  }
  
  // Log request body (excluding sensitive data)
  if (req.body && Object.keys(req.body).length > 0) {
    const body = { ...req.body };
    // Hide sensitive fields
    if (body.password) body.password = '***HIDDEN***';
    if (body.confirmPassword) body.confirmPassword = '***HIDDEN***';
    if (body.currentPassword) body.currentPassword = '***HIDDEN***';
    if (body.newPassword) body.newPassword = '***HIDDEN***';
    console.log(`📦 Request Body:`, JSON.stringify(body, null, 2));
  }
  
  // Store original res.json and res.send methods
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Override res.json to capture response data
  res.json = function(data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log outgoing response
    console.log('\n' + '-'.repeat(80));
    console.log(`📤 OUTGOING RESPONSE [${requestId}]`);
    console.log('-'.repeat(80));
    console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📊 Status: ${res.statusCode}`);
    console.log(`🔗 Method: ${req.method} ${req.originalUrl}`);
    
    // Log response headers
    console.log(`📋 Response Headers:`, JSON.stringify(res.getHeaders(), null, 2));
    
    // Log response data (truncate if too large)
    const responseStr = JSON.stringify(data, null, 2);
    if (responseStr.length > 1000) {
      console.log(`📦 Response Body (truncated):`, responseStr.substring(0, 1000) + '...[TRUNCATED]');
    } else {
      console.log(`📦 Response Body:`, responseStr);
    }
    
    console.log('='.repeat(80) + '\n');
    
    return originalJson.call(this, data);
  };
  
  // Override res.send to capture non-JSON responses
  res.send = function(data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Only log if res.json wasn't called (to avoid double logging)
    if (!res.headersSent || res.get('Content-Type')?.includes('json')) {
      console.log('\n' + '-'.repeat(80));
      console.log(`📤 OUTGOING RESPONSE [${requestId}]`);
      console.log('-'.repeat(80));
      console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`📊 Status: ${res.statusCode}`);
      console.log(`🔗 Method: ${req.method} ${req.originalUrl}`);
      console.log(`📋 Response Headers:`, JSON.stringify(res.getHeaders(), null, 2));
      
      if (typeof data === 'string' && data.length > 1000) {
        console.log(`📦 Response Body (truncated):`, data.substring(0, 1000) + '...[TRUNCATED]');
      } else {
        console.log(`📦 Response Body:`, data);
      }
      
      console.log('='.repeat(80) + '\n');
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Health check routes (public)
app.use("/api", healthRoutes);

// Auth routes (public)
app.use("/api/auth", authRoutes);

// Stats routes (public)
app.use("/api/stats", statsRoutes);

// Task routes - v1 API
app.use("/api/tasks", taskRoutes);

// Jobs routes - GET is public, other operations are protected
app.use("/api/jobs", (req, res, next) => {
  if (req.method === 'GET') {
    next(); // Skip token verification for GET requests
  } else {
    verifyToken(req, res, next); // Apply token verification for other methods
  }
}, jobRequestRoutes);

// User routes - GET is public, other operations are protected
app.use('/api/users', userRoutes);

// Admin routes - all protected
app.use('/api/admin', adminRoutes);

// Tasker routes - mixed access (some public, some protected)
app.use('/api/taskers', taskerRoutes);

// Feedback routes - mixed access (some public, some protected)
app.use('/api/feedback', feedbackRoutes);

// Chat routes - all protected
app.use('/api/chat', chatRoutes);

// Payment routes - mixed access (some public for callbacks, some protected)
app.use('/api/payments', paymentRoutes);

// Add error handling middleware (add this before the app.listen)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Initialize database connection
connectDB();

const PORT = process.env.PORT || 5000;
// Robust ESM main check for nodemon and node
if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Server accessible at http://localhost:${PORT}`);
  });
}

export default app;
