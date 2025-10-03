import express from 'express';
import {
  createFeedback,
  getUserFeedback,
  getUserRatingSummary,
  getRecentReviews
} from '../controllers/feedbackController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
router.post('/', verifyToken, createFeedback);
router.get('/user/:userId', getUserFeedback);
router.get('/rating-summary/:userId', getUserRatingSummary);
router.get('/recent-reviews', getRecentReviews);

export default router; 