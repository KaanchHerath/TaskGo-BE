import express from "express";
import { getAllTaskers, updateTaskerAvailability } from "../controllers/taskerController.js";
import { protect, isTasker } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getAllTaskers);
router.put("/availability", protect, isTasker, updateTaskerAvailability);

export default router;
