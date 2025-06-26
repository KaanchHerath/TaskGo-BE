import mongoose from 'mongoose';
import User from './src/models/User.js';
import Task from './src/models/Task.js';
import Application from './src/models/Application.js';
import dotenv from 'dotenv';

dotenv.config();

const updateExistingUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Update all existing users to have default rating and statistics
    const result = await User.updateMany(
      {
        $or: [
          { 'rating.average': { $exists: false } },
          { 'statistics.tasksPosted': { $exists: false } },
          { phone: { $exists: false } },
          { phone: null },
          { phone: '' }
        ]
      },
      {
        $set: {
          'rating.average': 0,
          'rating.count': 0,
          'rating.total': 0,
          'statistics.tasksPosted': 0,
          'statistics.tasksCompleted': 0,
          'statistics.tasksAppliedTo': 0
        }
      }
    );

    console.log(`Updated ${result.modifiedCount} users with default rating and statistics`);

    // Count tasks for existing users and add phone numbers if missing
    const users = await User.find({});
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      // Add phone number if missing
      if (!user.phone) {
        const defaultPhone = `+94 77 ${String(i + 1000000).substring(0, 3)} ${String(i + 1000000).substring(3, 7)}`;
        user.phone = defaultPhone;
        console.log(`Added phone number ${defaultPhone} to user ${user.email}`);
      }
      
      if (user.role === 'customer') {
        // Count tasks posted by this customer
        const tasksPosted = await Task.countDocuments({ customer: user._id });
        const tasksCompleted = await Task.countDocuments({ 
          customer: user._id, 
          status: 'completed' 
        });
        
        user.statistics.tasksPosted = tasksPosted;
        user.statistics.tasksCompleted = tasksCompleted;
        await user.save();
        
        console.log(`Updated customer ${user.email}: ${tasksPosted} posted, ${tasksCompleted} completed`);
      } else if (user.role === 'tasker') {
        // Count tasks and applications for this tasker
        const tasksCompleted = await Task.countDocuments({ 
          selectedTasker: user._id, 
          status: 'completed' 
        });
        const tasksAppliedTo = await Application.countDocuments({ tasker: user._id });
        
        user.statistics.tasksCompleted = tasksCompleted;
        user.statistics.tasksAppliedTo = tasksAppliedTo;
        await user.save();
        
        console.log(`Updated tasker ${user.email}: ${tasksCompleted} completed, ${tasksAppliedTo} applied to`);
      }
    }

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

updateExistingUsers(); 