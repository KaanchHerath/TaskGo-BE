import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: [true, 'Task is required']
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer is required']
  },
  tasker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tasker is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [1, 'Payment amount must be at least $1']
  },
  paymentType: {
    type: String,
    enum: {
      values: ['advance', 'final'],
      message: 'Invalid payment type'
    },
    required: [true, 'Payment type is required']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
      message: 'Invalid payment status'
    },
    default: 'pending'
  },
  // PayHere specific fields
  payherePaymentId: {
    type: String,
    trim: true
  },
  payhereOrderId: {
    type: String,
    trim: true,
    required: [true, 'PayHere order ID is required']
  },
  payhereMerchantId: {
    type: String,
    trim: true
  },
  payhereAmount: {
    type: Number,
    required: [true, 'PayHere amount is required']
  },
  payhereCurrency: {
    type: String,
    default: 'LKR'
  },
  payhereMethod: {
    type: String,
    trim: true
  },
  payhereStatus: {
    type: String,
    trim: true
  },
  payhereStatusCode: {
    type: String,
    trim: true
  },
  payhereMd5sig: {
    type: String,
    trim: true
  },
  // Additional fields
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  failureReason: {
    type: String,
    trim: true
  },
  processedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  refundAmount: {
    type: Number,
    min: [0, 'Refund amount cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
paymentSchema.index({ task: 1, paymentType: 1 });
paymentSchema.index({ customer: 1, status: 1 });
paymentSchema.index({ tasker: 1, status: 1 });
paymentSchema.index({ payhereOrderId: 1 }, { unique: true });
paymentSchema.index({ payherePaymentId: 1 });
paymentSchema.index({ createdAt: -1 });

// Instance methods
paymentSchema.methods.isAdvancePayment = function() {
  return this.paymentType === 'advance';
};

paymentSchema.methods.isFinalPayment = function() {
  return this.paymentType === 'final';
};

paymentSchema.methods.canBeRefunded = function() {
  return this.status === 'completed' && !this.refundedAt;
};

// Static methods
paymentSchema.statics.getPaymentsByTask = function(taskId) {
  return this.find({ task: taskId })
    .populate('customer', 'fullName email')
    .populate('tasker', 'fullName email')
    .sort({ createdAt: -1 });
};

paymentSchema.statics.getPaymentsByCustomer = function(customerId) {
  return this.find({ customer: customerId })
    .populate('task', 'title category')
    .populate('tasker', 'fullName email')
    .sort({ createdAt: -1 });
};

paymentSchema.statics.getPaymentsByTasker = function(taskerId) {
  return this.find({ tasker: taskerId })
    .populate('task', 'title category')
    .populate('customer', 'fullName email')
    .sort({ createdAt: -1 });
};

export default mongoose.model('Payment', paymentSchema);
