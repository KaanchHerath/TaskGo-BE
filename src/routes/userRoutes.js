import express from "express";
import { registerUser, loginUser, getProfile, updateProfile, changePassword, getApprovalStatus } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.get("/approval-status", protect, getApprovalStatus);

export default router;
