import express from 'express';
import {
  createTask,
  getTasks,
  getTask,
  applyForTask,
  getTaskApplications,
  selectTasker,
  confirmTime,
  confirmSchedule,
  completeTask,
  taskerCompleteTask,
  markTaskComplete,
  cancelScheduledTask,
  uploadTaskPhotos,
  uploadCompletionPhoto,
  getMyTasks,
  getMyApplications,
  getTasksByCustomerId,
  getCategoryStats
} from '../controllers/taskController.js';
import { verifyToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getTasks);
router.get('/category-stats', getCategoryStats);
router.get('/customer/:customerId', getTasksByCustomerId);

// Protected routes
router.get('/my-tasks', verifyToken, getMyTasks);
router.get('/my-applications', verifyToken, getMyApplications);

router.get('/:id', optionalAuth, getTask);

router.use(verifyToken);

// Task management
router.post('/', createTask);

// Task applications
router.post('/:id/apply', applyForTask);
router.get('/:id/applications', getTaskApplications);

// Task workflow
router.post('/:id/select-tasker', selectTasker);
router.post('/:id/confirm-time', confirmTime);
router.post('/:id/confirm-schedule', confirmSchedule);
router.post('/:id/complete', completeTask);
router.post('/:id/tasker-complete', taskerCompleteTask);
router.post('/:id/mark-complete', markTaskComplete);
router.post('/:id/cancel-schedule', cancelScheduledTask);
router.post('/upload-photos', uploadTaskPhotos);
router.post('/upload-completion-photo', uploadCompletionPhoto);

export default router; 