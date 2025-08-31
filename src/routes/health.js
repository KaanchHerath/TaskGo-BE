import express from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/health
// @desc    Health check endpoint
// @access  Public
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// @route   GET /api/health/websocket
// @desc    Test WebSocket connection
// @access  Public
router.get('/websocket', (req, res) => {
  const io = req.app.get('io');
  
  if (io) {
    // Test emit to all connected clients
    io.emit('test-message', {
      message: 'WebSocket test message',
      timestamp: new Date().toISOString()
    });
    
    res.status(200).json({
      success: true,
      message: 'WebSocket test message sent',
      ioAvailable: true
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'WebSocket not available',
      ioAvailable: false
    });
  }
});

// @route   POST /api/health/websocket-test
// @desc    Test WebSocket with specific user
// @access  Private
router.post('/websocket-test', verifyToken, (req, res) => {
  const { userId, message } = req.body;
  const io = req.app.get('io');
  
  if (io && userId) {
    // Test emit to specific user room
    io.to(`user-${userId}`).emit('test-message', {
      message: message || 'Test message from admin',
      timestamp: new Date().toISOString(),
      from: 'admin'
    });
    
    res.status(200).json({
      success: true,
      message: 'WebSocket test message sent to user',
      userId,
      ioAvailable: true
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'WebSocket not available or userId missing',
      ioAvailable: !!io,
      userId: !!userId
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host || 'unknown',
      port: mongoose.connection.port || 'unknown',
      name: mongoose.connection.name || 'unknown'
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  };

  const statusCode = health.database.status === 'connected' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Database connection test endpoint
router.get('/health/db', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'error',
        message: 'Database not connected',
        readyState: mongoose.connection.readyState,
        timestamp: new Date().toISOString()
      });
    }

    // Test a simple query
    const startTime = Date.now();
    const collections = await mongoose.connection.db.listCollections().toArray();
    const queryTime = Date.now() - startTime;

    res.json({
      status: 'success',
      message: 'Database connection is healthy',
      readyState: mongoose.connection.readyState,
      collections: collections.map(c => c.name),
      queryTime: `${queryTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Database test failed',
      error: error.message,
      readyState: mongoose.connection.readyState,
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 