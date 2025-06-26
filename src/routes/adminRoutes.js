import express from "express";
import { getAllUsers, deleteUser } from "../controllers/adminController.js";
import { verifyToken, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/users", verifyToken, authorize(['admin']), getAllUsers);
router.delete("/user/:id", verifyToken, authorize(['admin']), deleteUser);

export default router;
