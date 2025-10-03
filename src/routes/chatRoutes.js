import express from 'express';
import {
  sendMessage,
  getConversation,
  getUnreadCount,
  markMessagesAsRead
} from '../controllers/chatController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();


router.use(verifyToken);
router.post('/', sendMessage);
router.get('/unread-count', getUnreadCount);
router.get('/:taskId/:userId', getConversation);
router.put('/:taskId/mark-read', markMessagesAsRead);

export default router; 