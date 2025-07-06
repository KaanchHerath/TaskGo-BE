import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

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