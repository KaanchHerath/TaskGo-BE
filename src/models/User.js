import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['customer', 'tasker'],
    required: true
  },
  // Common fields for both customer and tasker
  fullName: {
    type: String,
    required: function() {
      return this.role === 'tasker';
    },
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(phone) {
        const phoneRegex = /^\+?[\d\s-]{10,}$/;
        return phoneRegex.test(phone);
      },
      message: 'Invalid phone number format'
    }
  },
  // Rating and statistics fields
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    // Detailed ratings for taskers
    categoryAverages: {
      quality: { type: Number, default: 0, min: 0, max: 5 },
      punctuality: { type: Number, default: 0, min: 0, max: 5 },
      communication: { type: Number, default: 0, min: 0, max: 5 },
      professionalism: { type: Number, default: 0, min: 0, max: 5 }
    },
    // Rating distribution
    distribution: {
      fiveStars: { type: Number, default: 0 },
      fourStars: { type: Number, default: 0 },
      threeStars: { type: Number, default: 0 },
      twoStars: { type: Number, default: 0 },
      oneStar: { type: Number, default: 0 }
    }
  },
  statistics: {
    tasksPosted: {
      type: Number,
      default: 0
    },
    tasksCompleted: {
      type: Number,
      default: 0
    },
    tasksAppliedTo: {
      type: Number,
      default: 0
    },
    tasksInProgress: {
      type: Number,
      default: 0
    },
    totalEarnings: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    responseTime: {
      type: Number, // Average response time in hours
      default: 0
    },
    completionRate: {
      type: Number, // Percentage of completed tasks
      default: 0,
      min: 0,
      max: 100
    },
    repeatCustomers: {
      type: Number,
      default: 0
    }
  },
  // Tasker specific fields
  taskerProfile: {
    skills: {
      type: [String],
      required: function() {
        return this.role === 'tasker';
      },
      validate: {
        validator: function(skills) {
          return this.role !== 'tasker' || (skills && skills.length > 0);
        },
        message: 'At least one skill is required for taskers'
      }
    },
    country: {
      type: String,
      required: function() {
        return this.role === 'tasker';
      },
      trim: true
    },
    area: {
      type: String,
      required: function() {
        return this.role === 'tasker';
      },
      trim: true
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, 'Bio cannot exceed 1000 characters']
    },
    experience: {
      type: String,
      trim: true,
      enum: ['0-1 years', '1-3 years', '3-5 years', '5+ years']
    },
    hourlyRate: {
      type: Number,
      min: [0, 'Hourly rate cannot be negative']
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    advancePaymentAmount: {
      type: Number,
      min: [0, 'Advance payment amount cannot be negative'],
      default: 0
    },
    idDocument: {
      type: String, // URL or path to the document
      required: function() {
        return this.role === 'tasker';
      }
    },
    qualificationDocuments: [{
      type: String // URL or path to the document
      // optional
    }]
  },
  // Customer specific fields
  customerProfile: {
    province: {
      type: String,
      trim: true
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    }
  }
}, {
  timestamps: true,
  discriminatorKey: 'role'
});

// Instance method to calculate and update average rating
userSchema.methods.updateRating = function(newRating, categoryRatings = null) {
  this.rating.count += 1;
  this.rating.total += newRating;
  this.rating.average = this.rating.total / this.rating.count;
  
  // Update rating distribution
  const ratingKey = newRating === 5 ? 'fiveStars' : 
                   newRating === 4 ? 'fourStars' :
                   newRating === 3 ? 'threeStars' :
                   newRating === 2 ? 'twoStars' : 'oneStar';
  this.rating.distribution[ratingKey] += 1;
  
  // Update category averages for taskers
  if (this.role === 'tasker' && categoryRatings) {
    const categories = ['quality', 'punctuality', 'communication', 'professionalism'];
    categories.forEach(category => {
      if (categoryRatings[category]) {
        const currentAvg = this.rating.categoryAverages[category];
        const currentCount = this.rating.count - 1; // Subtract 1 since we already incremented
        this.rating.categoryAverages[category] = 
          (currentAvg * currentCount + categoryRatings[category]) / this.rating.count;
      }
    });
  }
  
  return this.save();
};

// Instance method to increment task statistics
userSchema.methods.incrementTaskStat = function(statType, amount = 1) {
  if (this.statistics[statType] !== undefined) {
    this.statistics[statType] += amount;
    return this.save();
  }
};

// Instance method to update earnings/spending
userSchema.methods.updateFinancials = function(amount, isEarning = true) {
  if (isEarning) {
    this.statistics.totalEarnings += amount;
  } else {
    this.statistics.totalSpent += amount;
  }
  return this.save();
};

// Instance method to calculate completion rate
userSchema.methods.updateCompletionRate = function() {
  const totalTasks = this.statistics.tasksCompleted + this.statistics.tasksInProgress;
  if (totalTasks > 0) {
    this.statistics.completionRate = (this.statistics.tasksCompleted / totalTasks) * 100;
  }
  return this.save();
};

// Instance method to update response time
userSchema.methods.updateResponseTime = function(responseTimeHours) {
  const currentCount = this.rating.count;
  const currentAvg = this.statistics.responseTime;
  this.statistics.responseTime = (currentAvg * (currentCount - 1) + responseTimeHours) / currentCount;
  return this.save();
};

export default mongoose.model("User", userSchema);
