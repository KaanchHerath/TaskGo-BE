import express from "express";
import { getDashboardStats, getCustomerStats, getTaskerStats } from "../controllers/statsController.js";

const router = express.Router();

// GET /api/stats/dashboard - Get dashboard statistics
router.get("/dashboard", getDashboardStats);

// GET /api/stats/customer/:customerId - Get customer-specific statistics
router.get("/customer/:customerId", getCustomerStats);

// GET /api/stats/tasker/:taskerId - Get tasker-specific statistics
router.get("/tasker/:taskerId", getTaskerStats);

export default router; 