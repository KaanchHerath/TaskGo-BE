import express from "express";
import { 
    // Existing admin controller functions
    getAllUsers as adminGetAllUsers, 
    deleteUser,
    getPendingTaskers,
    approveTasker,
    rejectTasker,
    getTaskerApprovalDetails,
    getApprovalStats,
    getDashboardStats,
    getRecentActivity,

    testAdminEndpoint,
    getAllTasks,
    getTaskDetails,
    updateTaskStatus,
    getTaskStats,
    getUserStats,
    getPaymentStats,
    testDatabaseConnection
} from "../controllers/adminController.js";

import { 
    getAllUsers, 
    getUserDetails, 
    suspendUser 
} from "../controllers/userController.js";

import { verifyToken, authorize } from "../middleware/auth.js";

const router = express.Router();

// ============================================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ============================================================================
// All routes require admin authentication and authorization
router.use(verifyToken);
router.use(authorize(['admin']));

// ============================================================================
// DASHBOARD STATISTICS ROUTES
// ============================================================================

/**
 * @route GET /api/admin/test
 * @desc Test admin endpoint
 * @access Admin only
 */
router.get("/test", testAdminEndpoint);

/**
 * @route GET /api/admin/test-db
 * @desc Test database connectivity and basic operations
 * @access Admin only
 */
router.get("/test-db", testDatabaseConnection);

/**
 * @route GET /api/admin/dashboard/stats
 * @desc Get comprehensive dashboard statistics
 * @access Admin only
 */
router.get("/dashboard/stats", getDashboardStats);

/**
 * @route GET /api/admin/dashboard/recent-activity
 * @desc Get recent admin activity and system events
 * @access Admin only
 */
router.get("/dashboard/recent-activity", getRecentActivity);



/**
 * @route GET /api/admin/dashboard/tasks/stats
 * @desc Get task-specific statistics for dashboard
 * @access Admin only
 */
router.get("/dashboard/tasks/stats", getTaskStats);

/**
 * @route GET /api/admin/dashboard/users/stats
 * @desc Get user-specific statistics for dashboard
 * @access Admin only
 */
router.get("/dashboard/users/stats", getUserStats);

/**
 * @route GET /api/admin/dashboard/payments/stats
 * @desc Get payment-specific statistics for dashboard
 * @access Admin only
 */
router.get("/dashboard/payments/stats", getPaymentStats);

// ============================================================================
// TASKER APPROVAL MANAGEMENT ROUTES
// ============================================================================

/**
 * @route GET /api/admin/taskers/pending
 * @desc Get pending taskers for approval with pagination and filtering
 * @access Admin only
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @query {string} status - Filter by status: pending, rejected, all (default: pending)
 */
router.get("/taskers/pending", getPendingTaskers);

/**
 * @route POST /api/admin/taskers/:taskerId/approve
 * @desc Approve a tasker application
 * @access Admin only
 * @body {string} notes - Optional approval notes
 */
router.post("/taskers/:taskerId/approve", approveTasker);

/**
 * @route POST /api/admin/taskers/:taskerId/reject
 * @desc Reject a tasker application
 * @access Admin only
 * @body {string} reason - Rejection reason (required)
 * @body {string} notes - Optional additional notes
 */
router.post("/taskers/:taskerId/reject", rejectTasker);

/**
 * @route GET /api/admin/taskers/:taskerId/approval
 * @desc Get detailed approval information for a specific tasker
 * @access Admin only
 */
router.get("/taskers/:taskerId/approval", getTaskerApprovalDetails);

/**
 * @route GET /api/admin/taskers/approval-stats
 * @desc Get approval statistics and metrics
 * @access Admin only
 */
router.get("/taskers/approval-stats", getApprovalStats);

// ============================================================================
// ENHANCED USER MANAGEMENT ROUTES
// ============================================================================

/**
 * @route GET /api/admin/users
 * @desc Get all users with advanced filtering, pagination, and search
 * @access Admin only
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @query {string} search - Search term for name, email, or phone
 * @query {string} role - Filter by role: customer, tasker, admin
 * @query {string} status - Filter by status: active, suspended, approved, pending, rejected
 * @query {string} sortBy - Sort field: createdAt, fullName, email, rating.average, statistics.tasksCompleted
 * @query {string} sortOrder - Sort order: asc, desc (default: desc)
 */
router.get("/users", getAllUsers);

/**
 * @route GET /api/admin/users/:userId
 * @desc Get detailed user information with related data
 * @access Admin only
 */
router.get("/users/:userId", getUserDetails);

/**
 * @route PUT /api/admin/users/:userId/suspend
 * @desc Suspend or unsuspend a user account
 * @access Admin only
 * @body {string} action - Action to perform: suspend, unsuspend
 * @body {string} reason - Reason for suspension (required for suspend action)
 */
router.put("/users/:userId/suspend", suspendUser);

/**
 * @route DELETE /api/admin/users/:userId
 * @desc Delete a user account (permanent)
 * @access Admin only
 */
router.delete("/users/:userId", deleteUser);

// ============================================================================
// TASK MANAGEMENT ROUTES
// ============================================================================

/**
 * @route GET /api/admin/tasks
 * @desc Get all tasks with admin filtering and management
 * @access Admin only
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @query {string} status - Filter by task status
 * @query {string} category - Filter by task category
 * @query {string} customerId - Filter by customer ID
 * @query {string} taskerId - Filter by selected tasker ID
 * @query {string} dateFrom - Filter by start date (ISO format)
 * @query {string} dateTo - Filter by end date (ISO format)
 * @query {string} sortBy - Sort field: createdAt, startDate, maxPayment, status
 * @query {string} sortOrder - Sort order: asc, desc (default: desc)
 */
router.get("/tasks", getAllTasks);

/**
 * @route GET /api/admin/tasks/:taskId
 * @desc Get detailed task information with related data
 * @access Admin only
 */
router.get("/tasks/:taskId", getTaskDetails);

/**
 * @route PUT /api/admin/tasks/:taskId/status
 * @desc Update task status (admin override)
 * @access Admin only
 * @body {string} status - New status: active, scheduled, in_progress, completed, cancelled
 * @body {string} reason - Optional reason for status change
 */
router.put("/tasks/:taskId/status", updateTaskStatus);

// ============================================================================
// LEGACY ROUTES (for backward compatibility)
// ============================================================================

/**
 * @route GET /api/admin/user/:id
 * @desc Legacy route for getting a single user (redirects to new format)
 * @access Admin only
 * @deprecated Use GET /api/admin/users/:userId instead
 */
router.get("/user/:id", (req, res) => {
    res.redirect(307, `/api/admin/users/${req.params.id}`);
});

/**
 * @route DELETE /api/admin/user/:id
 * @desc Legacy route for deleting a user (redirects to new format)
 * @access Admin only
 * @deprecated Use DELETE /api/admin/users/:userId instead
 */
router.delete("/user/:id", (req, res) => {
    res.redirect(307, `/api/admin/users/${req.params.id}`);
});

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// Handle 404 for admin routes
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Admin route not found',
        path: req.originalUrl,
        method: req.method
    });
});

export default router;
