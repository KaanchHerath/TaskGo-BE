import express from 'express';
import {
  sendMessage,
  getConversation,
  getUnreadCount,
  markMessagesAsRead
} from '../controllers/chatController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// All chat routes require authentication
router.use(verifyToken);

// @route   POST /api/v1/chat
// @desc    Send a new chat message
// @access  Private
router.post('/', sendMessage);

// @route   GET /api/v1/chat/unread-count
// @desc    Get unread message count for the authenticated user
// @access  Private
router.get('/unread-count', getUnreadCount);

// @route   GET /api/v1/chat/:taskId/:userId
// @desc    Get conversation between authenticated user and specified user for a task
// @access  Private
router.get('/:taskId/:userId', getConversation);

// @route   PUT /api/v1/chat/:taskId/mark-read
// @desc    Mark all messages as read for a specific task
// @access  Private
router.put('/:taskId/mark-read', markMessagesAsRead);

export default router; 