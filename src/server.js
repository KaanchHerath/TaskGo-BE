import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
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
import { securityMiddleware, corsMiddleware, rateLimiter, authRateLimiter } from "./middleware/security.js";
import { fileUploadMiddleware } from "./middleware/fileUpload.js";
import { requestLogger } from "./middleware/logging.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { jobsRouteProtection } from "./middleware/routeProtection.js";

dotenv.config();

const app = express();

// Security middleware
app.use(securityMiddleware);
app.use(corsMiddleware);

// Rate limiting
app.use(rateLimiter);

// File upload middleware
app.use(fileUploadMiddleware);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use(requestLogger);

// API Routes
app.use("/api", healthRoutes);
app.use("/api/auth", authRateLimiter, authRoutes);
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

// Initialize database connection
connectDB();

const PORT = process.env.PORT || 5000;

// Start server
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(` Server running on port ${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Server accessible at http://localhost:${PORT}`);
  });
}

export default app;
