import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const addPhoneNumbers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find users without phone numbers
    const usersWithoutPhone = await User.find({
      $or: [
        { phone: { $exists: false } },
        { phone: null },
        { phone: '' }
      ]
    });

    console.log(`Found ${usersWithoutPhone.length} users without phone numbers`);

    // Update users with default phone numbers
    for (let i = 0; i < usersWithoutPhone.length; i++) {
      const user = usersWithoutPhone[i];
      
      // Generate a default phone number (you may want to ask users to update this)
      const defaultPhone = `+94 77 ${String(i + 1000000).substring(0, 3)} ${String(i + 1000000).substring(3, 7)}`;
      
      user.phone = defaultPhone;
      await user.save();
      
      console.log(`Updated user ${user.email} with phone: ${defaultPhone}`);
    }

    console.log('Migration completed successfully');
    console.log('Note: Users have been assigned default phone numbers. They should update these in their profiles.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

addPhoneNumbers(); 