import express from "express";
import cookieParser from "cookie-parser";
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
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { jobsRouteProtection } from "./middleware/routeProtection.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const server = createServer(app);

// Socket.IO setup with authentication middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

const io = new Server(server, {
  cors: {
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
      return next(new Error('Authentication error: No token provided'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return next(new Error('Authentication error: Invalid user'));
    }
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
});


io.on('connection', (socket) => {
  const user = socket.user;
  console.log('🔌 Client connected:', socket.id, 'User:', user.fullName); 
  socket.join(`user-${user._id}`);
  socket.on('join-user', (userId) => {
    try {
      if (!userId || typeof userId !== 'string') {
        socket.emit('error', { message: 'Invalid user ID' });
        return;
      }
      if (userId === user._id.toString()) {
        socket.join(`user-${userId}`);
        socket.emit('join-user-success', { userId, message: 'Successfully joined room' });
      } else {
        socket.emit('error', { message: 'Cannot join room for different user' });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to join user room' });
    }
  });
  
  socket.on('typing-indicator', (data) => {
    try {
      const { taskId, senderId, receiverId, isTyping } = data;
      socket.to(`user-${receiverId}`).emit('typing-indicator', {
        taskId,
        senderId,
        receiverId,
        isTyping
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to process typing indicator' });
    }
  });

});

app.set('io', io);

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


connectDB();
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
export default app;
