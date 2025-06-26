import express from 'express';
import {
  createFeedback,
  getUserFeedback,
  getUserRatingSummary
} from '../controllers/feedbackController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Create feedback (requires authentication)
router.post('/', verifyToken, createFeedback);

// Get feedback for a specific user (public)
router.get('/user/:userId', getUserFeedback);

// Get user rating summary (public)
router.get('/rating-summary/:userId', getUserRatingSummary);

export default router; 