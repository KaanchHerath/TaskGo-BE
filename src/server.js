import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
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
import { securityMiddleware, corsMiddleware } from "./middleware/security.js";
import { fileUploadMiddleware } from "./middleware/fileUpload.js";
import { requestLogger } from "./middleware/logging.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { jobsRouteProtection } from "./middleware/routeProtection.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const server = createServer(app);
const IS_TEST = process.env.NODE_ENV === 'test';

// Socket.IO setup with authentication middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

const io = new Server(server, {
  cors: {
    // Reflect request origin in development; enforce allowlist in production
    origin: (origin, callback) => {
      const isDev = process.env.NODE_ENV !== 'production';
      if (!origin) return callback(null, true);
      if (isDev) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      console.log('❌ Socket connection rejected: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      console.log('❌ Socket connection rejected: Invalid user');
      return next(new Error('Authentication error: Invalid user'));
    }

    // Attach user to socket
    socket.user = user;
    console.log('✅ Socket authenticated for user:', user.fullName, `(${user._id})`);
    
    next();
  } catch (error) {
    console.log('❌ Socket authentication error:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const user = socket.user;
  console.log('🔌 Client connected:', socket.id, 'User:', user.fullName);
  
  // Automatically join user to their personal room for notifications
  socket.join(`user-${user._id}`);
  console.log(`✅ User ${user.fullName} (${user._id}) joined their room`);
  
  // Handle manual user room join (for compatibility)
  socket.on('join-user', (userId) => {
    try {
      // Validate userId
      if (!userId || typeof userId !== 'string') {
        console.log(`❌ Invalid userId provided for room join:`, userId);
        socket.emit('error', { message: 'Invalid user ID' });
        return;
      }
      
      // Verify that the userId matches the authenticated user
      if (userId === user._id.toString()) {
        socket.join(`user-${userId}`);
        console.log(`✅ User ${user.fullName} manually joined their room`);
        socket.emit('join-user-success', { userId, message: 'Successfully joined room' });
      } else {
        console.log(`❌ User ${user.fullName} tried to join room for different user: ${userId}`);
        socket.emit('error', { message: 'Cannot join room for different user' });
      }
    } catch (error) {
      console.error('❌ Error handling join-user:', error);
      socket.emit('error', { message: 'Failed to join user room' });
    }
  });
  
  // Handle typing indicators
  socket.on('typing-indicator', (data) => {
    try {
      const { taskId, senderId, receiverId, isTyping } = data;
      
      // Validate required fields
      if (!taskId || !senderId || !receiverId || typeof isTyping !== 'boolean') {
        console.log(`❌ Invalid typing indicator data:`, data);
        return;
      }
      
      // Verify that the senderId matches the authenticated user
      if (senderId !== user._id.toString()) {
        console.log(`❌ Invalid typing indicator: User ${user._id} tried to send as ${senderId}`);
        return;
      }
      
      // Emit typing indicator to the receiver
      socket.to(`user-${receiverId}`).emit('typing-indicator', {
        taskId,
        senderId,
        receiverId,
        isTyping
      });
      
      console.log(`⌨️ Typing indicator: ${user.fullName} ${isTyping ? 'started' : 'stopped'} typing to ${receiverId}`);
    } catch (error) {
      console.error('❌ Error handling typing indicator:', error);
      socket.emit('error', { message: 'Failed to process typing indicator' });
    }
  });
  
  // Handle socket disconnect
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id, 'User:', user.fullName);
  });
});

// Log engine-level connection errors to diagnose handshake/CORS problems
io.engine.on('connection_error', (err) => {
  console.error('⚠️  Socket.IO engine connection_error:', {
    code: err.code,
    message: err.message,
    context: err.context && {
      name: err.context?.name,
      message: err.context?.message,
      headers: err.context?.headers,
      status: err.context?.status,
      method: err.context?.method,
      url: err.context?.url,
      transport: err.context?.transport,
    }
  });
});

// Make io available to other modules
app.set('io', io);
console.log('🔌 Socket.IO instance set on app:', !!io);

// Security middleware
app.use(securityMiddleware);
app.use(corsMiddleware);

// File upload middleware
app.use(fileUploadMiddleware);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Request logging middleware
app.use(requestLogger);

// API Routes
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/tasks", taskRoutes);

// Jobs routes - GET is public, other operations are protected
app.use("/api/jobs", jobsRouteProtection, jobRequestRoutes);

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/taskers', taskerRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler
app.use('*', notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

// Initialize database connection only outside test environment
if (!IS_TEST) {
  connectDB();
}

// Start server only outside test environment
if (!IS_TEST) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
