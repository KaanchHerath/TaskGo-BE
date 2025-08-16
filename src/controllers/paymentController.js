import Payment from '../models/Payment.js';
import Task from '../models/Task.js';
import crypto from 'crypto';
import dotenv from "dotenv";

dotenv.config();

// PayHere Configuration
const PAYHERE_CONFIG = {
  MERCHANT_ID: process.env.PAYHERE_MERCHANT_ID,
  MERCHANT_SECRET: process.env.PAYHERE_MERCHANT_SECRET,
  SANDBOX_URL: 'https://sandbox.payhere.lk/pay/checkout',
  LIVE_URL: 'https://www.payhere.lk/pay/checkout',
  NOTIFY_URL: process.env.PAYHERE_NOTIFY_URL ,
  RETURN_URL: process.env.PAYHERE_RETURN_URL ,
  CANCEL_URL: process.env.PAYHERE_CANCEL_URL 
};

// Debug: Log configuration on module load
console.log('PayHere Configuration loaded:', {
  MERCHANT_ID: PAYHERE_CONFIG.MERCHANT_ID ? 'SET' : 'NOT SET',
  MERCHANT_SECRET: PAYHERE_CONFIG.MERCHANT_SECRET ? 'SET' : 'NOT SET',
  NODE_ENV: process.env.NODE_ENV,
  NOTIFY_URL: PAYHERE_CONFIG.NOTIFY_URL,
  RETURN_URL: PAYHERE_CONFIG.RETURN_URL,
  CANCEL_URL: PAYHERE_CONFIG.CANCEL_URL
});

