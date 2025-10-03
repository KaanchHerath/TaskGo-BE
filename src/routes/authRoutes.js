import express from "express";
import { register, login, registerTasker, refreshToken, logout } from "../controllers/authController.js";
import { validateAuth } from "../middleware/validation.js";

const router = express.Router();

// Authentication routes
router.post("/register", validateAuth.register, register);
router.post("/login", validateAuth.login, login);
router.post("/register-tasker", validateAuth.taskerRegistration, registerTasker);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

export default router;
