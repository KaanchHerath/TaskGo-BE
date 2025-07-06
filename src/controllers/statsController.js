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

        // Get completed jobs
        const completedTasks = await JobRequest.countDocuments({
            status: 'completed'
        });

        res.json({
            liveJobs,
            taskers,
            customers,
            newJobs,
            completedTasks
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Error fetching dashboard statistics", 
            error: error.message 
        });
    }
};

// Get customer-specific statistics
export const getCustomerStats = async (req, res) => {
    try {
        const { customerId } = req.params;
        
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }

        // Get active tasks for the customer
        const activeTasks = await JobRequest.countDocuments({
            customerId: customerId,
            status: { $nin: ['completed', 'cancelled'] }
        });

        // Get completed tasks for the customer
        const completedTasks = await JobRequest.countDocuments({
            customerId: customerId,
            status: 'completed'
        });

        // Calculate total spent on completed tasks
        const completedJobRequests = await JobRequest.find({
            customerId: customerId,
            status: 'completed'
        });

        const totalSpent = completedJobRequests.reduce((sum, job) => {
            return sum + (job.agreedPayment || job.budget || 0);
        }, 0);

        // Estimate money saved (assuming 20% savings compared to traditional services)
        const estimatedSavings = Math.round(totalSpent * 0.2);

        res.json({
            activeTasks,
            completedTasks,
            totalSpent,
            savedMoney: estimatedSavings
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Error fetching customer statistics", 
            error: error.message 
        });
    }
};

// Get tasker-specific statistics
export const getTaskerStats = async (req, res) => {
    try {
        const { taskerId } = req.params;
        
        if (!taskerId) {
            return res.status(400).json({ message: "Tasker ID is required" });
        }

        // Get current month's start date
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Get completed tasks for the tasker
        const completedTasks = await JobRequest.countDocuments({
            taskerId: taskerId,
            status: 'completed'
        });

        // Get this month's earnings
        const thisMonthJobs = await JobRequest.find({
            taskerId: taskerId,
            status: 'completed',
            updatedAt: { $gte: startOfMonth }
        });

        const thisMonth = thisMonthJobs.reduce((sum, job) => {
            return sum + (job.agreedPayment || job.budget || 0);
        }, 0);

        // Get total earnings
        const allCompletedJobs = await JobRequest.find({
            taskerId: taskerId,
            status: 'completed'
        });

        const totalEarnings = allCompletedJobs.reduce((sum, job) => {
            return sum + (job.agreedPayment || job.budget || 0);
        }, 0);

        // Calculate average rating (placeholder - would need to integrate with feedback system)
        const averageRating = 4.5; // This should be calculated from actual feedback data

        res.json({
            thisMonth,
            totalEarnings,
            completedTasks,
            averageRating
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Error fetching tasker statistics", 
            error: error.message 
        });
    }
}; 