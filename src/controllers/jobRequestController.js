import JobRequest from "../models/JobRequest.js";

// Create a new job request
export const createJobRequest = async (req, res) => {
  try {
    const jobRequest = new JobRequest(req.body);
    const savedJob = await jobRequest.save();
    res.status(201).json(savedJob);
  } catch (error) {
    res.status(500).json({ message: "Error creating job request", error });
  }
};

// Get all job requests
export const getAllJobRequests = async (req, res) => {
  try {
    const jobs = await JobRequest.find();
    res.status(200).json(jobs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching jobs", error });
  }
};

// Get a single job request by ID
export const getJobRequestById = async (req, res) => {
  try {
    const job = await JobRequest.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job request not found" });
    res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ message: "Error fetching job", error });
  }
};

// Update a job request
export const updateJobRequest = async (req, res) => {
  try {
    const updatedJob = await JobRequest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedJob) return res.status(404).json({ message: "Job request not found" });
    res.status(200).json(updatedJob);
  } catch (error) {
    res.status(500).json({ message: "Error updating job request", error });
  }
};

// Delete a job request
export const deleteJobRequest = async (req, res) => {
  try {
    const job = await JobRequest.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ message: "Job request not found" });
    res.status(200).json({ message: "Job request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting job request", error });
  }
};
