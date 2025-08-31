import express from "express";
import {
  createJobRequest,
  getAllJobRequests,
  getJobRequestById,
  updateJobRequest,
  deleteJobRequest,
} from "../controllers/jobRequestController.js";

const router = express.Router();

router.post("/", createJobRequest);
router.get("/", getAllJobRequests);
router.get("/:id", getJobRequestById);
router.put("/:id", updateJobRequest);
router.delete("/:id", deleteJobRequest);

export default router;
