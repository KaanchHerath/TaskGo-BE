import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskgo';

async function runMigration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Add agreedTime field to existing tasks
    console.log('Adding agreedTime field to existing tasks...');
    
    const tasksResult = await db.collection('tasks').updateMany(
      { agreedTime: { $exists: false } },
      { $set: { agreedTime: null } }
    );
    
    console.log(`Updated ${tasksResult.modifiedCount} tasks with agreedTime field`);

    // 2. Create ChatMessage collection with indexes if it doesn't exist
    console.log('Setting up ChatMessage collection...');
    
    try {
      await db.createCollection('chatmessages');
      console.log('Created ChatMessage collection');
    } catch (error) {
      if (error.code !== 48) { // Collection already exists
        throw error;
      }
      console.log('ChatMessage collection already exists');
    }

    // 3. Create indexes for ChatMessage collection
    console.log('Creating indexes for ChatMessage collection...');
    
    const chatCollection = db.collection('chatmessages');
    
    await chatCollection.createIndex({ taskId: 1, createdAt: -1 });
    await chatCollection.createIndex({ senderId: 1, receiverId: 1 });
    await chatCollection.createIndex({ taskId: 1, senderId: 1, receiverId: 1 });
    await chatCollection.createIndex({ receiverId: 1, isRead: 1 });
    
    console.log('Created indexes for ChatMessage collection');

    // 4. Update Task collection indexes if needed
    console.log('Ensuring Task collection indexes are up to date...');
    
    const taskCollection = db.collection('tasks');
    
    // Add index for agreedTime if it doesn't exist
    try {
      await taskCollection.createIndex({ agreedTime: 1 });
      console.log('Created index for agreedTime field');
    } catch (error) {
      console.log('Index for agreedTime already exists or creation failed:', error.message);
    }

    console.log('Migration completed successfully!');
    
    // Print summary
    console.log('\n=== Migration Summary ===');
    console.log(`✅ Updated ${tasksResult.modifiedCount} existing tasks with agreedTime field`);
    console.log('✅ ChatMessage collection is ready');
    console.log('✅ All necessary indexes have been created');
    console.log('✅ Task model now supports:');
    console.log('   - selectedTasker: ObjectId (ref: User)');
    console.log('   - agreedTime: Date');
    console.log('   - agreedPayment: Number');
    console.log('   - status: String (enum: [\'active\', \'scheduled\', \'completed\', \'cancelled\'])');
    console.log('✅ ChatMessage model created with:');
    console.log('   - taskId: ObjectId (ref: Task, required)');
    console.log('   - senderId: ObjectId (ref: User, required)');
    console.log('   - receiverId: ObjectId (ref: User, required)');
    console.log('   - message: String (required)');
    console.log('   - createdAt: Date (auto-generated)');
    console.log('   - Additional fields: isRead, messageType');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

// Run the migration
console.log('Starting Task and ChatMessage migration...');
runMigration(); 