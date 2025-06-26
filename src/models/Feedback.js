import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: [true, 'Task is required']
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'From user is required']
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'To user is required']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be between 1 and 5'],
    max: [5, 'Rating must be between 1 and 5']
  },
  review: {
    type: String,
    required: [true, 'Review is required'],
    trim: true,
    minlength: [10, 'Review must be at least 10 characters long'],
    maxlength: [1000, 'Review cannot exceed 1000 characters']
  },
  feedbackType: {
    type: String,
    enum: {
      values: ['customer-to-tasker', 'tasker-to-customer'],
      message: 'Invalid feedback type'
    },
    required: [true, 'Feedback type is required']
  },
  // Specific feedback categories for taskers
  taskerFeedbackCategories: {
    quality: {
      type: Number,
      min: 1,
      max: 5,
      required: function() {
        return this.feedbackType === 'customer-to-tasker';
      }
    },
    punctuality: {
      type: Number,
      min: 1,
      max: 5,
      required: function() {
        return this.feedbackType === 'customer-to-tasker';
      }
    },
    communication: {
      type: Number,
      min: 1,
      max: 5,
      required: function() {
        return this.feedbackType === 'customer-to-tasker';
      }
    },
    professionalism: {
      type: Number,
      min: 1,
      max: 5,
      required: function() {
        return this.feedbackType === 'customer-to-tasker';
      }
    }
  },
  // Specific feedback categories for customers
  customerFeedbackCategories: {
    clarity: {
      type: Number,
      min: 1,
      max: 5,
      required: function() {
        return this.feedbackType === 'tasker-to-customer';
      }
    },
    responsiveness: {
      type: Number,
      min: 1,
      max: 5,
      required: function() {
        return this.feedbackType === 'tasker-to-customer';
      }
    },
    cooperation: {
      type: Number,
      min: 1,
      max: 5,
      required: function() {
        return this.feedbackType === 'tasker-to-customer';
      }
    },
    fairness: {
      type: Number,
      min: 1,
      max: 5,
      required: function() {
        return this.feedbackType === 'tasker-to-customer';
      }
    }
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  response: {
    text: {
      type: String,
      trim: true,
      maxlength: [500, 'Response cannot exceed 500 characters']
    },
    createdAt: {
      type: Date
    }
  },
  helpfulVotes: {
    type: Number,
    default: 0
  },
  reportedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['inappropriate', 'fake', 'spam', 'offensive'],
      required: true
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index to prevent duplicate feedback for the same task between same users
feedbackSchema.index({ task: 1, fromUser: 1, toUser: 1, feedbackType: 1 }, { unique: true });

// Index for efficient queries
feedbackSchema.index({ toUser: 1, feedbackType: 1 });
feedbackSchema.index({ fromUser: 1 });
feedbackSchema.index({ task: 1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ createdAt: -1 });

// Virtual for average category rating
feedbackSchema.virtual('averageCategoryRating').get(function() {
  if (this.feedbackType === 'customer-to-tasker') {
    const categories = this.taskerFeedbackCategories;
    const ratings = [categories.quality, categories.punctuality, categories.communication, categories.professionalism];
    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  } else if (this.feedbackType === 'tasker-to-customer') {
    const categories = this.customerFeedbackCategories;
    const ratings = [categories.clarity, categories.responsiveness, categories.cooperation, categories.fairness];
    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  }
  return this.rating;
});

// Instance methods
feedbackSchema.methods.canBeRespondedTo = function(userId) {
  return this.toUser.toString() === userId.toString() && !this.response.text;
};

feedbackSchema.methods.addResponse = function(responseText) {
  this.response.text = responseText;
  this.response.createdAt = new Date();
  return this.save();
};

feedbackSchema.methods.addHelpfulVote = function() {
  this.helpfulVotes += 1;
  return this.save();
};

feedbackSchema.methods.reportFeedback = function(userId, reason) {
  const existingReport = this.reportedBy.find(report => 
    report.user.toString() === userId.toString()
  );
  
  if (!existingReport) {
    this.reportedBy.push({
      user: userId,
      reason: reason
    });
    return this.save();
  }
  
  throw new Error('You have already reported this feedback');
};

// Static methods
feedbackSchema.statics.getFeedbackForUser = function(userId, feedbackType = null, limit = 10, skip = 0) {
  const query = { toUser: userId, isPublic: true };
  if (feedbackType) query.feedbackType = feedbackType;
  
  return this.find(query)
    .populate('fromUser', 'fullName role')
    .populate('task', 'title category')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

feedbackSchema.statics.getFeedbackByUser = function(userId, limit = 10, skip = 0) {
  return this.find({ fromUser: userId })
    .populate('toUser', 'fullName role')
    .populate('task', 'title category')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

feedbackSchema.statics.getTaskFeedback = function(taskId) {
  return this.find({ task: taskId })
    .populate('fromUser', 'fullName role')
    .populate('toUser', 'fullName role')
    .sort({ createdAt: -1 });
};

feedbackSchema.statics.getUserRatingStats = function(userId, feedbackType = null) {
  const matchQuery = { toUser: mongoose.Types.ObjectId(userId) };
  if (feedbackType) matchQuery.feedbackType = feedbackType;
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalFeedbacks: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    },
    {
      $addFields: {
        ratingBreakdown: {
          fiveStars: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 5] }
              }
            }
          },
          fourStars: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 4] }
              }
            }
          },
          threeStars: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 3] }
              }
            }
          },
          twoStars: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 2] }
              }
            }
          },
          oneStar: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 1] }
              }
            }
          }
        }
      }
    }
  ]);
};

export default mongoose.model('Feedback', feedbackSchema);
