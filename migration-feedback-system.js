import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Task from './src/models/Task.js';
import Feedback from './src/models/Feedback.js';

dotenv.config();

const migrateFeedbackSystem = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Update all existing users with new rating and statistics fields
    console.log('Updating user rating and statistics structure...');
    
    const result = await User.updateMany(
      {},
      {
        $set: {
          'rating.categoryAverages.quality': 0,
          'rating.categoryAverages.punctuality': 0,
          'rating.categoryAverages.communication': 0,
          'rating.categoryAverages.professionalism': 0,
          'rating.distribution.fiveStars': 0,
          'rating.distribution.fourStars': 0,
          'rating.distribution.threeStars': 0,
          'rating.distribution.twoStars': 0,
          'rating.distribution.oneStar': 0,
          'statistics.tasksInProgress': 0,
          'statistics.totalEarnings': 0,
          'statistics.totalSpent': 0,
          'statistics.responseTime': 0,
          'statistics.completionRate': 0,
          'statistics.repeatCustomers': 0
        }
      }
    );

    console.log(`Updated ${result.modifiedCount} users with new fields`);

    // Calculate actual statistics for existing users
    console.log('Calculating actual statistics for existing users...');
    
    const users = await User.find({});
    
    for (const user of users) {
      console.log(`Processing user: ${user.email}`);
      
      if (user.role === 'customer') {
        // Calculate customer statistics
        const tasksPosted = await Task.countDocuments({ customer: user._id });
        const tasksCompleted = await Task.countDocuments({ 
          customer: user._id, 
          status: 'completed' 
        });
        const tasksInProgress = await Task.countDocuments({ 
          customer: user._id, 
          status: 'scheduled' 
        });
        
        // Calculate total spent (sum of agreed payments for completed tasks)
        const completedTasks = await Task.find({ 
          customer: user._id, 
          status: 'completed',
          agreedPayment: { $exists: true }
        }).select('agreedPayment');
        
        const totalSpent = completedTasks.reduce((sum, task) => sum + (task.agreedPayment || 0), 0);
        
        user.statistics.tasksPosted = tasksPosted;
        user.statistics.tasksCompleted = tasksCompleted;
        user.statistics.tasksInProgress = tasksInProgress;
        user.statistics.totalSpent = totalSpent;
        
        await user.save();
        console.log(`Updated customer ${user.email}: ${tasksPosted} posted, ${tasksCompleted} completed, $${totalSpent} spent`);
        
      } else if (user.role === 'tasker') {
        // Calculate tasker statistics
        const tasksCompleted = await Task.countDocuments({ 
          selectedTasker: user._id, 
          status: 'completed' 
        });
        const tasksInProgress = await Task.countDocuments({ 
          selectedTasker: user._id, 
          status: 'scheduled' 
        });
        
        // Calculate total earnings (sum of agreed payments for completed tasks)
        const completedTasks = await Task.find({ 
          selectedTasker: user._id, 
          status: 'completed',
          agreedPayment: { $exists: true }
        }).select('agreedPayment');
        
        const totalEarnings = completedTasks.reduce((sum, task) => sum + (task.agreedPayment || 0), 0);
        
        // Calculate completion rate
        const totalAssignedTasks = tasksCompleted + tasksInProgress;
        const completionRate = totalAssignedTasks > 0 ? (tasksCompleted / totalAssignedTasks) * 100 : 0;
        
        user.statistics.tasksCompleted = tasksCompleted;
        user.statistics.tasksInProgress = tasksInProgress;
        user.statistics.totalEarnings = totalEarnings;
        user.statistics.completionRate = Math.round(completionRate * 100) / 100;
        
        await user.save();
        console.log(`Updated tasker ${user.email}: ${tasksCompleted} completed, ${tasksInProgress} in progress, $${totalEarnings} earned, ${completionRate}% completion rate`);
      }
    }

    // Migrate existing task ratings to new feedback system
    console.log('Migrating existing task ratings to feedback system...');
    
    const tasksWithRatings = await Task.find({ 
      customerRating: { $exists: true },
      customerReview: { $exists: true },
      status: 'completed'
    }).populate('customer selectedTasker');

    let migratedFeedbacks = 0;
    
    for (const task of tasksWithRatings) {
      if (task.customer && task.selectedTasker && task.customerRating) {
        // Check if feedback already exists
        const existingFeedback = await Feedback.findOne({
          task: task._id,
          fromUser: task.customer._id,
          toUser: task.selectedTasker._id,
          feedbackType: 'customer-to-tasker'
        });

        if (!existingFeedback) {
          // Create feedback from existing task rating
          const feedbackData = {
            task: task._id,
            fromUser: task.customer._id,
            toUser: task.selectedTasker._id,
            rating: task.customerRating,
            review: task.customerReview || 'No review provided',
            feedbackType: 'customer-to-tasker',
            taskerFeedbackCategories: {
              quality: task.customerRating,
              punctuality: task.customerRating,
              communication: task.customerRating,
              professionalism: task.customerRating
            },
            createdAt: task.updatedAt || task.createdAt,
            updatedAt: task.updatedAt || task.createdAt
          };

          await Feedback.create(feedbackData);
          migratedFeedbacks++;
          
          console.log(`Migrated feedback for task ${task.title} - Rating: ${task.customerRating}`);
        }
      }
    }

    console.log(`Migrated ${migratedFeedbacks} existing ratings to feedback system`);

    // Recalculate user ratings based on migrated feedback
    console.log('Recalculating user ratings from feedback...');
    
    const taskers = await User.find({ role: 'tasker' });
    
    for (const tasker of taskers) {
      const feedbacks = await Feedback.find({ 
        toUser: tasker._id, 
        feedbackType: 'customer-to-tasker' 
      });

      if (feedbacks.length > 0) {
        // Reset rating data
        tasker.rating.count = feedbacks.length;
        tasker.rating.total = feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
        tasker.rating.average = tasker.rating.total / tasker.rating.count;

        // Reset distribution
        tasker.rating.distribution = {
          fiveStars: 0,
          fourStars: 0,
          threeStars: 0,
          twoStars: 0,
          oneStar: 0
        };

        // Reset category averages
        tasker.rating.categoryAverages = {
          quality: 0,
          punctuality: 0,
          communication: 0,
          professionalism: 0
        };

        // Calculate distribution and category averages
        let categoryTotals = {
          quality: 0,
          punctuality: 0,
          communication: 0,
          professionalism: 0
        };

        feedbacks.forEach(feedback => {
          // Update distribution
          const ratingKey = feedback.rating === 5 ? 'fiveStars' : 
                           feedback.rating === 4 ? 'fourStars' :
                           feedback.rating === 3 ? 'threeStars' :
                           feedback.rating === 2 ? 'twoStars' : 'oneStar';
          tasker.rating.distribution[ratingKey]++;

          // Update category totals
          if (feedback.taskerFeedbackCategories) {
            categoryTotals.quality += feedback.taskerFeedbackCategories.quality || feedback.rating;
            categoryTotals.punctuality += feedback.taskerFeedbackCategories.punctuality || feedback.rating;
            categoryTotals.communication += feedback.taskerFeedbackCategories.communication || feedback.rating;
            categoryTotals.professionalism += feedback.taskerFeedbackCategories.professionalism || feedback.rating;
          }
        });

        // Calculate category averages
        tasker.rating.categoryAverages.quality = categoryTotals.quality / feedbacks.length;
        tasker.rating.categoryAverages.punctuality = categoryTotals.punctuality / feedbacks.length;
        tasker.rating.categoryAverages.communication = categoryTotals.communication / feedbacks.length;
        tasker.rating.categoryAverages.professionalism = categoryTotals.professionalism / feedbacks.length;

        await tasker.save();
        
        console.log(`Recalculated ratings for tasker ${tasker.email}: ${tasker.rating.average.toFixed(2)} average from ${feedbacks.length} feedbacks`);
      }
    }

    console.log('✅ Feedback system migration completed successfully!');
    console.log('\nSummary:');
    console.log(`- Updated ${result.modifiedCount} users with new rating and statistics fields`);
    console.log(`- Migrated ${migratedFeedbacks} existing task ratings to feedback system`);
    console.log(`- Recalculated ratings for ${taskers.length} taskers`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateFeedbackSystem(); 