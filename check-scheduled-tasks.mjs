import mongoose from 'mongoose';
import Task from './src/models/Task.js';

async function checkScheduledTasks() {
  try {
    await mongoose.connect('mongodb://localhost:27017/taskgo');
    console.log('✅ Connected to MongoDB');
    
    const scheduledTasks = await Task.find({ status: 'scheduled' })
      .populate('customer', 'fullName email')
      .populate('selectedTasker', 'fullName email');
    
    console.log(`\n📋 Found ${scheduledTasks.length} scheduled tasks:`);
    
    if (scheduledTasks.length === 0) {
      console.log('No scheduled tasks found. Let\'s check all tasks:');
      const allTasks = await Task.find({}).populate('customer', 'fullName').populate('selectedTasker', 'fullName');
      console.log('\n📊 All tasks:');
      allTasks.forEach((task, index) => {
        console.log(`${index + 1}. ID: ${task._id}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Customer: ${task.customer?.fullName}`);
        console.log(`   Selected Tasker: ${task.selectedTasker?.fullName || 'None'}`);
        console.log(`   Title: ${task.title}`);
        console.log('---');
      });
    } else {
      scheduledTasks.forEach((task, index) => {
        console.log(`\n${index + 1}. Task ID: ${task._id}`);
        console.log(`   Title: ${task.title}`);
        console.log(`   Customer: ${task.customer?.fullName} (${task.customer?._id})`);
        console.log(`   Selected Tasker: ${task.selectedTasker?.fullName} (${task.selectedTasker?._id})`);
        console.log(`   Status: ${task.status}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkScheduledTasks(); 