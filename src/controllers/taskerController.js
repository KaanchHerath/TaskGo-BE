import User from "../models/User.js";
import Task from "../models/Task.js";
import Application from "../models/Application.js";
import mongoose from 'mongoose';

// Helper function to calculate response rate based on actual data
const calculateResponseRate = async (taskerId) => {
    try {
        // Get total tasks the tasker has been involved with
        const totalTasks = await Task.countDocuments({
            $or: [
                { selectedTasker: taskerId },
                { targetedTasker: taskerId }
            ]
        });

        // Get completed tasks
        const completedTasks = await Task.countDocuments({
            $or: [
                { selectedTasker: taskerId, status: 'completed' },
                { targetedTasker: taskerId, status: 'completed' }
            ]
        });

        // Get applications (shows responsiveness to opportunities)
        const totalApplications = await Application.countDocuments({
            tasker: taskerId
        });

        if (totalTasks === 0 && totalApplications === 0) {
            return 0; // New tasker with no activity
        }

        // Calculate response rate based on completion rate and activity
        let responseRate = 0;
        
        if (totalTasks > 0) {
            const completionRate = (completedTasks / totalTasks) * 100;
            // Base response rate on completion rate
            responseRate = Math.min(completionRate, 100);
        }

        // Boost response rate for active taskers (those who apply to jobs)
        if (totalApplications > 0) {
            responseRate = Math.max(responseRate, 85); // Minimum 85% for active taskers
        }

        return Math.round(responseRate);
    } catch (error) {
        console.error('Error calculating response rate:', error);
        return 0;
    }
};

// @desc    Get all taskers with filtering, pagination, and sorting
// @route   GET /api/taskers
// @access  Public
export const getAllTaskers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            skills,
            province,
            district,
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
        
        // Filter by province
        if (province) {
            query['taskerProfile.province'] = province;
        }
        
        // Filter by district
        if (district) {
            query['taskerProfile.district'] = district;
        }
        
        // Filter by minimum rating
        if (minRating) {
            query['rating.average'] = { $gte: Number(minRating) };
        }
        
        // Build combined OR/AND conditions for search and area
        const searchOrClauses = [];
        const areaOrClauses = [];

        // Search in name or skills
        if (search) {
            searchOrClauses.push(
                { fullName: { $regex: search, $options: 'i' } },
                { 'taskerProfile.skills': { $regex: search, $options: 'i' } }
            );
        }

        // Area matches either province or district (case-insensitive)
        if (area) {
            const areaRegex = new RegExp(area, 'i');
            areaOrClauses.push(
                { 'taskerProfile.province': areaRegex },
                { 'taskerProfile.district': areaRegex }
            );
        }

        // Apply boolean logic: if both search and area present => AND, otherwise single OR
        if (searchOrClauses.length && areaOrClauses.length) {
            query.$and = [
                { $or: searchOrClauses },
                { $or: areaOrClauses }
            ];
        } else if (searchOrClauses.length) {
            query.$or = searchOrClauses;
        } else if (areaOrClauses.length) {
            query.$or = areaOrClauses;
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

                // Calculate real response rate
                const responseRate = await calculateResponseRate(tasker._id);

                return {
                    ...tasker.toObject(),
                    completedTasks,
                    avgResponseTime,
                    hourlyRate,
                    isOnline: Math.random() > 0.3, // Mock online status
                    responseRate
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
// @route   GET /api/taskers/top-rated
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

                // Calculate real response rate
                const responseRate = await calculateResponseRate(tasker._id);

                return {
                    ...tasker.toObject(),
                    completedTasks,
                    avgResponseTime,
                    hourlyRate,
                    isOnline: Math.random() > 0.3,
                    responseRate
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
// @route   GET /api/taskers/:id
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

        // Calculate real response rate
        const responseRate = await calculateResponseRate(tasker._id);

        const enhancedTasker = {
            ...tasker.toObject(),
            completedTasks,
            activeTasks,
            totalApplications,
            avgResponseTime,
            hourlyRate,
            isOnline: Math.random() > 0.3,
            responseRate
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
// @route   GET /api/taskers/:id/profile
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

        // Calculate real response rate
        const responseRate = await calculateResponseRate(tasker._id);

        const profileData = {
            ...tasker.toObject(),
            statistics: {
                completedTasks,
                activeTasks,
                totalApplications,
                avgResponseTime,
                responseRate
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
// @route   GET /api/taskers/:id/reviews
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

// @desc    Upload qualification documents for tasker
// @route   POST /api/taskers/qualification-documents
// @access  Private (Tasker only)
export const uploadQualificationDocuments = async (req, res) => {
    try {
        const taskerId = req.user.id;

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files were uploaded'
            });
        }

        // Verify tasker exists
        const tasker = await User.findOne({ _id: taskerId, role: "tasker" });
        if (!tasker) {
            return res.status(404).json({
                success: false,
                message: 'Tasker not found'
            });
        }

        const uploadedFiles = [];
        const files = Array.isArray(req.files.qualificationDocuments) 
            ? req.files.qualificationDocuments 
            : [req.files.qualificationDocuments];

        for (const file of files) {
            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    message: `File type ${file.mimetype} is not allowed. Only PDF and image files are supported.`
                });
            }

            // Validate file size (10MB limit)
            if (file.size > 10 * 1024 * 1024) {
                return res.status(400).json({
                    success: false,
                    message: `File ${file.name} is too large. Maximum size is 10MB.`
                });
            }

            // Generate unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const fileExtension = file.name.split('.').pop();
            const filename = `qualification-${timestamp}-${randomString}.${fileExtension}`;

            // Move file to uploads directory
            const uploadPath = `./uploads/tasker-docs/${filename}`;
            await file.mv(uploadPath);

            uploadedFiles.push(`uploads/tasker-docs/${filename}`);
        }

        // Update tasker profile with new documents
        const updatedTasker = await User.findByIdAndUpdate(
            taskerId,
            {
                $push: {
                    'taskerProfile.qualificationDocuments': { $each: uploadedFiles }
                }
            },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: 'Qualification documents uploaded successfully',
            data: uploadedFiles
        });
    } catch (error) {
        console.error('Upload qualification documents error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error while uploading qualification documents" 
        });
    }
};

// @desc    Remove qualification document for tasker
// @route   DELETE /api/taskers/qualification-documents/:documentId
// @access  Private (Tasker only)
export const removeQualificationDocument = async (req, res) => {
    try {
        const taskerId = req.user.id;
        const { documentId } = req.params;

        // Verify tasker exists
        const tasker = await User.findOne({ _id: taskerId, role: "tasker" });
        if (!tasker) {
            return res.status(404).json({
                success: false,
                message: 'Tasker not found'
            });
        }

        // Find the document in the tasker's profile
        const documentIndex = tasker.taskerProfile?.qualificationDocuments?.findIndex(
            doc => doc.includes(documentId) || doc.split('/').pop().split('.')[0] === documentId
        );

        if (documentIndex === -1 || documentIndex === undefined) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        // Remove the document from the array
        const updatedTasker = await User.findByIdAndUpdate(
            taskerId,
            {
                $pull: {
                    'taskerProfile.qualificationDocuments': tasker.taskerProfile.qualificationDocuments[documentIndex]
                }
            },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: 'Qualification document removed successfully'
        });
    } catch (error) {
        console.error('Remove qualification document error:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error while removing qualification document" 
        });
    }
}; 