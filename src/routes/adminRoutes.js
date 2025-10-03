import express from "express";
import { 
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

router.use(verifyToken);
router.use(authorize(['admin']));

router.get("/test", testAdminEndpoint);
router.get("/test-db", testDatabaseConnection);

router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/recent-activity", getRecentActivity);
router.get("/dashboard/tasks/stats", getTaskStats);
router.get("/dashboard/users/stats", getUserStats);
router.get("/dashboard/payments/stats", getPaymentStats);

router.get("/taskers/pending", getPendingTaskers);
router.post("/taskers/:taskerId/approve", approveTasker);
router.post("/taskers/:taskerId/reject", rejectTasker);
router.get("/taskers/:taskerId/approval", getTaskerApprovalDetails);
router.get("/taskers/approval-stats", getApprovalStats);

router.get("/users", getAllUsers);
router.get("/users/:userId", getUserDetails);
router.put("/users/:userId/suspend", suspendUser);
router.delete("/users/:userId", deleteUser);

router.get("/tasks", getAllTasks);
router.get("/tasks/:taskId", getTaskDetails);
router.put("/tasks/:taskId/status", updateTaskStatus);

router.get("/user/:id", (req, res) => {
    res.redirect(307, `/api/admin/users/${req.params.id}`);
});
router.delete("/user/:id", (req, res) => {
    res.redirect(307, `/api/admin/users/${req.params.id}`);
});

router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Admin route not found',
        path: req.originalUrl,
        method: req.method
    });
});

export default router;
