import mongoose from "mongoose";
import User from "./User.js";

const taskerSchema = new mongoose.Schema({
    skills: [{ type: String, required: true }],
    experience: { type: Number, required: true },
    availability: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
});

const Tasker = User.discriminator("Tasker", taskerSchema);
export default Tasker;
