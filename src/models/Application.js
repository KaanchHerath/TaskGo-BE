import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: [true, 'Task is required']
  },
  tasker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tasker is required']
  },
  proposedPayment: {
    type: Number,
    required: [true, 'Proposed payment is required'],
    min: [1, 'Proposed payment must be at least $1']
  },
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'rejected'],
      message: 'Invalid application status'
    },
    default: 'pending'
  },
  estimatedDuration: {
    type: Number, // in hours
    min: [0.5, 'Estimated duration must be at least 0.5 hours']
  },
  availableStartDate: {
    type: Date
  },
  availableEndDate: {
    type: Date
  },
  confirmedByTasker: {
    type: Boolean,
    default: false
  },
  confirmedTime: {
    type: Date
  },
  confirmedPayment: {
    type: Number,
    min: [1, 'Confirmed payment must be at least $1']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index to prevent duplicate applications
applicationSchema.index({ task: 1, tasker: 1 }, { unique: true });

// Other indexes
applicationSchema.index({ task: 1, status: 1 });
applicationSchema.index({ tasker: 1, status: 1 });
applicationSchema.index({ createdAt: -1 });

// Validation to ensure tasker doesn't apply to their own task
applicationSchema.pre('save', async function(next) {
  if (this.isNew) {
    const task = await mongoose.model('Task').findById(this.task);
    if (task && task.customer.toString() === this.tasker.toString()) {
      return next(new Error('Cannot apply to your own task'));
    }
    
    // Validate proposed payment is within task range
    if (task && (this.proposedPayment < task.minPayment || this.proposedPayment > task.maxPayment)) {
      return next(new Error(`Proposed payment must be between $${task.minPayment} and $${task.maxPayment}`));
    }
    
    // Check if task is still active
    if (task && task.status !== 'active') {
      return next(new Error('Cannot apply to inactive task'));
    }
  }
  next();
});

// Instance methods
applicationSchema.methods.canBeConfirmed = function() {
  return this.status === 'pending';
};

applicationSchema.methods.canBeRejected = function() {
  return this.status === 'pending';
};

applicationSchema.methods.canBeConfirmedByTasker = function() {
  return this.status === 'pending' && !this.confirmedByTasker;
};

// Static methods
applicationSchema.statics.getApplicationsForTask = function(taskId, status = null) {
  const query = { task: taskId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('tasker', 'fullName email phone skills rating')
    .sort({ createdAt: -1 });
};

applicationSchema.statics.getApplicationsByTasker = function(taskerId, status = null) {
  const query = { tasker: taskerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('task', 'title category area startDate endDate minPayment maxPayment status')
    .populate({
      path: 'task',
      populate: {
        path: 'customer',
        select: 'fullName email'
      }
    })
    .sort({ createdAt: -1 });
};

applicationSchema.statics.getTaskerApplicationForTask = function(taskId, taskerId) {
  return this.findOne({ task: taskId, tasker: taskerId })
    .populate('task', 'title category area startDate endDate')
    .populate('tasker', 'fullName email phone');
};

export default mongoose.model('Application', applicationSchema); 