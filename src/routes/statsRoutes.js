import express from "express";
import { getDashboardStats } from "../controllers/statsController.js";

const router = express.Router();

// GET /api/stats/dashboard - Get dashboard statistics
router.get("/dashboard", getDashboardStats);

export default router; 