// @desc    Initialize advance payment
// @route   POST /api/payments/initiate-advance
// @access  Private (Customer only)
export const initiateAdvancePayment = async (req, res) => {
  try {
    // Debug: Log current configuration state
    console.log('Payment initiation - Current config:', {
      MERCHANT_ID: PAYHERE_CONFIG.MERCHANT_ID ? 'SET' : 'NOT SET',
      MERCHANT_SECRET: PAYHERE_CONFIG.MERCHANT_SECRET ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
      PAYHERE_MERCHANT_ID_ENV: process.env.PAYHERE_MERCHANT_ID ? 'SET' : 'NOT SET',
      PAYHERE_MERCHANT_SECRET_ENV: process.env.PAYHERE_MERCHANT_SECRET ? 'SET' : 'NOT SET'
    });

    // Check if PayHere credentials are configured
    if (!PAYHERE_CONFIG.MERCHANT_ID || !PAYHERE_CONFIG.MERCHANT_SECRET) {
      console.error('PayHere credentials not configured:', {
        MERCHANT_ID: !!PAYHERE_CONFIG.MERCHANT_ID,
        MERCHANT_SECRET: !!PAYHERE_CONFIG.MERCHANT_SECRET,
        MERCHANT_ID_VALUE: PAYHERE_CONFIG.MERCHANT_ID,
        MERCHANT_SECRET_VALUE: PAYHERE_CONFIG.MERCHANT_SECRET ? 'HIDDEN' : 'NOT SET'
      });
      return res.status(500).json({
        success: false,
        message: 'Payment gateway not configured. Please contact support.'
      });
    }

    const { taskId, applicationId } = req.body;

    // Verify user is customer
    if (req.user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Only customers can initiate payments'
      });
    }

    // Find the task
    const task = await Task.findById(taskId).populate('customer selectedTasker');
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Verify the customer owns the task
    if (task.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only pay for your own tasks'
      });
    }

    // Check if task is in correct status
    if (task.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Task is not available for payment'
      });
    }

    // Check if task has a selected tasker
    if (!task.selectedTasker) {
      return res.status(400).json({
        success: false,
        message: 'No tasker has been selected for this task'
      });
    }

    // Check if payment is already completed
    if (task.advancePaymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Advance payment has already been completed for this task'
      });
    }

    // Calculate advance payment (20% of agreed payment)
    const advanceAmount = Math.round(task.agreedPayment * 0.2);
    
    // Generate unique order ID
    const orderId = `TASK_${taskId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment record
    const payment = new Payment({
      task: taskId,
      customer: req.user._id,
      tasker: task.selectedTasker._id,
      amount: advanceAmount,
      paymentType: 'advance',
      status: 'pending',
      payhereOrderId: orderId,
      payhereAmount: advanceAmount,
      payhereCurrency: 'LKR',
      description: `Advance payment for task: ${task.title}`
    });

    // Calculate platform commission (10% of advance payment)
    payment.calculatePlatformCommission();

    await payment.save();

    // Prepare PayHere payment data
    const paymentData = {
      merchant_id: PAYHERE_CONFIG.MERCHANT_ID,
      return_url: PAYHERE_CONFIG.RETURN_URL,
      cancel_url: PAYHERE_CONFIG.CANCEL_URL,
      notify_url: PAYHERE_CONFIG.NOTIFY_URL,
      order_id: orderId,
      items: `Advance Payment - ${task.title}`,
      currency: 'LKR',
      amount: advanceAmount,
      first_name: req.user.fullName?.split(' ')[0] || req.user.name?.split(' ')[0] || 'Customer',
      last_name: req.user.fullName?.split(' ').slice(1).join(' ') || req.user.name?.split(' ').slice(1).join(' ') || '',
      email: req.user.email,
      phone: req.user.phone || '',
      address: task.area,
      city: task.area,
      country: 'Sri Lanka',
      custom_1: taskId,
      custom_2: applicationId || '',
      custom_3: 'advance_payment'
    };

    // Generate MD5 signature
    const signatureString = Object.keys(paymentData)
      .sort()
      .map(key => `${key}=${paymentData[key]}`)
      .join('&') + PAYHERE_CONFIG.MERCHANT_SECRET;

    const md5sig = crypto.createHash('md5').update(signatureString).digest('hex').toUpperCase();

    // Generate PayHere hash value as required by JavaScript SDK
    // hash = to_upper_case(md5(merchant_id + order_id + amount + currency + to_upper_case(md5(merchant_secret))))
    const merchantSecretHash = crypto.createHash('md5').update(PAYHERE_CONFIG.MERCHANT_SECRET).digest('hex').toUpperCase();
    const hashString = PAYHERE_CONFIG.MERCHANT_ID + orderId + advanceAmount.toFixed(2) + 'LKR' + merchantSecretHash;
    const hash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

    // Debug hash generation
    console.log('Hash generation debug:', {
      merchantId: PAYHERE_CONFIG.MERCHANT_ID,
      orderId,
      amount: advanceAmount.toFixed(2),
      currency: 'LKR',
      merchantSecretHash,
      hashString,
      finalHash: hash
    });

    // Add signature to payment data
    paymentData.md5sig = md5sig;

    // Update task with advance payment info
    task.advancePayment = advanceAmount;
    task.advancePaymentStatus = 'pending';
    task.paymentId = orderId;
    await task.save();

    // Determine which PayHere URL to use based on environment
    const paymentUrl = process.env.NODE_ENV === 'production' ? PAYHERE_CONFIG.LIVE_URL : PAYHERE_CONFIG.SANDBOX_URL;

    console.log('Payment initiated successfully:', {
      orderId,
      amount: advanceAmount,
      merchantId: PAYHERE_CONFIG.MERCHANT_ID,
      paymentUrl,
      environment: process.env.NODE_ENV
    });

    res.status(200).json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        paymentUrl,
        paymentData,
        orderId,
        amount: advanceAmount,
        hash // Return the hash for frontend PayHere SDK
      }
    });

  } catch (error) {
    console.error('Initiate advance payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while initiating payment'
    });
  }
};

// @desc    Handle PayHere payment notification
// @route   POST /api/payments/notify
// @access  Public
export const handlePaymentNotification = async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      method,
      status_message,
      card_holder_name,
      card_no,
      card_expiry
    } = req.body;

    console.log('PayHere Notification:', req.body);

    // Verify merchant ID
    if (merchant_id !== PAYHERE_CONFIG.MERCHANT_ID) {
      return res.status(400).json({ error: 'Invalid merchant ID' });
    }

    // Find payment by order ID
    const payment = await Payment.findOne({ payhereOrderId: order_id });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify MD5 signature
    const receivedMd5sig = md5sig;
    const calculatedMd5sig = crypto.createHash('md5')
      .update(Object.keys(req.body)
        .filter(key => key !== 'md5sig')
        .sort()
        .map(key => `${key}=${req.body[key]}`)
        .join('&') + PAYHERE_CONFIG.MERCHANT_SECRET)
      .digest('hex')
      .toUpperCase();

    if (receivedMd5sig !== calculatedMd5sig) {
      console.error('MD5 signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Update payment record
    payment.payherePaymentId = payment_id;
    payment.payhereStatus = status_message;
    payment.payhereStatusCode = status_code;
    payment.payhereMethod = method;
    payment.payhereAmount = payhere_amount;
    payment.payhereCurrency = payhere_currency;

    if (status_code === '2') {
      // Payment successful
      payment.status = 'completed';
      payment.processedAt = new Date();

      // Update task
      const task = await Task.findById(payment.task);
      if (task) {
        task.advancePaymentStatus = 'paid';
        task.advancePaymentDate = new Date();
        task.status = 'scheduled';
        await task.save();
        
        console.log('Task scheduled after successful payment:', {
          taskId: task._id,
          orderId: order_id,
          paymentId: payment_id
        });
      }
    } else {
      // Payment failed
      payment.status = 'failed';
      payment.failureReason = status_message;
      
      // Reset task status if payment failed
      const task = await Task.findById(payment.task);
      if (task && task.status === 'active' && task.advancePaymentStatus === 'pending') {
        // Keep task as active, but clear payment-related fields
        task.advancePaymentStatus = null;
        task.advancePayment = null;
        task.paymentId = null;
        // Note: We keep selectedTasker and agreedPayment so customer can retry payment
        await task.save();
        
        console.log('Task reset to active after payment failure:', {
          taskId: task._id,
          orderId: order_id,
          failureReason: status_message
        });
      }
    }

    await payment.save();

    // Return success to PayHere
    res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('Payment notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// @desc    Handle payment return (success)
// @route   GET /api/payments/return
// @access  Public
export const handlePaymentReturn = async (req, res) => {
  try {
    const { order_id, payment_id, status_code } = req.query;

    if (status_code === '2') {
      // Payment successful
      res.redirect(`${process.env.FRONTEND_URL}/payment/success?order_id=${order_id}&payment_id=${payment_id}`);
    } else {
      // Payment failed
      res.redirect(`${process.env.FRONTEND_URL}/payment/failed?order_id=${order_id}&reason=payment_failed`);
    }

  } catch (error) {
    console.error('Payment return error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=server_error`);
  }
};

