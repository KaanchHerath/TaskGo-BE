import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './src/models/Task.js';

dotenv.config();

const migratePaymentFields = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Update all existing tasks to include payment fields
    const result = await Task.updateMany(
      {
        // Find tasks that don't have advancePayment field
        advancePayment: { $exists: false }
      },
      {
        $set: {
          advancePayment: null,
          advancePaymentStatus: 'pending',
          advancePaymentDate: null,
          advancePaymentReleasedAt: null,
          paymentId: null,
          paymentReference: null
        }
      }
    );

    console.log(`Migration completed successfully!`);
    console.log(`Updated ${result.modifiedCount} tasks with payment fields`);

    // Verify the migration
    const tasksWithoutPaymentFields = await Task.countDocuments({
      advancePayment: { $exists: false }
    });

    if (tasksWithoutPaymentFields === 0) {
      console.log('✅ All tasks now have payment fields');
    } else {
      console.log(`⚠️  ${tasksWithoutPaymentFields} tasks still missing payment fields`);
    }

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the migration
migratePaymentFields(); 