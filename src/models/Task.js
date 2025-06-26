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
        return value >= this.minPayment;
      },
      message: 'Maximum payment must be greater than or equal to minimum payment'
    }
  },
  agreedPayment: {
    type: Number,
    min: [1, 'Agreed payment must be at least $1'],
    validate: {
      validator: function(value) {
        if (value && this.minPayment && this.maxPayment) {
          return value >= this.minPayment && value <= this.maxPayment;
        }
        return true;
      },
      message: 'Agreed payment must be between minimum and maximum payment'
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
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(value);
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
  completionPhotos: [{
    type: String,
    validate: {
      validator: function(value) {
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(value);
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
taskSchema.index({ category: 1, status: 1 });
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
  .sort({ createdAt: -1 })
  .limit(limit);
};

taskSchema.statics.getTasksByCustomer = function(customerId, status = null) {
  const query = { customer: customerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('selectedTasker', 'fullName email phone')
    .sort({ createdAt: -1 });
};

taskSchema.statics.getTasksByTasker = function(taskerId, status = null) {
  const query = { selectedTasker: taskerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('customer', 'fullName email phone')
    .sort({ createdAt: -1 });
};

export default mongoose.model('Task', taskSchema); 