// @desc    Handle payment cancel
// @route   GET /api/payments/cancel
// @access  Public
export const handlePaymentCancel = async (req, res) => {
  try {
    const { order_id } = req.query;
    
    // Find the payment and update its status
    const payment = await Payment.findOne({ payhereOrderId: order_id });
    if (payment) {
      payment.status = 'cancelled';
      await payment.save();

      // Reset task status back to active if payment was cancelled
      const task = await Task.findById(payment.task);
      if (task && task.status === 'active' && task.advancePaymentStatus === 'pending') {
        // Keep task as active, but clear payment-related fields
        task.advancePaymentStatus = null;
        task.advancePayment = null;
        task.paymentId = null;
        // Note: We keep selectedTasker and agreedPayment so customer can retry payment
        await task.save();
        
        console.log('Task reset to active after payment cancellation:', {
          taskId: task._id,
          orderId: order_id
        });
      }
    }

    res.redirect(`${process.env.FRONTEND_URL}/payment/cancelled?order_id=${order_id}`);

  } catch (error) {
    console.error('Payment cancel error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/cancelled?reason=server_error`);
  }
};

// @desc    Release advance payment to tasker
// @route   POST /api/payments/release-advance
// @access  Private (System/Admin only)
export const releaseAdvancePayment = async (req, res) => {
  try {
    const { taskId } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.advancePaymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Advance payment not paid'
      });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Task must be completed before releasing advance payment'
      });
    }

    // Update task advance payment status
    task.advancePaymentStatus = 'released';
    task.advancePaymentReleasedAt = new Date();
    await task.save();

    // Update payment record
    await Payment.findOneAndUpdate(
      { task: taskId, paymentType: 'advance' },
      { 
        status: 'completed',
        processedAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      message: 'Advance payment released successfully'
    });

  } catch (error) {
    console.error('Release advance payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while releasing payment'
    });
  }
};

// @desc    Get payment history for a task
// @route   GET /api/payments/task/:taskId
// @access  Private
export const getTaskPayments = async (req, res) => {
  try {
    const { taskId } = req.params;

    const payments = await Payment.getPaymentsByTask(taskId);

    res.status(200).json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get task payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payments'
    });
  }
};

// @desc    Get user's payment history
// @route   GET /api/payments/my-payments
// @access  Private
export const getMyPayments = async (req, res) => {
  try {
    let payments;
    
    if (req.user.role === 'customer') {
      payments = await Payment.getPaymentsByCustomer(req.user._id);
    } else if (req.user.role === 'tasker') {
      payments = await Payment.getPaymentsByTasker(req.user._id);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Invalid user role'
      });
    }

    res.status(200).json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get my payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payments'
    });
  }
}; 

// @desc    Check payment status by order ID
// @route   GET /api/payments/status/:orderId
// @access  Public
export const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find payment by order ID
    const payment = await Payment.findOne({ payhereOrderId: orderId });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Return payment status
    res.status(200).json({
      success: true,
      data: {
        orderId: payment.payhereOrderId,
        paymentStatus: payment.status,
        amount: payment.amount,
        taskId: payment.task,
        processedAt: payment.processedAt
      }
    });

  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking payment status'
    });
  }
}; 