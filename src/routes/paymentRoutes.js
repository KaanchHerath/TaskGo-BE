import express from 'express';
import {
  initiateAdvancePayment,
  handlePaymentNotification,
  handlePaymentReturn,
  handlePaymentCancel,
  releaseAdvancePayment,
  getTaskPayments,
  getMyPayments
} from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes (PayHere callbacks)
router.post('/notify', handlePaymentNotification);
router.get('/return', handlePaymentReturn);
router.get('/cancel', handlePaymentCancel);

// Protected routes
router.use(protect);

// Payment management
router.post('/initiate-advance', initiateAdvancePayment);
router.post('/release-advance', releaseAdvancePayment);
router.get('/task/:taskId', getTaskPayments);
router.get('/my-payments', getMyPayments);

export default router; 