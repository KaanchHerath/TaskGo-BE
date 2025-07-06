import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    enum: {
      values: [
        'Home Maintenance', 'Cleaning', 'Moving', 'Handyman', 'Gardening',
        'Painting', 'Plumbing', 'Electrical', 'Carpentry', 'Assembly',
        'Delivery', 'Personal Assistant', 'Pet Care', 'Tutoring', 'Other'
      ],
      message: 'Invalid category selected'
    }
  },
  minPayment: {
    type: Number,
    required: [true, 'Minimum payment is required'],
    min: [1, 'Minimum payment must be at least $1']
  },
  maxPayment: {
    type: Number,
    required: [true, 'Maximum payment is required'],
    min: [1, 'Maximum payment must be at least $1'],
    validate: {
      validator: function(value) {
        // Check if minPayment exists and is a valid number
        if (this.minPayment && typeof this.minPayment === 'number' && typeof value === 'number') {
          return value >= this.minPayment;
        }
        return true; // Allow validation to pass if minPayment is not set yet
      },
      message: 'Maximum payment must be greater than or equal to minimum payment'
    }
  },
  agreedPayment: {
    type: Number,
    min: [1, 'Agreed payment must be at least $1'],
    validate: {
      validator: function(value) {
        // Allow agreed payment to be set during tasker selection
        // The original min/max payment range is just for initial task posting
        // The agreed payment can be negotiated between customer and tasker
        if (value && value < 1) {
          return false;
        }
        return true;
      },
      message: 'Agreed payment must be at least $1'
    }
  },
  agreedTime: {
    type: Date,
    validate: {
      validator: function(value) {
        if (value && this.startDate && this.endDate) {
          return value >= this.startDate && value <= this.endDate;
        }
        return true;
      },
      message: 'Agreed time must be between start date and end date'
    }
  },
  area: {
    type: String,
    required: [true, 'Area is required'],
    trim: true,
    enum: {
      values: [
        'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
        'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
        'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee',
        'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla',
        'Moneragala', 'Ratnapura', 'Kegalle'
      ],
      message: 'Invalid area selected'
    }
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    validate: {
      validator: function(value) {
        if (!value) return true; // Let required validation handle this
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return value >= today;
      },
      message: 'Start date must be today or in the future'
    }
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        if (!value || !this.startDate) return true; // Let required validation handle this
        return value >= this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  photos: [{
    type: String,
    validate: {
      validator: function(value) {
        if (!value || value.trim() === '') return true; // Allow empty strings
        // Allow http/https URLs and data URLs
        return /^(https?:\/\/.+\.(jpg|jpeg|png|gif|webp)|data:image\/)/.test(value);
      },
      message: 'Invalid photo URL format'
    }
  }],
  status: {
    type: String,
    enum: {
      values: ['active', 'scheduled', 'completed', 'cancelled'],
      message: 'Invalid status'
    },
    default: 'active'
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer is required']
  },
  selectedTasker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  targetedTasker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isTargeted: {
    type: Boolean,
    default: false
  },
  completionPhotos: [{
    type: String,
    validate: {
      validator: function(value) {
        if (!value || value.trim() === '') return true; // Allow empty strings
        // Allow http/https URLs, blob URLs, and data URLs
        return /^(https?:\/\/.+\.(jpg|jpeg|png|gif|webp)|blob:http|data:image)/.test(value);
      },
      message: 'Invalid completion photo URL format'
    }
  }],
  customerRating: {
    type: Number,
    min: 1,
    max: 5
  },
  customerReview: {
    type: String,
    trim: true,
    maxlength: [500, 'Review cannot exceed 500 characters']
  },
  taskerConfirmed: {
    type: Boolean,
    default: false
  },
  completionNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Completion notes cannot exceed 500 characters']
  },
  taskerCompletedAt: {
    type: Date
  },
  customerCompletedAt: {
    type: Date
  },
  taskerFeedback: {
    type: String,
    trim: true,
    maxlength: [500, 'Tasker feedback cannot exceed 500 characters']
  },
  taskerRatingForCustomer: {
    type: Number,
    min: 1,
    max: 5
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: {
    type: Date
  },
  // Payment related fields
  advancePayment: {
    type: Number,
    min: [0, 'Advance payment cannot be negative']
  },
  advancePaymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'paid', 'released', 'refunded'],
      message: 'Invalid advance payment status'
    },
    default: 'pending'
  },
  advancePaymentDate: {
    type: Date
  },
  advancePaymentReleasedAt: {
    type: Date
  },
  paymentId: {
    type: String,
    trim: true
  },
  paymentReference: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
