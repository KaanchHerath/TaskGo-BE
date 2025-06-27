import User from "../models/User.js";
import Task from "../models/Task.js";
import Application from "../models/Application.js";
import mongoose from 'mongoose';

// @desc    Get all taskers with filtering, pagination, and sorting
// @route   GET /api/v1/taskers
// @access  Public
export const getAllTaskers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            skills,
            area,
            minRating,
            maxHourlyRate,
            sortBy = 'rating.average',
            sortOrder = 'desc',
            search
        } = req.query;

        // Build query for taskers (only show available taskers)
        const query = { 
            role: "tasker",
            'taskerProfile.isAvailable': true 
        };
        
        // Filter by skills
        if (skills) {
            const skillsArray = Array.isArray(skills) ? skills : [skills];
            query['taskerProfile.skills'] = { $in: skillsArray };
        }
        
        // Filter by area
        if (area) {
            query['taskerProfile.area'] = area;
        }
        
        // Filter by minimum rating
        if (minRating) {
            query['rating.average'] = { $gte: Number(minRating) };
        }
        
        // Search in name or skills
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { 'taskerProfile.skills': { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (page - 1) * limit;
        
        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get taskers with pagination
        const taskers = await User.find(query)
            .select("-password")
            .sort(sort)
            .skip(skip)
            .limit(Number(limit));

        // Get total count for pagination
        const total = await User.countDocuments(query);

        // Enhance taskers with additional statistics
        const enhancedTaskers = await Promise.all(
            taskers.map(async (tasker) => {
                // Get completed tasks count
                const completedTasks = await Task.countDocuments({
                    selectedTasker: tasker._id,
                    status: 'completed'
                });

                // Get average response time (in hours) - mock for now
                const avgResponseTime = Math.floor(Math.random() * 4) + 1; // 1-4 hours

                // Calculate hourly rate based on completed tasks (mock calculation)
                const baseRate = 15 + (tasker.rating?.average || 0) * 5;
                const experienceBonus = Math.min(completedTasks * 0.5, 15);
                const hourlyRate = Math.round(baseRate + experienceBonus);

                return {
                    ...tasker.toObject(),
                    completedTasks,
                    avgResponseTime,
                    hourlyRate,
                    isOnline: Math.random() > 0.3, // Mock online status
                    responseRate: Math.min(95 + Math.floor(Math.random() * 5), 100) // 95-100%
                };
            })
        );

        res.status(200).json({
            success: true,
            data: enhancedTaskers,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get all taskers error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error while fetching taskers" 
        });
    }
};

// @desc    Get top rated taskers
// @route   GET /api/v1/taskers/top-rated
// @access  Public
export const getTopRatedTaskers = async (req, res) => {
    try {
        const { limit = 6 } = req.query;

        const topTaskers = await User.find({ 
            role: "tasker",
            'taskerProfile.isAvailable': true, // Only show available taskers
            'rating.count': { $gte: 1 } // Only taskers with at least 1 rating
        })
            .select("-password")
            .sort({ 'rating.average': -1, 'rating.count': -1 })
            .limit(Number(limit));

        // Enhance with additional data
        const enhancedTaskers = await Promise.all(
            topTaskers.map(async (tasker) => {
                const completedTasks = await Task.countDocuments({
                    selectedTasker: tasker._id,
                    status: 'completed'
                });

                const avgResponseTime = Math.floor(Math.random() * 4) + 1;
                const baseRate = 15 + (tasker.rating?.average || 0) * 5;
                const experienceBonus = Math.min(completedTasks * 0.5, 15);
                const hourlyRate = Math.round(baseRate + experienceBonus);

                return {
                    ...tasker.toObject(),
                    completedTasks,
                    avgResponseTime,
                    hourlyRate,
                    isOnline: Math.random() > 0.3,
                    responseRate: Math.min(95 + Math.floor(Math.random() * 5), 100)
                };
            })
        );

        res.status(200).json({
            success: true,
            data: enhancedTaskers
        });
    } catch (error) {
        console.error('Get top rated taskers error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error while fetching top rated taskers" 
        });
    }
};

// @desc    Get tasker by ID with detailed information
// @route   GET /api/v1/taskers/:id
// @access  Public
export const getTaskerById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tasker ID'
            });
        }

        const tasker = await User.findOne({ _id: id, role: "tasker" })
            .select("-password");

        if (!tasker) {
            return res.status(404).json({
                success: false,
                message: 'Tasker not found'
            });
        }

        // Get detailed statistics
        const completedTasks = await Task.countDocuments({
            selectedTasker: tasker._id,
            status: 'completed'
        });

        const activeTasks = await Task.countDocuments({
            selectedTasker: tasker._id,
            status: { $in: ['scheduled', 'active'] }
        });

        const totalApplications = await Application.countDocuments({
            tasker: tasker._id
        });

        // Calculate additional metrics
        const avgResponseTime = Math.floor(Math.random() * 4) + 1;
        const baseRate = 15 + (tasker.rating?.average || 0) * 5;
        const experienceBonus = Math.min(completedTasks * 0.5, 15);
        const hourlyRate = Math.round(baseRate + experienceBonus);

        const enhancedTasker = {
            ...tasker.toObject(),
            completedTasks,
            activeTasks,
            totalApplications,
            avgResponseTime,
            hourlyRate,
            isOnline: Math.random() > 0.3,
            responseRate: Math.min(95 + Math.floor(Math.random() * 5), 100)
        };

        res.status(200).json({
            success: true,
            data: enhancedTasker
        });
    } catch (error) {
        console.error('Get tasker by ID error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error while fetching tasker" 
        });
    }
};

