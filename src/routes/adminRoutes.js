import express from "express";
import { getAllUsers, deleteUser } from "../controllers/adminController.js";
import { protect, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/users", protect, isAdmin, getAllUsers);
router.delete("/user/:id", protect, isAdmin, deleteUser);

export default router;
