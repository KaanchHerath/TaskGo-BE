import express from "express";
import { 
    getAllTaskers, 
    getTopRatedTaskers, 
    getTaskerById, 
    updateTaskerAvailability,
    getTaskerProfile,
    getTaskerReviews 
} from "../controllers/taskerController.js";
import { verifyToken, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/", getAllTaskers);
router.get("/top-rated", getTopRatedTaskers);
router.get("/:id", getTaskerById);
router.get("/:id/profile", getTaskerProfile);
router.get("/:id/reviews", getTaskerReviews);

// Protected routes
router.put("/availability", verifyToken, authorize(['tasker']), updateTaskerAvailability);

export default router;
