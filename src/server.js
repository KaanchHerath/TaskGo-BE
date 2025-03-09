import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import jobRequestRoutes from "./routes/jobRequests.js";
import authRoutes from "./routes/auth.js";
import { verifyToken, authorize } from "./middleware/auth.js";

dotenv.config();

const app = express();

// Add CORS middleware with options
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Auth routes (public)
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/jobs", verifyToken, jobRequestRoutes);

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at http://localhost:${PORT}`);
});
