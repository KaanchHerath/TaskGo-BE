import JobRequest from "../models/JobRequest.js";
import User from "../models/User.js";

export const getDashboardStats = async (req, res) => {
    try {
        // Get live jobs (jobs that are not completed or cancelled)
        const liveJobs = await JobRequest.countDocuments({
            status: { $nin: ['completed', 'cancelled'] }
        });

        // Get total taskers
        const taskers = await User.countDocuments({ role: 'Tasker' });

        // Get total customers
        const customers = await User.countDocuments({ role: 'Customer' });

        // Get new jobs (jobs created in the last 24 hours)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const newJobs = await JobRequest.countDocuments({
            createdAt: { $gte: oneDayAgo }
        });

        res.json({
            liveJobs,
            taskers,
            customers,
            newJobs
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Error fetching dashboard statistics", 
            error: error.message 
        });
    }
}; 