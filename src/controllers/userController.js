import User from "../models/User.js";
import Task from "../models/Task.js";
import Application from "../models/Application.js";
import Feedback from "../models/Feedback.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        // Validate input
        if (!name || !email || !password || !role) {
            return res.status(400).json({ 
                message: "Please provide all required fields: name, email, password, and role",
                errorType: "missing_fields"
            });
        }

        // Check if email format is valid
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: "Please enter a valid email address",
                errorType: "invalid_email"
            });
        }

        // Check password strength
        if (password.length < 8) {
            return res.status(400).json({ 
                message: "Password must be at least 8 characters long",
                errorType: "weak_password"
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                message: "An account with this email already exists. Please use a different email or try logging in.",
                errorType: "duplicate_email"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, role });

        await newUser.save();
        res.status(201).json({ 
            message: "Account created successfully! You can now log in.",
            success: true
        });
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                message: "Please check your input and try again",
                errors: validationErrors,
                errorType: "validation_error"
            });
        }
        
        res.status(500).json({ 
            message: "We're experiencing technical difficulties. Please try again later.",
            errorType: "server_error"
        });
    }
};

export const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Validate input
        if (!email || !password) {
            return res.status(400).json({ 
                message: "Please provide both email and password",
                errorType: "missing_fields"
            });
        }

        // Check if email format is valid
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: "Please enter a valid email address",
                errorType: "invalid_email"
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                message: "Invalid email or password. Please check your credentials and try again.",
                errorType: "invalid_credentials"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                message: "Invalid email or password. Please check your credentials and try again.",
                errorType: "invalid_credentials"
            });
        }

        // Check if user is suspended
        if (user.isSuspended) {
            return res.status(403).json({ 
                message: "Account is suspended. Please contact support for assistance.",
                accountStatus: "suspended"
            });
        }

        // Check tasker approval status
        let approvalStatus = null;
        if (user.role === 'tasker') {
            approvalStatus = user.taskerProfile?.approvalStatus || 'pending';
            
            // If tasker is not approved, provide specific message
            if (approvalStatus !== 'approved') {
                return res.status(403).json({
                    message: approvalStatus === 'pending' 
                        ? "Your account is pending approval. You will be notified once approved."
                        : "Your account has been rejected. Please contact support for more information.",
                    accountStatus: "not_approved",
                    approvalStatus: approvalStatus,
                    rejectionReason: user.taskerProfile?.rejectionReason || null
                });
            }
        }

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

        // Prepare user response data
        const userData = {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            phone: user.phone
        };

        // Add approval status for taskers
        if (user.role === 'tasker') {
            userData.approvalStatus = approvalStatus;
            userData.isApproved = user.taskerProfile?.isApproved || false;
        }

        res.json({ 
            token, 
            user: userData,
            accountStatus: "active"
        });
    } catch (error) {
        console.error('Login error:', error);
        
        // Provide more specific error messages based on error type
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                message: "Please check your input and try again",
                errorType: "validation_error"
            });
        }
        
        if (error.name === 'MongoError' && error.code === 11000) {
            return res.status(400).json({ 
                message: "An account with this email already exists",
                errorType: "duplicate_email"
            });
        }
        
        res.status(500).json({ 
            message: "We're experiencing technical difficulties. Please try again later.",
            errorType: "server_error"
        });
    }
};

