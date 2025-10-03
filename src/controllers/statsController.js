import JobRequest from "../models/JobRequest.js";
import User from "../models/User.js";
import Task from "../models/Task.js";

export const getDashboardStats = async (req, res) => {
    try {
       const liveJobs = await JobRequest.countDocuments({
            status: { $nin: ['completed', 'cancelled'] }
        });
        const taskers = await User.countDocuments({ role: 'Tasker' });
        const customers = await User.countDocuments({ role: 'Customer' });
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const newJobs = await JobRequest.countDocuments({
            createdAt: { $gte: oneDayAgo }
        });

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


export const getCustomerStats = async (req, res) => {
    try {
        const { customerId } = req.params;
        
        if (!customerId) {
            return res.status(400).json({ message: "Customer ID is required" });
        }
        const activeTasks = await Task.countDocuments({
            customer: customerId,
            status: { $nin: ['completed', 'cancelled'] }
        });
        const completedTasks = await Task.countDocuments({
            customer: customerId,
            status: 'completed'
        });
        const completedTasksData = await Task.find({
            customer: customerId,
            status: 'completed'
        });

        const totalSpent = completedTasksData.reduce((sum, task) => {
            return sum + (task.agreedPayment || 0);
        }, 0);

        const scheduledTasks = await Task.countDocuments({
            customer: customerId,
            status: 'scheduled'
        });

        res.json({
            activeTasks,
            completedTasks,
            totalSpent,
            scheduledTasks
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Error fetching customer statistics", 
            error: error.message 
        });
    }
};

export const getTaskerStats = async (req, res) => {

    try {
        const { taskerId } = req.params;
        
        if (!taskerId) {
            return res.status(400).json({ message: "Tasker ID is required" });
        }
        const Task = (await import('../models/Task.js')).default;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const completedTasks = await Task.countDocuments({
            selectedTasker: taskerId,
            status: 'completed'
        });

        const thisMonthTasks = await Task.find({
            selectedTasker: taskerId,
            status: 'completed',
            updatedAt: { $gte: startOfMonth }
        });

        const thisMonth = thisMonthTasks.reduce((sum, task) => {
            const advanceAmount = task.agreedPayment ? Math.round(task.agreedPayment * 0.2) : 0;
            return sum + advanceAmount;
        }, 0);

        const allCompletedTasks = await Task.find({
            selectedTasker: taskerId,
            status: 'completed'
        });

        const totalEarnings = allCompletedTasks.reduce((sum, task) => 
            {const advanceAmount = task.agreedPayment ? Math.round(task.agreedPayment * 0.2) : 0;
            return sum + advanceAmount;
        }, 0);

        const User = (await import('../models/User.js')).default;
        const tasker = await User.findById(taskerId);
        const averageRating = tasker?.rating?.average || 0;

        const responseData = {
            thisMonth,
            totalEarnings,
            completedTasks,
            averageRating
        };

        if (completedTasks === 0) {
            responseData = {
                thisMonth: 0,
                totalEarnings: 0,
                completedTasks: 0,
                averageRating: 0
            };
        }
        res.json(responseData);
    } catch (error) {
        res.status(500).json({ 
            message: "Error fetching tasker statistics", 
            error: error.message 
        });
    }
}; 