taskSchema.index({ status: 1, area: 1 });
taskSchema.index({ customer: 1, status: 1 });
taskSchema.index({ selectedTasker: 1, status: 1 });
taskSchema.index({ targetedTasker: 1, status: 1 });
taskSchema.index({ category: 1, status: 1 });
taskSchema.index({ isTargeted: 1, status: 1 });
taskSchema.index({ createdAt: -1 });

// Virtual for application count
taskSchema.virtual('applicationCount', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'task',
  count: true
});

// Virtual for applications
taskSchema.virtual('applications', {
  ref: 'Application',
  localField: '_id',
  foreignField: 'task'
});

// Virtual for posted date (alias for createdAt)
taskSchema.virtual('postedDate').get(function() {
  return this.createdAt;
});

// Pre-save middleware
taskSchema.pre('save', function(next) {
  // Validate payment range when both min and max payment are set
  if (this.minPayment && this.maxPayment && this.minPayment >= this.maxPayment) {
    return next(new Error('Maximum payment must be greater than minimum payment'));
  }
  
  if (this.isModified('status') && this.status === 'scheduled') {
    if (!this.selectedTasker) {
      return next(new Error('Selected tasker is required when status is scheduled'));
    }
    if (!this.agreedPayment) {
      return next(new Error('Agreed payment is required when status is scheduled'));
    }
    if (!this.agreedTime) {
      return next(new Error('Agreed time is required when status is scheduled'));
    }
  }
  next();
});

// Instance methods
taskSchema.methods.canBeAppliedTo = function() {
  return this.status === 'active' && this.startDate > new Date();
};

taskSchema.methods.canBeScheduled = function() {
  return this.status === 'active';
};

taskSchema.methods.canBeCompleted = function() {
  return this.status === 'scheduled' && this.taskerConfirmed;
};

// Static methods
taskSchema.statics.getActiveTasksInArea = function(area, limit = 10) {
  return this.find({ 
    status: 'active', 
    area: area,
    startDate: { $gt: new Date() }
  })
  .populate('customer', 'fullName email')
  .populate('selectedTasker', 'fullName email phone')
  .populate('targetedTasker', 'fullName email phone')
  .sort({ createdAt: -1 })
  .limit(limit);
};

taskSchema.statics.getTasksByCustomer = function(customerId, status = null) {
  const query = { customer: customerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('selectedTasker', 'fullName email phone')
    .populate('targetedTasker', 'fullName email phone')
    .sort({ createdAt: -1 });
};

taskSchema.statics.getTasksByTasker = function(taskerId, status = null) {
  // Include both tasks where tasker is selected AND tasks targeted to this tasker
  const baseQuery = {
    $or: [
      { selectedTasker: taskerId },
      { targetedTasker: taskerId, isTargeted: true }
    ]
  };
  
  const query = status ? { ...baseQuery, status } : baseQuery;
  
  return this.find(query)
    .populate('customer', 'fullName email phone')
    .populate('selectedTasker', 'fullName email phone')
    .populate('targetedTasker', 'fullName email phone')
    .sort({ createdAt: -1 });
};

export default mongoose.model('Task', taskSchema); 