export const getProfile = async (req, res) => {
    try {

        let user = null;
        if (req.user && req.user._id) {
            user = await User.findById(req.user._id).select('-password');
        } else if (req.user && req.user.email) {
            user = await User.findOne({ email: req.user.email }).select('-password');
        }
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const {
            fullName,
            phone,
            taskerProfile,
            customerProfile
        } = req.body;

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Validate phone format if provided
        if (phone) {
            const phoneRegex = /^\+?[\d\s-]{10,}$/;
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({ message: "Invalid phone number format" });
            }
            
            // Check if phone is already taken by another user
            const existingUserWithPhone = await User.findOne({ 
                phone: phone, 
                _id: { $ne: userId } 
            });
            if (existingUserWithPhone) {
                return res.status(400).json({ message: "Phone number is already in use" });
            }
        }

        // Prepare update data
        const updateData = {};
        
        if (fullName) updateData.fullName = fullName;
        if (phone) updateData.phone = phone;

        // Handle tasker profile updates
        if (user.role === 'tasker' && taskerProfile) {
            const currentTaskerProfile = user.taskerProfile || {};
            
            // Validate hourly rate if provided
            if (taskerProfile.hourlyRate !== undefined) {
                const hourlyRate = Number(taskerProfile.hourlyRate);
                if (isNaN(hourlyRate) || hourlyRate < 0) {
                    return res.status(400).json({ message: "Hourly rate must be a positive number" });
                }
                if (hourlyRate > 50000) {
                    return res.status(400).json({ message: "Hourly rate cannot exceed LKR 50,000 per hour" });
                }
                if (hourlyRate > 0 && hourlyRate < 500) {
                    return res.status(400).json({ message: "Hourly rate should be at least LKR 500 per hour" });
                }
            }

            // Validate advance payment amount if provided
            if (taskerProfile.advancePaymentAmount !== undefined) {
                const advanceAmount = Number(taskerProfile.advancePaymentAmount);
                if (isNaN(advanceAmount) || advanceAmount < 0) {
                    return res.status(400).json({ message: "Advance payment amount must be a positive number" });
                }
                if (advanceAmount > 100000) {
                    return res.status(400).json({ message: "Advance payment amount cannot exceed LKR 100,000" });
                }
            }
            
            updateData.taskerProfile = {
                ...currentTaskerProfile,
                ...(taskerProfile.skills && { skills: taskerProfile.skills }),
                ...(taskerProfile.bio && { bio: taskerProfile.bio }),
                ...(taskerProfile.experience && { experience: taskerProfile.experience }),
                ...(taskerProfile.province && { province: taskerProfile.province }),
                ...(taskerProfile.district && { district: taskerProfile.district }),
                ...(taskerProfile.hourlyRate !== undefined && { hourlyRate: Number(taskerProfile.hourlyRate) }),
                ...(taskerProfile.advancePaymentAmount !== undefined && { advancePaymentAmount: Number(taskerProfile.advancePaymentAmount) }),
                ...(typeof taskerProfile.isAvailable === 'boolean' && { isAvailable: taskerProfile.isAvailable })
            };

            // Validate skills if provided
            if (taskerProfile.skills && (!Array.isArray(taskerProfile.skills) || taskerProfile.skills.length === 0)) {
                return res.status(400).json({ message: "At least one skill is required for taskers" });
            }
        }

        // Handle customer profile updates
        if (user.role === 'customer' && customerProfile) {
            const currentCustomerProfile = user.customerProfile || {};
            
            updateData.customerProfile = {
                ...currentCustomerProfile,
                ...(customerProfile.province && { province: customerProfile.province }),
                ...(customerProfile.bio && { bio: customerProfile.bio })
            };
        }

        // Update the user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { 
                new: true, 
                runValidators: true 
            }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'Profile updated successfully',
            ...updatedUser.toObject()
        });

    } catch (error) {
        console.error('Update profile error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        res.status(500).json({ message: 'An error occurred while updating profile' });
    }
};

export const changePassword = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }

        // Password strength validation
        const validatePassword = (password) => {
            const minLength = 8;
            const hasUpperCase = /[A-Z]/.test(password);
            const hasLowerCase = /[a-z]/.test(password);
            const hasNumbers = /\d/.test(password);
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

            if (password.length < minLength) {
                return "Password must be at least 8 characters long";
            }
            if (!hasUpperCase) {
                return "Password must contain at least one uppercase letter";
            }
            if (!hasLowerCase) {
                return "Password must contain at least one lowercase letter";
            }
            if (!hasNumbers) {
                return "Password must contain at least one number";
            }
            if (!hasSpecialChar) {
                return "Password must contain at least one special character";
            }
            return null;
        };

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Check if new password is different from current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({ message: 'New password must be different from current password' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await User.findByIdAndUpdate(userId, { password: hashedNewPassword });

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'An error occurred while changing password' });
    }
};

/**
 * Get approval status for taskers
 * @route GET /api/users/approval-status
 * @access Tasker only
 */
