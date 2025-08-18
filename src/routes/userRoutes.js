import express from "express";
import { getProfile, updateProfile, changePassword, getApprovalStatus } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";
import { validateUser } from "../middleware/validation.js";

const router = express.Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, validateUser.changePassword, changePassword);
router.get("/approval-status", protect, getApprovalStatus);

export default router;