export const updateTaskerAvailability = async (req, res) => {
    const { isAvailable, availableHours } = req.body;
    try {
        const updateData = {
            'taskerProfile.isAvailable': isAvailable
        };
        
        if (availableHours) {
            updateData['taskerProfile.availableHours'] = availableHours;
        }
        
        const tasker = await User.findByIdAndUpdate(
            req.user._id, 
            updateData, 
            { new: true }
        ).select("-password");
        
        if (!tasker) {
            return res.status(404).json({ 
                success: false,
                message: "Tasker not found" 
            });
        }
        
        res.json({
            success: true,
            data: tasker
        });
    } catch (error) {
        console.error('Update tasker availability error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error while updating availability" 
        });
    }
};

// @desc    Get tasker profile with detailed information
// @route   GET /api/v1/taskers/:id/profile
// @access  Public
export const getTaskerProfile = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tasker ID'
            });
        }

        const tasker = await User.findOne({ _id: id, role: "tasker" })
            .select("-password");

        if (!tasker) {
            return res.status(404).json({
                success: false,
                message: 'Tasker not found'
            });
        }

        // Get detailed statistics
        const completedTasks = await Task.countDocuments({
            selectedTasker: tasker._id,
            status: 'completed'
        });

        const activeTasks = await Task.countDocuments({
            selectedTasker: tasker._id,
            status: { $in: ['scheduled', 'in-progress'] }
        });

        const totalApplications = await Application.countDocuments({
            tasker: tasker._id
        });

        // Get recent completed tasks for experience showcase
        const recentTasks = await Task.find({
            selectedTasker: tasker._id,
            status: 'completed'
        })
        .select('title category completedAt customerRating customerReview')
        .populate('customer', 'fullName')
        .sort({ completedAt: -1 })
        .limit(5);

        // Calculate additional metrics
        const avgResponseTime = Math.floor(Math.random() * 4) + 1;
        const baseRate = 15 + (tasker.rating?.average || 0) * 5;
        const experienceBonus = Math.min(completedTasks * 0.5, 15);
        const hourlyRate = Math.round(baseRate + experienceBonus);

        const profileData = {
            ...tasker.toObject(),
            statistics: {
                completedTasks,
                activeTasks,
                totalApplications,
                avgResponseTime,
                responseRate: Math.min(95 + Math.floor(Math.random() * 5), 100)
            },
            hourlyRate,
            isOnline: Math.random() > 0.3,
            recentTasks,
            // Extract tasker profile data
            skills: tasker.taskerProfile?.skills || [],
            experience: tasker.taskerProfile?.experience || '',
            bio: tasker.taskerProfile?.bio || '',
            area: tasker.taskerProfile?.area || '',
            isAvailable: tasker.taskerProfile?.isAvailable || false
        };

        res.status(200).json({
            success: true,
            data: profileData
        });
    } catch (error) {
        console.error('Get tasker profile error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error while fetching tasker profile" 
        });
    }
};

// @desc    Get tasker reviews and feedback from customers
// @route   GET /api/v1/taskers/:id/reviews
// @access  Public
export const getTaskerReviews = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tasker ID'
            });
        }

        // Verify tasker exists
        const tasker = await User.findOne({ _id: id, role: "tasker" });
        if (!tasker) {
            return res.status(404).json({
                success: false,
                message: 'Tasker not found'
            });
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Get completed tasks with customer reviews
        const reviewedTasks = await Task.find({
            selectedTasker: id,
            status: 'completed',
            $or: [
                { customerRating: { $exists: true } },
                { customerReview: { $exists: true, $ne: '' } }
            ]
        })
        .populate('customer', 'fullName')
        .select('title category customerRating customerReview completedAt customerCompletedAt')
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(Number(limit));

        // Get total count for pagination
        const total = await Task.countDocuments({
            selectedTasker: id,
            status: 'completed',
            $or: [
                { customerRating: { $exists: true } },
                { customerReview: { $exists: true, $ne: '' } }
            ]
        });

        // Format reviews data
        const reviews = reviewedTasks.map(task => ({
            _id: task._id,
            taskTitle: task.title,
            taskCategory: task.category,
            rating: task.customerRating,
            review: task.customerReview,
            customer: {
                fullName: task.customer?.fullName || 'Anonymous Customer'
            },
            completedAt: task.completedAt || task.customerCompletedAt,
            createdAt: task.completedAt || task.customerCompletedAt
        }));

        // Calculate review statistics
        const ratingStats = {
            totalReviews: reviews.length,
            averageRating: reviews.length > 0 
                ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
                : 0,
            ratingDistribution: {
                5: reviews.filter(r => r.rating === 5).length,
                4: reviews.filter(r => r.rating === 4).length,
                3: reviews.filter(r => r.rating === 3).length,
                2: reviews.filter(r => r.rating === 2).length,
                1: reviews.filter(r => r.rating === 1).length
            }
        };

        res.status(200).json({
            success: true,
            data: reviews,
            statistics: ratingStats,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get tasker reviews error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error while fetching tasker reviews" 
        });
    }
}; 