export const getApprovalStatus = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;

        // Find the user
        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is a tasker
        if (user.role !== 'tasker') {
            return res.status(403).json({
                success: false,
                message: 'This endpoint is only available for taskers'
            });
        }

        // Get approval status
        const approvalStatus = user.taskerProfile?.approvalStatus || 'pending';
        const isApproved = user.taskerProfile?.isApproved || false;
        const rejectionReason = user.taskerProfile?.rejectionReason || null;
        const approvedAt = user.taskerProfile?.approvedAt || null;
        const approvedBy = user.taskerProfile?.approvedBy || null;

        // Get additional context for pending applications
        let additionalInfo = {};
        if (approvalStatus === 'pending') {
            // Count how many days since registration
            const daysSinceRegistration = Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
            additionalInfo = {
                daysSinceRegistration,
                estimatedProcessingTime: '3-5 business days',
                canUpdateProfile: true
            };
        } else if (approvalStatus === 'rejected') {
            additionalInfo = {
                canReapply: true,
                reapplicationInstructions: 'Please update your profile and documents, then contact support to request re-evaluation.'
            };
        } else if (approvalStatus === 'approved') {
            additionalInfo = {
                approvedAt: approvedAt,
                approvedBy: approvedBy ? 'Admin' : null,
                canStartWorking: true
            };
        }

        res.json({
            success: true,
            message: 'Approval status retrieved successfully',
            data: {
                approvalStatus,
                isApproved,
                rejectionReason,
                approvedAt,
                approvedBy,
                additionalInfo
            }
        });

    } catch (error) {
        console.error('Get approval status error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while retrieving approval status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get all users with pagination, filtering, and search
 * @route GET /api/users
 * @access Admin only
 */
export const getAllUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            role = '',
            status = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = {};

        // Search functionality
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // Role filter
        if (role && ['customer', 'tasker', 'admin'].includes(role)) {
            query.role = role;
        }

        // Status filter for taskers
        if (status && role === 'tasker') {
            if (status === 'approved') {
                query['taskerProfile.approvalStatus'] = 'approved';
            } else if (status === 'pending') {
                query['taskerProfile.approvalStatus'] = 'pending';
            } else if (status === 'rejected') {
                query['taskerProfile.approvalStatus'] = 'rejected';
            } else if (status === 'suspended') {
                query.isSuspended = true;
            }
        }

        // Status filter for all users
        if (status === 'suspended') {
            query.isSuspended = true;
        } else if (status === 'active') {
            query.isSuspended = { $ne: true };
        }

        // Province filter (matches customer and tasker profiles)
        if (req.query.province) {
            const province = req.query.province;
            query.$or = (query.$or || []).concat([
                { 'taskerProfile.province': province },
                { 'customerProfile.province': province }
            ]);
        }

        // Registration date filter
        if (req.query.registrationDate) {
            const now = new Date();
            let startDate = null;
            const value = String(req.query.registrationDate);
            switch (value) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week': {
                    const dayOfWeek = now.getDay();
                    const diffToMonday = (dayOfWeek + 6) % 7; // 0=>Mon
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - diffToMonday);
                    startDate.setHours(0,0,0,0);
                    break;
                }
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'quarter': {
                    const currentQuarter = Math.floor(now.getMonth() / 3);
                    startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
                    break;
                }
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
                default:
                    startDate = null;
            }
            if (startDate) {
                query.createdAt = { $gte: startDate };
            }
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Sort options
        const sortOptions = {};
        const validSortFields = ['createdAt', 'fullName', 'email', 'role', 'isSuspended', 'rating.average', 'statistics.tasksCompleted', 'lastActive'];
        const validSortOrders = ['asc', 'desc'];

        if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder)) {
            // Map frontend 'lastActive' to 'updatedAt'
            const sortField = sortBy === 'lastActive' ? 'updatedAt' : sortBy;
            sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;
        } else {
            sortOptions.createdAt = -1; // Default sort
        }

        // Execute query
        const users = await User.find(query)
            .select('-password')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('taskerProfile.approvedBy', 'fullName email');

        // Get total count for pagination
        const total = await User.countDocuments(query);

        // Calculate pagination info
        const totalPages = Math.ceil(total / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        // Prepare response data
        const usersData = users.map(user => {
            const userObj = user.toObject();
            
            // Add computed fields
            userObj.isActive = !userObj.isSuspended;
            userObj.approvalStatus = userObj.taskerProfile?.approvalStatus || null;
            userObj.isApproved = userObj.taskerProfile?.isApproved || false;
            userObj.province = userObj.taskerProfile?.province || userObj.customerProfile?.province || null;
            userObj.district = userObj.taskerProfile?.district || null;
            userObj.lastActive = userObj.updatedAt || null;
            
            return userObj;
        });

        res.json({
            success: true,
            message: 'Users retrieved successfully',
            data: usersData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNextPage,
                hasPrevPage
            },
            filters: {
                search,
                role,
                status,
                sortBy,
                sortOrder
            }
        });

    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while retrieving users',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Get detailed user information
 * @route GET /api/users/:userId
 * @access Admin only
 */
