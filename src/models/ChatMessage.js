import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: [true, 'Task ID is required']
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required']
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver ID is required']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  messageType: {
    type: String,
    enum: {
      values: ['text', 'system', 'payment_update', 'time_update'],
      message: 'Invalid message type'
    },
    default: 'text'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
chatMessageSchema.index({ taskId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1, receiverId: 1 });
chatMessageSchema.index({ taskId: 1, senderId: 1, receiverId: 1 });
chatMessageSchema.index({ receiverId: 1, isRead: 1 });

// Virtual for formatted creation date
chatMessageSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleString();
});

// Pre-save middleware to validate sender and receiver are different
chatMessageSchema.pre('save', function(next) {
  if (this.senderId.toString() === this.receiverId.toString()) {
    return next(new Error('Sender and receiver cannot be the same user'));
  }
  next();
});

// Static methods
chatMessageSchema.statics.getConversation = function(taskId, userId1, userId2, limit = 50) {
  return this.find({
    taskId: taskId,
    $or: [
      { senderId: userId1, receiverId: userId2 },
      { senderId: userId2, receiverId: userId1 }
    ]
  })
  .populate('senderId', 'fullName email')
  .populate('receiverId', 'fullName email')
  .sort({ createdAt: 1 })
  .limit(limit);
};

chatMessageSchema.statics.getTaskConversations = function(taskId) {
  return this.find({ taskId: taskId })
    .populate('senderId', 'fullName email')
    .populate('receiverId', 'fullName email')
    .sort({ createdAt: 1 });
};

chatMessageSchema.statics.markAsRead = function(taskId, receiverId) {
  return this.updateMany(
    { 
      taskId: taskId, 
      receiverId: receiverId, 
      isRead: false 
    },
    { 
      $set: { isRead: true } 
    }
  );
};

chatMessageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    receiverId: userId,
    isRead: false
  });
};

// Instance methods
chatMessageSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

export default mongoose.model('ChatMessage', chatMessageSchema); 