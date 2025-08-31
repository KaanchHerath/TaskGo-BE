import mongoose from 'mongoose';

const adminActionLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Admin ID is required'],
    index: true
  },
  actionType: {
    type: String,
    required: [true, 'Action type is required'],
    enum: {
      values: [
        // User management actions
        'USER_APPROVED',
        'USER_REJECTED',
        'USER_SUSPENDED',
        'USER_REACTIVATED',
        'USER_DELETED',
        'USER_ROLE_CHANGED',
        
        // Task management actions
        'TASK_APPROVED',
        'TASK_REJECTED',
        'TASK_SUSPENDED',
        'TASK_REACTIVATED',
        'TASK_DELETED',
        
        // Payment actions
        'PAYMENT_APPROVED',
        'PAYMENT_REJECTED',
        'PAYMENT_REFUNDED',
        'PAYMENT_DISPUTE_RESOLVED',
        
        // System actions
        'SYSTEM_CONFIG_CHANGED',
        'SYSTEM_MAINTENANCE',
        'BACKUP_CREATED',
        'MAINTENANCE_MODE_TOGGLED',
        'FEATURE_TOGGLED',
        
        // Content moderation
        'CONTENT_FLAGGED',
        'CONTENT_REMOVED',
        'CONTENT_APPROVED',
        
        // Report actions
        'REPORT_RESOLVED',
        'REPORT_ESCALATED',
        'REPORT_DISMISSED',
        
        // Analytics and reporting
        'REPORT_GENERATED',
        'DATA_EXPORTED',
        'ANALYTICS_VIEWED'
      ],
      message: 'Invalid action type'
    }
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Target ID is required'],
    refPath: 'targetModel'
  },
  targetModel: {
    type: String,
    required: [true, 'Target model is required'],
    enum: {
      values: ['User', 'Task', 'Payment', 'Application', 'Feedback', 'ChatMessage'],
      message: 'Invalid target model'
    }
  },
  details: {
    type: String,
    required: [true, 'Action details are required'],
    trim: true,
    maxlength: [2000, 'Details cannot exceed 2000 characters']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true,
    maxlength: [500, 'User agent cannot exceed 500 characters']
  },
  sessionId: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
adminActionLogSchema.index({ adminId: 1, createdAt: -1 });
adminActionLogSchema.index({ actionType: 1, createdAt: -1 });
adminActionLogSchema.index({ targetId: 1, targetModel: 1 });
adminActionLogSchema.index({ createdAt: -1 });
adminActionLogSchema.index({ 'metadata.searchable': 1 });

// Compound index for common queries
adminActionLogSchema.index({ adminId: 1, actionType: 1, createdAt: -1 });

// Virtual for formatted timestamp
adminActionLogSchema.virtual('formattedTimestamp').get(function() {
  return this.createdAt.toISOString();
});

// Virtual for action category
adminActionLogSchema.virtual('actionCategory').get(function() {
  const categories = {
    'USER_APPROVED': 'user_management',
    'USER_REJECTED': 'user_management',
    'USER_SUSPENDED': 'user_management',
    'USER_REACTIVATED': 'user_management',
    'USER_DELETED': 'user_management',
    'USER_ROLE_CHANGED': 'user_management',
    
    'TASK_APPROVED': 'task_management',
    'TASK_REJECTED': 'task_management',
    'TASK_SUSPENDED': 'task_management',
    'TASK_REACTIVATED': 'task_management',
    'TASK_DELETED': 'task_management',
    
    'PAYMENT_APPROVED': 'payment_management',
    'PAYMENT_REJECTED': 'payment_management',
    'PAYMENT_REFUNDED': 'payment_management',
    'PAYMENT_DISPUTE_RESOLVED': 'payment_management',
    
    'SYSTEM_CONFIG_CHANGED': 'system_management',
    'SYSTEM_MAINTENANCE': 'system_management',
    'BACKUP_CREATED': 'system_management',
    'MAINTENANCE_MODE_TOGGLED': 'system_management',
    'FEATURE_TOGGLED': 'system_management',
    
    'CONTENT_FLAGGED': 'content_moderation',
    'CONTENT_REMOVED': 'content_moderation',
    'CONTENT_APPROVED': 'content_moderation',
    
    'REPORT_RESOLVED': 'report_management',
    'REPORT_ESCALATED': 'report_management',
    'REPORT_DISMISSED': 'report_management',
    
    'REPORT_GENERATED': 'analytics',
    'DATA_EXPORTED': 'analytics',
    'ANALYTICS_VIEWED': 'analytics'
  };
  
  return categories[this.actionType] || 'other';
});

// Pre-save middleware to validate target exists
adminActionLogSchema.pre('save', async function(next) {
  try {
    // Skip validation for system maintenance actions that might not have a specific target
    if (this.actionType === 'SYSTEM_MAINTENANCE' || this.actionType === 'ANALYTICS_VIEWED') {
      // Validate that admin exists and has admin role
      const admin = await mongoose.model('User').findById(this.adminId);
      if (!admin || admin.role !== 'admin') {
        return next(new Error('Invalid admin ID or user is not an admin'));
      }
      return next();
    }
    
    // Validate that the target exists in the specified model
    const Model = mongoose.model(this.targetModel);
    const target = await Model.findById(this.targetId);
    
    if (!target) {
      return next(new Error(`Target ${this.targetModel} with ID ${this.targetId} not found`));
    }
    
    // Validate that admin exists and has admin role
    const admin = await mongoose.model('User').findById(this.adminId);
    if (!admin || admin.role !== 'admin') {
      return next(new Error('Invalid admin ID or user is not an admin'));
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
adminActionLogSchema.methods.getTargetDetails = async function() {
  try {
    const Model = mongoose.model(this.targetModel);
    return await Model.findById(this.targetId).select('-password');
  } catch (error) {
    return null;
  }
};

adminActionLogSchema.methods.getAdminDetails = async function() {
  try {
    return await mongoose.model('User').findById(this.adminId).select('fullName email');
  } catch (error) {
    return null;
  }
};

// Static methods
adminActionLogSchema.statics.getLogsByAdmin = function(adminId, options = {}) {
  const { page = 1, limit = 50, actionType, startDate, endDate } = options;
  const skip = (page - 1) * limit;
  
  const query = { adminId };
  
  if (actionType) query.actionType = actionType;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('adminId', 'fullName email')
    .populate('targetId', 'fullName email title');
};

adminActionLogSchema.statics.getLogsByTarget = function(targetId, targetModel, options = {}) {
  const { page = 1, limit = 50, actionType } = options;
  const skip = (page - 1) * limit;
  
  const query = { targetId, targetModel };
  if (actionType) query.actionType = actionType;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('adminId', 'fullName email');
};

adminActionLogSchema.statics.getLogsByActionType = function(actionType, options = {}) {
  const { page = 1, limit = 50, startDate, endDate } = options;
  const skip = (page - 1) * limit;
  
  const query = { actionType };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('adminId', 'fullName email')
    .populate('targetId', 'fullName email title');
};

adminActionLogSchema.statics.getAuditTrail = function(targetId, targetModel) {
  return this.find({ targetId, targetModel })
    .sort({ createdAt: -1 })
    .populate('adminId', 'fullName email')
    .populate('targetId', 'fullName email title');
};

// Export the model
export default mongoose.model('AdminActionLog', adminActionLogSchema); 