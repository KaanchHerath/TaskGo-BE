import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskgo';

async function migrateTargetedTasks() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const tasksCollection = db.collection('tasks');

    console.log('Adding targeted task fields to existing tasks...');
    
    const result = await tasksCollection.updateMany(
      { 
        $or: [
          { targetedTasker: { $exists: false } },
          { isTargeted: { $exists: false } }
        ]
      },
      { 
        $set: { 
          targetedTasker: null,
          isTargeted: false
        } 
      }
    );

    console.log(`Updated ${result.modifiedCount} tasks with targeted task fields`);

    // Create indexes for targeted tasks
    console.log('Creating indexes for targeted task fields...');
    
    await tasksCollection.createIndex({ targetedTasker: 1, status: 1 });
    await tasksCollection.createIndex({ isTargeted: 1, status: 1 });
    
    console.log('Indexes created successfully');

    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run migration
migrateTargetedTasks(); 