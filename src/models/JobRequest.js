import mongoose from "mongoose";

const jobRequestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  tags: [{ type: String }],
  category: { type: String, required: true },
  minPayment: { type: Number, required: true },
  maxPayment: { type: Number, required: true },
  area: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  description: { type: String, required: true },
  photos: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

const JobRequest = mongoose.model("JobRequest", jobRequestSchema);
export default JobRequest;
