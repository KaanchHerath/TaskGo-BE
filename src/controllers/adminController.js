import User from "../models/User.js";
import AdminActionLog from "../models/AdminActionLog.js";
import Task from "../models/Task.js";
import Payment from "../models/Payment.js";
import Application from "../models/Application.js";
import logger from "../utils/logger.js";

/**
 * Test endpoint to verify admin controller is working
 */
export const testAdminEndpoint = async (req, res) => {
    console.log('Test admin endpoint called');
    res.json({
        success: true,
        message: 'Admin controller is working',
        user: req.user
    });
};

/**
 * Get all users (existing functionality)
 */
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Delete user (existing functionality)
 */
export const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get pending taskers for approval
 * @route GET /api/admin/taskers/pending
 * @access Admin only
 */
export const getPendingTaskers = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const skip = (page - 1) * limit;

        // Build query: always filter by isApproved: false
        let query = { role: 'tasker', 'taskerProfile.isApproved': false };
        if (status === 'pending') {
            query['taskerProfile.approvalStatus'] = 'pending';
        } else if (status === 'rejected') {
            query['taskerProfile.approvalStatus'] = 'rejected';
        } else if (status === 'all') {
            // Show all unapproved taskers regardless of approvalStatus
            // No additional filter needed
        }

        // Get pending taskers with pagination
        const taskers = await User.find(query)
            .select('fullName email phone taskerProfile createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await User.countDocuments(query);

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // Log admin action
        await AdminActionLog.create({
            adminId: req.user._id,
            actionType: 'ANALYTICS_VIEWED',
            targetId: req.user._id,
            targetModel: 'User',
            details: `Admin viewed unapproved taskers for approval`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: {
                status: status || 'all',
                page: parseInt(page),
                limit: parseInt(limit),
                totalResults: total
            }
        });

        res.json({
            success: true,
            message: `Retrieved unapproved taskers successfully`,
            data: taskers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNextPage,
                hasPrevPage
            }
        });

    } catch (error) {
        logger.error('Error in getPendingTaskers', {
            error: error.message,
            adminId: req.user?._id,
            query: req.query
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve pending taskers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Approve a tasker
 * @route POST /api/admin/taskers/:taskerId/approve
 * @access Admin only
 */
export const approveTasker = async (req, res) => {
    try {
        const { taskerId } = req.params;
        const { notes } = req.body;

        if (!taskerId) {
            return res.status(400).json({ success: false, message: 'Tasker ID is required' });
        }

        // Minimal, admin-forced approval update without extra validations
        const update = {
            'taskerProfile.isApproved': true,
            'taskerProfile.approvalStatus': 'approved',
            'taskerProfile.approvedAt': new Date(),
            'taskerProfile.approvedBy': req.user._id,
            'taskerProfile.rejectionReason': null,
        };

        const previous = await User.findById(taskerId).select('taskerProfile fullName email');
        if (!previous) {
            return res.status(404).json({ success: false, message: 'Tasker not found' });
        }
        const wasRejected = previous.taskerProfile?.approvalStatus === 'rejected';

        const tasker = await User.findByIdAndUpdate(
            taskerId,
            { $set: update },
            { new: true, runValidators: false }
        ).select('fullName email taskerProfile');

        // Create audit log (do not fail approval if logging fails)
        try {
            await AdminActionLog.create({
                adminId: req.user._id,
                actionType: wasRejected ? 'USER_REACTIVATED' : 'USER_APPROVED',
                targetId: taskerId,
                targetModel: 'User',
                details: notes || `Tasker ${wasRejected ? 'reactivated' : 'approved'} by admin`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                metadata: {
                    previousStatus: previous.taskerProfile?.approvalStatus,
                    notes,
                    wasRejected
                }
            });
        } catch (logError) {
            logger.warn('AdminActionLog failed during approveTasker', {
                error: logError.message,
                adminId: req.user?._id,
                taskerId
            });
        }

        // Send notification to tasker (placeholder for email/SMS service)
        await sendTaskerApprovalNotification(tasker, 'approved', notes);

        logger.info('Tasker approved successfully', {
            adminId: req.user._id,
            taskerId,
            wasRejected,
            notes
        });

        return res.json({
            success: true,
            message: `Tasker ${wasRejected ? 'reactivated' : 'approved'} successfully`,
            data: {
                taskerId,
                fullName: tasker.fullName,
                email: tasker.email,
                approvalStatus: 'approved',
                approvedAt: tasker.taskerProfile.approvedAt,
                approvedBy: req.user._id
            }
        });

    } catch (error) {
        logger.error('Error in approveTasker', {
            error: error.message,
            adminId: req.user?._id,
            taskerId: req.params.taskerId
        });

        res.status(500).json({
            success: false,
            message: 'Failed to approve tasker',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Reject a tasker
 * @route POST /api/admin/taskers/:taskerId/reject
 * @access Admin only
 */
export const rejectTasker = async (req, res) => {
    try {
        const { taskerId } = req.params;
        const { reason, notes } = req.body;

        if (!taskerId) {
            return res.status(400).json({ success: false, message: 'Tasker ID is required' });
        }

        const prev = await User.findById(taskerId).select('taskerProfile fullName email');
        if (!prev) {
            return res.status(404).json({ success: false, message: 'Tasker not found' });
        }
        const previousStatus = prev.taskerProfile?.approvalStatus;

        const tasker = await User.findByIdAndUpdate(
            taskerId,
            {
                $set: {
                    'taskerProfile.isApproved': false,
                    'taskerProfile.approvalStatus': 'rejected',
                    'taskerProfile.rejectionReason': (reason || '').trim(),
                    'taskerProfile.approvedAt': null,
                    'taskerProfile.approvedBy': null
                }
            },
            { new: true, runValidators: false }
        ).select('fullName email taskerProfile');

        // Create audit log (do not fail rejection if logging fails)
        try {
            await AdminActionLog.create({
                adminId: req.user._id,
                actionType: 'USER_REJECTED',
                targetId: taskerId,
                targetModel: 'User',
                details: notes || `Tasker rejected by admin: ${reason}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                metadata: {
                    previousStatus,
                    rejectionReason: reason,
                    notes
                }
            });
        } catch (logError) {
            logger.warn('AdminActionLog failed during rejectTasker', {
                error: logError.message,
                adminId: req.user?._id,
                taskerId
            });
        }

        // Send notification to tasker (placeholder for email/SMS service)
        await sendTaskerApprovalNotification(tasker, 'rejected', reason);

        logger.info('Tasker rejected successfully', {
            adminId: req.user._id,
            taskerId,
            reason,
            notes
        });

        return res.json({
            success: true,
            message: 'Tasker rejected successfully',
            data: {
                taskerId,
                fullName: tasker.fullName,
                email: tasker.email,
                approvalStatus: 'rejected',
                rejectionReason: (reason || '').trim(),
                rejectedAt: new Date(),
                rejectedBy: req.user._id
            }
        });

    } catch (error) {
        logger.error('Error in rejectTasker', {
            error: error.message,
            adminId: req.user?._id,
            taskerId: req.params.taskerId
        });

        res.status(500).json({
            success: false,
            message: 'Failed to reject tasker',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get tasker approval details
 * @route GET /api/admin/taskers/:taskerId/approval
 * @access Admin only
 */
export const getTaskerApprovalDetails = async (req, res) => {
    try {
        const { taskerId } = req.params;

        if (!taskerId) {
            return res.status(400).json({
                success: false,
                message: 'Tasker ID is required'
            });
        }

        // Find the tasker
        const tasker = await User.findById(taskerId)
            .select('fullName email phone taskerProfile createdAt');

        if (!tasker) {
            return res.status(404).json({
                success: false,
                message: 'Tasker not found'
            });
        }

        // Get audit trail for this tasker
        const auditTrail = await AdminActionLog.getAuditTrail(taskerId, 'User');

        res.json({
            success: true,
            message: 'Tasker approval details retrieved successfully',
            data: {
                tasker,
                auditTrail
            }
        });

    } catch (error) {
        logger.error('Error in getTaskerApprovalDetails', {
            error: error.message,
            adminId: req.user?._id,
            taskerId: req.params.taskerId
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve tasker approval details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get approval statistics
 * @route GET /api/admin/taskers/approval-stats
 * @access Admin only
 */
export const getApprovalStats = async (req, res) => {
    try {
        // Get counts for different approval statuses
        const stats = await User.aggregate([
            { $match: { role: 'tasker' } },
            {
                $group: {
                    _id: '$taskerProfile.approvalStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get recent approval activities
        const recentActivities = await AdminActionLog.find({
            actionType: { $in: ['USER_APPROVED', 'USER_REJECTED', 'USER_REACTIVATED'] }
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('adminId', 'fullName email')
        .populate('targetId', 'fullName email');

        // Format stats
        const formattedStats = {
            pending: 0,
            approved: 0,
            rejected: 0,
            total: 0
        };

        stats.forEach(stat => {
            const status = stat._id || 'pending';
            formattedStats[status] = stat.count;
            formattedStats.total += stat.count;
        });

        res.json({
            success: true,
            message: 'Approval statistics retrieved successfully',
            data: {
                stats: formattedStats,
                recentActivities
            }
        });

    } catch (error) {
        logger.error('Error in getApprovalStats', {
            error: error.message,
            adminId: req.user?._id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve approval statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Helper function to send tasker approval notifications
 * This is a placeholder for email/SMS notification service
 */
const sendTaskerApprovalNotification = async (tasker, status, reason = null) => {
    try {
        // Placeholder for notification service integration
        // In a real implementation, this would send email/SMS notifications
        
        const notificationData = {
            taskerId: tasker._id,
            taskerEmail: tasker.email,
            taskerName: tasker.fullName,
            status,
            reason,
            timestamp: new Date()
        };

        logger.info('Tasker approval notification sent', notificationData);

        // Example email notification structure:
        // await emailService.sendTaskerApprovalNotification(notificationData);
        
        // Example SMS notification structure:
        // await smsService.sendTaskerApprovalNotification(notificationData);

    } catch (error) {
        logger.error('Failed to send tasker approval notification', {
            error: error.message,
            taskerId: tasker._id,
            status
        });
        // Don't throw error to avoid breaking the main approval flow
    }
};

/**
 * Get comprehensive dashboard statistics
 * @route GET /api/admin/dashboard/stats
 * @access Admin only
 */
export const getDashboardStats = async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let userStats = {}, taskStats = {}, revenueStats = {}, appStats = {}, growthStats = {};
        let errorSections = [];

        // User Statistics
        try {
            [
                userStats.totalUsers,
                userStats.totalCustomers,
                userStats.totalTaskers,
                userStats.pendingTaskers,
                userStats.approvedTaskers,
                userStats.rejectedTaskers,
                userStats.newUsersThisMonth,
                userStats.newUsersThisWeek,
                userStats.newUsersToday
            ] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ role: 'customer' }),
                User.countDocuments({ role: 'tasker' }),
                User.countDocuments({ role: 'tasker', 'taskerProfile.approvalStatus': 'pending' }),
                User.countDocuments({ role: 'tasker', 'taskerProfile.approvalStatus': 'approved' }),
                User.countDocuments({ role: 'tasker', 'taskerProfile.approvalStatus': 'rejected' }),
                User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
                User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
                User.countDocuments({ createdAt: { $gte: today } })
            ]);
        } catch (err) {
            logger.error('Error fetching user stats', { error: err.message, stack: err.stack });
            errorSections.push('userStats');
        }

        // Task Statistics
        try {
            [
                taskStats.totalTasks,
                taskStats.activeTasks,
                taskStats.scheduledTasks,
                taskStats.completedTasks,
                taskStats.cancelledTasks,
                taskStats.newTasksThisMonth,
                taskStats.newTasksThisWeek,
                taskStats.newTasksToday,
                taskStats.tasksByCategory
            ] = await Promise.all([
                Task.countDocuments(),
                Task.countDocuments({ status: 'active' }),
                Task.countDocuments({ status: 'scheduled' }),
                Task.countDocuments({ status: 'completed' }),
                Task.countDocuments({ status: 'cancelled' }),
                Task.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
                Task.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
                Task.countDocuments({ createdAt: { $gte: today } }),
                Task.aggregate([
                    { $group: { _id: '$category', count: { $sum: 1 } } },
                    { $sort: { count: -1 } }
                ])
            ]);
        } catch (err) {
            logger.error('Error fetching task stats', { error: err.message, stack: err.stack });
            errorSections.push('taskStats');
        }

        // Revenue Statistics
        try {
            [
                revenueStats.totalRevenue,
                revenueStats.revenueThisMonth,
                revenueStats.revenueThisWeek,
                revenueStats.revenueToday,
                revenueStats.completedPayments,
                revenueStats.pendingPayments,
                revenueStats.failedPayments,
                revenueStats.averageTaskValue,
                revenueStats.platformRevenue,
                revenueStats.platformRevenueThisMonth,
                revenueStats.platformRevenueThisWeek,
                revenueStats.platformRevenueToday
            ] = await Promise.all([
                Payment.aggregate([
                    { $match: { status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Payment.aggregate([
                    { $match: { status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Payment.aggregate([
                    { $match: { status: 'completed', createdAt: { $gte: sevenDaysAgo } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Payment.aggregate([
                    { $match: { status: 'completed', createdAt: { $gte: today } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Payment.countDocuments({ status: 'completed' }),
                Payment.countDocuments({ status: 'pending' }),
                Payment.countDocuments({ status: 'failed' }),
                Task.aggregate([
                    { $match: { status: 'completed' } },
                    { $group: { _id: null, avgValue: { $avg: '$agreedPayment' } } }
                ]),
                // Platform revenue statistics
                Payment.aggregate([
                    { $match: { status: 'completed', paymentType: 'advance' } },
                    { $group: { _id: null, total: { $sum: '$platformCommissionAmount' } } }
                ]),
                Payment.aggregate([
                    { $match: { status: 'completed', paymentType: 'advance', createdAt: { $gte: thirtyDaysAgo } } },
                    { $group: { _id: null, total: { $sum: '$platformCommissionAmount' } } }
                ]),
                Payment.aggregate([
                    { $match: { status: 'completed', paymentType: 'advance', createdAt: { $gte: sevenDaysAgo } } },
                    { $group: { _id: null, total: { $sum: '$platformCommissionAmount' } } }
                ]),
                Payment.aggregate([
                    { $match: { status: 'completed', paymentType: 'advance', createdAt: { $gte: today } } },
                    { $group: { _id: null, total: { $sum: '$platformCommissionAmount' } } }
                ])
            ]);
        } catch (err) {
            logger.error('Error fetching revenue stats', { error: err.message, stack: err.stack });
            errorSections.push('revenueStats');
        }

        // Application Statistics
        try {
            [
                appStats.totalApplications,
                appStats.applicationsThisMonth,
                appStats.applicationsThisWeek,
                appStats.applicationsToday,
                appStats.confirmedApplications
            ] = await Promise.all([
                Application.countDocuments(),
                Application.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
                Application.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
                Application.countDocuments({ createdAt: { $gte: today } }),
                Application.countDocuments({ status: 'confirmed' })
            ]);
        } catch (err) {
            logger.error('Error fetching application stats', { error: err.message, stack: err.stack });
            errorSections.push('appStats');
        }

        // Growth rates
        try {
            const previousMonth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
            const previousWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            [
                growthStats.previousMonthUsers,
                growthStats.previousWeekUsers,
                growthStats.previousMonthTasks,
                growthStats.previousWeekTasks,
                growthStats.previousMonthRevenue,
                growthStats.previousWeekRevenue
            ] = await Promise.all([
                User.countDocuments({ createdAt: { $gte: previousMonth, $lt: thirtyDaysAgo } }),
                User.countDocuments({ createdAt: { $gte: previousWeek, $lt: sevenDaysAgo } }),
                Task.countDocuments({ createdAt: { $gte: previousMonth, $lt: thirtyDaysAgo } }),
                Task.countDocuments({ createdAt: { $gte: previousWeek, $lt: sevenDaysAgo } }),
                Payment.aggregate([
                    { $match: { status: 'completed', createdAt: { $gte: previousMonth, $lt: thirtyDaysAgo } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Payment.aggregate([
                    { $match: { status: 'completed', createdAt: { $gte: previousWeek, $lt: sevenDaysAgo } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ])
            ]);
        } catch (err) {
            logger.error('Error fetching growth stats', { error: err.message, stack: err.stack });
            errorSections.push('growthStats');
        }

        // Calculate percentage changes safely
        const calculateGrowthRate = (current, previous) => {
            if (!previous || previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const userGrowthRate = calculateGrowthRate(userStats.newUsersThisMonth || 0, growthStats.previousMonthUsers || 0);
        const taskGrowthRate = calculateGrowthRate(taskStats.newTasksThisMonth || 0, growthStats.previousMonthTasks || 0);
        const revenueGrowthRate = calculateGrowthRate(
            (revenueStats.revenueThisMonth && revenueStats.revenueThisMonth[0]?.total) || 0,
            (growthStats.previousMonthRevenue && growthStats.previousMonthRevenue[0]?.total) || 0
        );

        // Compile statistics (with null checks)
        const stats = {
            users: {
                total: userStats.totalUsers || 0,
                customers: userStats.totalCustomers || 0,
                taskers: userStats.totalTaskers || 0,
                pendingApproval: userStats.pendingTaskers || 0,
                approved: userStats.approvedTaskers || 0,
                rejected: userStats.rejectedTaskers || 0,
                newThisMonth: userStats.newUsersThisMonth || 0,
                newThisWeek: userStats.newUsersThisWeek || 0,
                newToday: userStats.newUsersToday || 0,
                growthRate: userGrowthRate
            },
            tasks: {
                total: taskStats.totalTasks || 0,
                active: taskStats.activeTasks || 0,
                scheduled: taskStats.scheduledTasks || 0,
                completed: taskStats.completedTasks || 0,
                cancelled: taskStats.cancelledTasks || 0,
                newThisMonth: taskStats.newTasksThisMonth || 0,
                newThisWeek: taskStats.newTasksThisWeek || 0,
                newToday: taskStats.newTasksToday || 0,
                byCategory: taskStats.tasksByCategory || [],
                growthRate: taskGrowthRate
            },
            revenue: {
                total: (revenueStats.totalRevenue && revenueStats.totalRevenue[0]?.total) || 0,
                thisMonth: (revenueStats.revenueThisMonth && revenueStats.revenueThisMonth[0]?.total) || 0,
                thisWeek: (revenueStats.revenueThisWeek && revenueStats.revenueThisWeek[0]?.total) || 0,
                today: (revenueStats.revenueToday && revenueStats.revenueToday[0]?.total) || 0,
                completedPayments: revenueStats.completedPayments || 0,
                pendingPayments: revenueStats.pendingPayments || 0,
                failedPayments: revenueStats.failedPayments || 0,
                averageTaskValue: (revenueStats.averageTaskValue && revenueStats.averageTaskValue[0]?.avgValue) || 0,
                growthRate: revenueGrowthRate,
                // Platform revenue (10% commission from advance payments)
                platformRevenue: {
                    total: (revenueStats.platformRevenue && revenueStats.platformRevenue[0]?.total) || 0,
                    thisMonth: (revenueStats.platformRevenueThisMonth && revenueStats.platformRevenueThisMonth[0]?.total) || 0,
                    thisWeek: (revenueStats.platformRevenueThisWeek && revenueStats.platformRevenueThisWeek[0]?.total) || 0,
                    today: (revenueStats.platformRevenueToday && revenueStats.platformRevenueToday[0]?.total) || 0
                }
            },
            applications: {
                total: appStats.totalApplications || 0,
                thisMonth: appStats.applicationsThisMonth || 0,
                thisWeek: appStats.applicationsThisWeek || 0,
                today: appStats.applicationsToday || 0,
                confirmed: appStats.confirmedApplications || 0
            },
            summary: {
                completionRate: (taskStats.totalTasks || 0) > 0 ? ((taskStats.completedTasks || 0) / taskStats.totalTasks) * 100 : 0,
                approvalRate: (userStats.totalTaskers || 0) > 0 ? ((userStats.approvedTaskers || 0) / userStats.totalTaskers) * 100 : 0,
                averageRating: 0, // Would need to calculate from completed tasks
                platformHealth: 'good', // Could be calculated based on various metrics
                errorSections
            }
        };

        // Log admin action
        await AdminActionLog.create({
            adminId: req.user._id,
            actionType: 'ANALYTICS_VIEWED',
            targetId: req.user._id,
            targetModel: 'User',
            details: 'Admin viewed dashboard statistics',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: {
                dataPoints: Object.keys(stats).length,
                errorSections
            }
        });

        logger.info('Dashboard statistics generated successfully', {
            adminId: req.user._id,
            dataPoints: Object.keys(stats).length,
            errorSections
        });

        res.json({
            success: true,
            message: 'Dashboard statistics retrieved successfully',
            data: stats,
            lastUpdated: Date.now()
        });

    } catch (error) {
        logger.error('Error in getDashboardStats', {
            error: error.message,
            adminId: req.user?._id,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve dashboard statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get recent activity for dashboard feed
 * @route GET /api/admin/dashboard/recent-activity
 * @access Admin only
 */
export const getRecentActivity = async (req, res) => {
    try {
        const { limit = 20, type = 'all' } = req.query;

        const activities = [];
        let errorSections = [];

        // User Registrations
        try {
            if (type === 'all' || type === 'users') {
                const recentUsers = await User.find()
                    .select('fullName email role createdAt taskerProfile.approvalStatus')
                    .sort({ createdAt: -1 })
                    .limit(10);
                recentUsers.forEach(user => {
                    activities.push({
                        type: 'user_registration',
                        timestamp: user.createdAt,
                        title: `${user.fullName} registered as ${user.role}`,
                        description: user.role === 'tasker' 
                            ? `Approval status: ${user.taskerProfile?.approvalStatus || 'pending'}`
                            : 'New customer account created',
                        data: {
                            userId: user._id,
                            email: user.email,
                            role: user.role,
                            approvalStatus: user.taskerProfile?.approvalStatus
                        }
                    });
                });
            }
        } catch (err) {
            logger.error('Error fetching recent users for activity', { error: err.message, stack: err.stack });
            errorSections.push('users');
        }

        // Task Creations
        try {
            if (type === 'all' || type === 'tasks') {
                const recentTasks = await Task.find()
                    .populate('customer', 'fullName email')
                    .select('title category status createdAt agreedPayment')
                    .sort({ createdAt: -1 })
                    .limit(10);
                recentTasks.forEach(task => {
                    activities.push({
                        type: 'task_created',
                        timestamp: task.createdAt,
                        title: `New task: ${task.title}`,
                        description: `${task.category} task in ${task.area || 'N/A'} - ${task.status}`,
                        data: {
                            taskId: task._id,
                            category: task.category,
                            status: task.status,
                            customerName: task.customer?.fullName,
                            agreedPayment: task.agreedPayment
                        }
                    });
                });
            }
        } catch (err) {
            logger.error('Error fetching recent tasks for activity', { error: err.message, stack: err.stack });
            errorSections.push('tasks');
        }

        // Payments
        try {
            if (type === 'all' || type === 'payments') {
                const recentPayments = await Payment.find()
                    .populate('task', 'title category')
                    .populate('customer', 'fullName')
                    .populate('tasker', 'fullName')
                    .select('amount status paymentType createdAt')
                    .sort({ createdAt: -1 })
                    .limit(10);
                recentPayments.forEach(payment => {
                    activities.push({
                        type: 'payment_processed',
                        timestamp: payment.createdAt,
                        title: `Payment ${payment.status}: $${payment.amount}`,
                        description: `${payment.paymentType} payment for ${payment.task?.title}`,
                        data: {
                            paymentId: payment._id,
                            amount: payment.amount,
                            status: payment.status,
                            paymentType: payment.paymentType,
                            taskTitle: payment.task?.title,
                            customerName: payment.customer?.fullName,
                            taskerName: payment.tasker?.fullName
                        }
                    });
                });
            }
        } catch (err) {
            logger.error('Error fetching recent payments for activity', { error: err.message, stack: err.stack });
            errorSections.push('payments');
        }

        // Admin Actions
        try {
            if (type === 'all' || type === 'admin') {
                const recentAdminActions = await AdminActionLog.find()
                    .populate('adminId', 'fullName email')
                    .select('actionType targetModel details createdAt')
                    .sort({ createdAt: -1 })
                    .limit(10);
                recentAdminActions.forEach(action => {
                    activities.push({
                        type: 'admin_action',
                        timestamp: action.createdAt,
                        title: `${action.adminId?.fullName} performed ${action.actionType}`,
                        description: action.details,
                        data: {
                            adminId: action.adminId?._id,
                            adminName: action.adminId?.fullName,
                            actionType: action.actionType,
                            targetModel: action.targetModel,
                            details: action.details
                        }
                    });
                });
            }
        } catch (err) {
            logger.error('Error fetching recent admin actions for activity', { error: err.message, stack: err.stack });
            errorSections.push('admin');
        }

        // Task Completions
        try {
            if (type === 'all' || type === 'completions') {
                const recentCompletions = await Task.find({ status: 'completed' })
                    .populate('customer', 'fullName')
                    .populate('selectedTasker', 'fullName')
                    .select('title category customerRating customerCompletedAt')
                    .sort({ customerCompletedAt: -1 })
                    .limit(10);
                recentCompletions.forEach(task => {
                    activities.push({
                        type: 'task_completed',
                        timestamp: task.customerCompletedAt,
                        title: `Task completed: ${task.title}`,
                        description: `Rated ${task.customerRating}/5 stars by ${task.customer?.fullName}`,
                        data: {
                            taskId: task._id,
                            title: task.title,
                            category: task.category,
                            rating: task.customerRating,
                            customerName: task.customer?.fullName,
                            taskerName: task.selectedTasker?.fullName
                        }
                    });
                });
            }
        } catch (err) {
            logger.error('Error fetching recent completions for activity', { error: err.message, stack: err.stack });
            errorSections.push('completions');
        }

        // Sort all activities by timestamp (most recent first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Limit results
        const limitedActivities = activities.slice(0, parseInt(limit));

        await AdminActionLog.create({
            adminId: req.user._id,
            actionType: 'ANALYTICS_VIEWED',
            targetId: req.user._id,
            targetModel: 'User',
            details: `Admin viewed recent activity (type: ${type})`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: {
                type,
                limit: parseInt(limit),
                resultsCount: limitedActivities.length,
                errorSections
            }
        });

        logger.info('Recent activity retrieved successfully', {
            adminId: req.user._id,
            type,
            limit: parseInt(limit),
            resultsCount: limitedActivities.length,
            errorSections
        });

        res.json({
            success: true,
            message: 'Recent activity retrieved successfully',
            data: limitedActivities,
            lastUpdated: Date.now(),
            totalCount: activities.length,
            errorSections
        });

    } catch (error) {
        logger.error('Error in getRecentActivity', {
            error: error.message,
            adminId: req.user?._id,
            query: req.query,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve recent activity',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};



/**
 * Get all tasks with admin filtering and management
 * @route GET /api/admin/tasks
 * @access Admin only
 */
export const getAllTasks = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status = '',
            category = '',
            customerId = '',
            taskerId = '',
            dateFrom = '',
            dateTo = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = {};

        if (status) query.status = status;
        if (category) query.category = category;
        if (customerId) query.customer = customerId;
        if (taskerId) query.selectedTasker = taskerId;
        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
            if (dateTo) query.createdAt.$lte = new Date(dateTo);
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Sort options
        const sortOptions = {};
        const validSortFields = ['createdAt', 'startDate', 'maxPayment', 'status'];
        const validSortOrders = ['asc', 'desc'];

        if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder)) {
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
        } else {
            sortOptions.createdAt = -1; // Default sort
        }

        // Execute query
        const tasks = await Task.find(query)
            .populate('customer', 'fullName email phone')
            .populate('selectedTasker', 'fullName email phone')
            .populate('targetedTasker', 'fullName email phone')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit));

        // Get application counts for each task
        const tasksWithApplications = await Promise.all(
            tasks.map(async (task) => {
                const applicationCount = await Application.countDocuments({ task: task._id });
                return {
                    ...task.toObject(),
                    applicationCount
                };
            })
        );

        // Get total count for pagination
        const total = await Task.countDocuments(query);

        // Calculate pagination info
        const totalPages = Math.ceil(total / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        // Log admin action
        await AdminActionLog.create({
            adminId: req.user._id,
            actionType: 'TASKS_VIEWED',
            targetId: req.user._id,
            targetModel: 'Task',
            details: 'Admin viewed all tasks',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: {
                filters: { status, category, customerId, taskerId, dateFrom, dateTo },
                page: parseInt(page),
                limit: parseInt(limit),
                totalResults: total
            }
        });

        res.json({
            success: true,
            message: 'Tasks retrieved successfully',
            data: tasksWithApplications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNextPage,
                hasPrevPage
            },
            filters: {
                status,
                category,
                customerId,
                taskerId,
                dateFrom,
                dateTo,
                sortBy,
                sortOrder
            }
        });

    } catch (error) {
        logger.error('Error in getAllTasks', {
            error: error.message,
            adminId: req.user?._id,
            query: req.query
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve tasks',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get task details for admin
 * @route GET /api/admin/tasks/:taskId
 * @access Admin only
 */
export const getTaskDetails = async (req, res) => {
    try {
        const { taskId } = req.params;

        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: 'Task ID is required'
            });
        }

        // Find task with all related data
        const task = await Task.findById(taskId)
            .populate('customer', 'fullName email phone rating statistics')
            .populate('selectedTasker', 'fullName email phone rating statistics taskerProfile')
            .populate('targetedTasker', 'fullName email phone rating statistics taskerProfile');

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Get applications for this task
        const applications = await Application.find({ task: taskId })
            .populate('tasker', 'fullName email phone rating taskerProfile')
            .sort({ createdAt: -1 });

        // Get related data
        const relatedData = {
            applications: applications.length,
            recentApplications: applications.slice(0, 10),
            paymentInfo: null
        };

        // Get payment information if task is completed
        if (task.status === 'completed') {
            const payment = await Payment.findOne({ task: taskId });
            if (payment) {
                relatedData.paymentInfo = {
                    amount: payment.amount,
                    status: payment.status,
                    paidAt: payment.paidAt,
                    paymentMethod: payment.paymentMethod
                };
            }
        }

        res.json({
            success: true,
            message: 'Task details retrieved successfully',
            data: {
                task,
                relatedData
            }
        });

    } catch (error) {
        logger.error('Error in getTaskDetails', {
            error: error.message,
            adminId: req.user?._id,
            taskId: req.params.taskId
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve task details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Update task status (admin override)
 * @route PUT /api/admin/tasks/:taskId/status
 * @access Admin only
 */
export const updateTaskStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, reason } = req.body;

        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: 'Task ID is required'
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        // Validate status
        const validStatuses = ['active', 'scheduled', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        // Find the task
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        const previousStatus = task.status;

        // Update task status
        task.status = status;
        if (reason) {
            task.adminNotes = reason;
        }

        await task.save();

        // Create audit log
        await AdminActionLog.create({
            adminId: req.user._id,
            actionType: 'TASK_STATUS_UPDATED',
            targetId: taskId,
            targetModel: 'Task',
            details: `Task status changed from ${previousStatus} to ${status}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: {
                previousStatus,
                newStatus: status,
                reason
            }
        });

        res.json({
            success: true,
            message: 'Task status updated successfully',
            data: {
                taskId,
                previousStatus,
                newStatus: status,
                reason
            }
        });

    } catch (error) {
        logger.error('Error in updateTaskStatus', {
            error: error.message,
            adminId: req.user?._id,
            taskId: req.params.taskId
        });

        res.status(500).json({
            success: false,
            message: 'Failed to update task status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get task statistics for admin dashboard
 * @route GET /api/admin/tasks/stats
 * @access Admin only
 */
export const getTaskStats = async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get task statistics
        const [
            totalTasks,
            activeTasks,
            completedTasks,
            cancelledTasks,
            tasksByStatus,
            tasksByCategory,
            averageTaskValue,
            totalTaskValue
        ] = await Promise.all([
            Task.countDocuments({ createdAt: { $gte: startDate } }),
            Task.countDocuments({ status: 'active', createdAt: { $gte: startDate } }),
            Task.countDocuments({ status: 'completed', createdAt: { $gte: startDate } }),
            Task.countDocuments({ status: 'cancelled', createdAt: { $gte: startDate } }),
            Task.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Task.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ]),
            Task.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: null, avgValue: { $avg: '$maxPayment' } } }
            ]),
            Task.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: null, totalValue: { $sum: '$maxPayment' } } }
            ])
        ]);

        // Format statistics
        const stats = {
            period,
            overview: {
                totalTasks,
                activeTasks,
                completedTasks,
                cancelledTasks,
                completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(2) : 0
            },
            byStatus: tasksByStatus.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            byCategory: tasksByCategory.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            financial: {
                averageTaskValue: averageTaskValue[0]?.avgValue || 0,
                totalTaskValue: totalTaskValue[0]?.totalValue || 0
            }
        };

        res.json({
            success: true,
            message: 'Task statistics retrieved successfully',
            data: stats
        });

    } catch (error) {
        logger.error('Error in getTaskStats', {
            error: error.message,
            adminId: req.user?._id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve task statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get user statistics for admin dashboard
 * @route GET /api/admin/users/stats
 * @access Admin only
 */
export const getUserStats = async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get user statistics
        const [
            totalUsers,
            newUsers,
            activeUsers,
            suspendedUsers,
            usersByRole,
            taskerApprovalStats,
            topTaskers,
            topCustomers
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: startDate } }),
            User.countDocuments({ isSuspended: { $ne: true } }),
            User.countDocuments({ isSuspended: true }),
            User.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } }
            ]),
            User.aggregate([
                { $match: { role: 'tasker' } },
                { $group: { _id: '$taskerProfile.approvalStatus', count: { $sum: 1 } } }
            ]),
            User.aggregate([
                { $match: { role: 'tasker' } },
                { $sort: { 'statistics.tasksCompleted': -1 } },
                { $limit: 10 },
                { $project: { fullName: 1, email: 1, 'statistics.tasksCompleted': 1, 'rating.average': 1 } }
            ]),
            User.aggregate([
                { $match: { role: 'customer' } },
                { $sort: { 'statistics.tasksPosted': -1 } },
                { $limit: 10 },
                { $project: { fullName: 1, email: 1, 'statistics.tasksPosted': 1, 'statistics.totalSpent': 1 } }
            ])
        ]);

        // Format statistics
        const stats = {
            period,
            overview: {
                totalUsers,
                newUsers,
                activeUsers,
                suspendedUsers,
                growthRate: totalUsers > 0 ? (newUsers / totalUsers * 100).toFixed(2) : 0
            },
            byRole: usersByRole.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            taskerApproval: taskerApprovalStats.reduce((acc, item) => {
                acc[item._id || 'pending'] = item.count;
                return acc;
            }, {}),
            topPerformers: {
                taskers: topTaskers,
                customers: topCustomers
            }
        };

        res.json({
            success: true,
            message: 'User statistics retrieved successfully',
            data: stats
        });

    } catch (error) {
        logger.error('Error in getUserStats', {
            error: error.message,
            adminId: req.user?._id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get payment statistics for admin dashboard
 * @route GET /api/admin/payments/stats
 * @access Admin only
 */
export const getPaymentStats = async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get payment statistics
        const [
            totalPayments,
            successfulPayments,
            pendingPayments,
            failedPayments,
            totalRevenue,
            averagePayment,
            paymentsByStatus,
            revenueByMonth
        ] = await Promise.all([
            Payment.countDocuments({ createdAt: { $gte: startDate } }),
            Payment.countDocuments({ status: 'completed', createdAt: { $gte: startDate } }),
            Payment.countDocuments({ status: 'pending', createdAt: { $gte: startDate } }),
            Payment.countDocuments({ status: 'failed', createdAt: { $gte: startDate } }),
            Payment.aggregate([
                { $match: { status: 'completed', createdAt: { $gte: startDate } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Payment.aggregate([
                { $match: { status: 'completed', createdAt: { $gte: startDate } } },
                { $group: { _id: null, avg: { $avg: '$amount' } } }
            ]),
            Payment.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
            ]),
            Payment.aggregate([
                { $match: { status: 'completed', createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        revenue: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ])
        ]);

        // Format statistics
        const stats = {
            period,
            overview: {
                totalPayments,
                successfulPayments,
                pendingPayments,
                failedPayments,
                successRate: totalPayments > 0 ? (successfulPayments / totalPayments * 100).toFixed(2) : 0
            },
            financial: {
                totalRevenue: totalRevenue[0]?.total || 0,
                averagePayment: averagePayment[0]?.avg || 0
            },
            byStatus: paymentsByStatus.reduce((acc, item) => {
                acc[item._id] = {
                    count: item.count,
                    total: item.total
                };
                return acc;
            }, {}),
            revenueByMonth: revenueByMonth.map(item => ({
                month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
                revenue: item.revenue,
                count: item.count
            })),
            // Add platform revenue by month
            platformRevenueByMonth: await Payment.aggregate([
                { $match: { status: 'completed', paymentType: 'advance', createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        platformRevenue: { $sum: '$platformCommissionAmount' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]).then(results => results.map(item => ({
                month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
                platformRevenue: item.platformRevenue,
                count: item.count
            }))),
            // Add platform revenue values for chart
            platformRevenueValues: await Payment.aggregate([
                { $match: { status: 'completed', paymentType: 'advance', createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: { $month: '$createdAt' },
                        revenue: { $sum: '$platformCommissionAmount' }
                    }
                },
                { $sort: { '_id': 1 } }
            ]).then(results => {
                const monthlyData = Array(12).fill(0);
                results.forEach(item => {
                    monthlyData[item._id - 1] = item.revenue;
                });
                return monthlyData;
            })
        };

        res.json({
            success: true,
            message: 'Payment statistics retrieved successfully',
            data: stats
        });

    } catch (error) {
        logger.error('Error in getPaymentStats', {
            error: error.message,
            adminId: req.user?._id
        });

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve payment statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
