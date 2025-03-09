import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'tasker', 'admin'], required: true },
  profile: {
    fullName: String,
    phone: String,
    skills: [String],
    rating: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 }
  }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
