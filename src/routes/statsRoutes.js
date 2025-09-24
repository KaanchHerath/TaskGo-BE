import express from "express";
import { getDashboardStats, getCustomerStats, getTaskerStats } from "../controllers/statsController.js";

const router = express.Router();

router.get("/dashboard", getDashboardStats);
router.get("/customer/:customerId", getCustomerStats);
router.get("/tasker/:taskerId", getTaskerStats);

export default router; 