export const getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Find user with all related data
        const user = await User.findById(userId)
            .select('-password')
            .populate('taskerProfile.approvedBy', 'fullName email');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get related data based on user role
        let relatedData = {};

        if (user.role === 'tasker') {
            // Get tasks applied to by this tasker
            const applications = await Application.find({ taskerId: userId })
                .populate('taskId', 'title description budget status createdAt')
                .sort({ createdAt: -1 })
                .limit(10);

            // Get recent feedback received
            const feedback = await Feedback.find({ taskerId: userId })
                .populate('customerId', 'fullName')
                .populate('taskId', 'title')
                .sort({ createdAt: -1 })
                .limit(5);

            relatedData = {
                applications: applications.length,
                recentApplications: applications,
                feedback: feedback.length,
                recentFeedback: feedback
            };
        } else if (user.role === 'customer') {
            // Get tasks posted by this customer
            const tasks = await Task.find({ customerId: userId })
                .sort({ createdAt: -1 })
                .limit(10);

            // Get recent feedback given
            const feedback = await Feedback.find({ customerId: userId })
                .populate('taskerId', 'fullName')
                .populate('taskId', 'title')
                .sort({ createdAt: -1 })
                .limit(5);

            relatedData = {
                tasksPosted: tasks.length,
                recentTasks: tasks,
                feedbackGiven: feedback.length,
                recentFeedback: feedback
            };
        }

        // Prepare user data
        const userData = user.toObject();
        userData.isActive = !userData.isSuspended;
        userData.approvalStatus = userData.taskerProfile?.approvalStatus || null;
        userData.isApproved = userData.taskerProfile?.isApproved || false;

        // Add account age
        const accountAge = Math.floor((Date.now() - new Date(userData.createdAt)) / (1000 * 60 * 60 * 24));
        userData.accountAge = accountAge;

        res.json({
            success: true,
            message: 'User details retrieved successfully',
            data: {
                user: userData,
                relatedData
            }
        });

    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while retrieving user details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

/**
 * Suspend or unsuspend a user account
 * @route PUT /api/users/:userId/suspend
 * @access Admin only
 */
export const suspendUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { action, reason } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        if (!action || !['suspend', 'unsuspend'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Action must be either "suspend" or "unsuspend"'
            });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if trying to suspend an admin
        if (user.role === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Cannot suspend admin accounts'
            });
        }

        // Check current suspension status
        const isCurrentlySuspended = user.isSuspended || false;

        if (action === 'suspend' && isCurrentlySuspended) {
            return res.status(400).json({
                success: false,
                message: 'User is already suspended'
            });
        }

        if (action === 'unsuspend' && !isCurrentlySuspended) {
            return res.status(400).json({
                success: false,
                message: 'User is not currently suspended'
            });
        }

        // Update user suspension status
        const updateData = {
            isSuspended: action === 'suspend',
            suspendedAt: action === 'suspend' ? new Date() : null,
            suspendedBy: action === 'suspend' ? req.user._id : null,
            suspensionReason: action === 'suspend' ? reason : null
        };

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        // Log admin action
        try {
            const AdminActionLog = (await import('../models/AdminActionLog.js')).default;
            await AdminActionLog.create({
                adminId: req.user._id,
                actionType: action === 'suspend' ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED',
                targetId: userId,
                targetModel: 'User',
                details: `${action === 'suspend' ? 'Suspended' : 'Unsuspended'} user account`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                metadata: {
                    reason: action === 'suspend' ? reason : null,
                    previousStatus: isCurrentlySuspended ? 'suspended' : 'active'
                }
            });
        } catch (logError) {
            console.error('Failed to log admin action:', logError);
        }

        res.json({
            success: true,
            message: `User ${action === 'suspend' ? 'suspended' : 'unsuspended'} successfully`,
            data: {
                user: updatedUser,
                action,
                reason: action === 'suspend' ? reason : null,
                suspendedAt: updatedUser.suspendedAt,
                suspendedBy: updatedUser.suspendedBy
            }
        });

    } catch (error) {
        console.error('Suspend user error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing the suspension',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
