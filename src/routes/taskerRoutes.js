import express from "express";
import { 
    getAllTaskers, 
    getTopRatedTaskers, 
    getTaskerById, 
    updateTaskerAvailability,
    getTaskerProfile,
    getTaskerReviews,
    uploadQualificationDocuments,
    removeQualificationDocument
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
router.post("/qualification-documents", verifyToken, authorize(['tasker']), uploadQualificationDocuments);
router.delete("/qualification-documents/:documentId", verifyToken, authorize(['tasker']), removeQualificationDocument);

export default router;
