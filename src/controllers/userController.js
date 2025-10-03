import User from "../models/User.js";
import Task from "../models/Task.js";
import Application from "../models/Application.js";
import Feedback from "../models/Feedback.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        if (!name || !email || !password || !role) {
            return res.status(400).json({ 
                message: "Please provide all required fields: name, email, password, and role",
                errorType: "missing_fields"
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: "Please enter a valid email address",
                errorType: "invalid_email"
            });
        }

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
        if (!email || !password) {
            return res.status(400).json({ 
                message: "Please provide both email and password",
                errorType: "missing_fields"
            });
        }

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

        if (user.isSuspended) {
            return res.status(403).json({ 
                message: "Account is suspended. Please contact support for assistance.",
                accountStatus: "suspended"
            });
        }

        let approvalStatus = null;
        if (user.role === 'tasker') {
            approvalStatus = user.taskerProfile?.approvalStatus || 'pending';
            
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

        const userData = {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            phone: user.phone
        };

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

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (phone) {
            const phoneRegex = /^\+?[\d\s-]{10,}$/;
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({ message: "Invalid phone number format" });
            }
            
            const existingUserWithPhone = await User.findOne({ 
                phone: phone, 
                _id: { $ne: userId } 
            });
            if (existingUserWithPhone) {
                return res.status(400).json({ message: "Phone number is already in use" });
            }
        }

        const updateData = {};
        
        if (fullName) updateData.fullName = fullName;
        if (phone) updateData.phone = phone;

        if (user.role === 'tasker' && taskerProfile) {
            const currentTaskerProfile = user.taskerProfile || {};
            
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

            if (taskerProfile.skills && (!Array.isArray(taskerProfile.skills) || taskerProfile.skills.length === 0)) {
                return res.status(400).json({ message: "At least one skill is required for taskers" });
            }
        }

        if (user.role === 'customer' && customerProfile) {
            const currentCustomerProfile = user.customerProfile || {};
            
            updateData.customerProfile = {
                ...currentCustomerProfile,
                ...(customerProfile.province && { province: customerProfile.province }),
                ...(customerProfile.bio && { bio: customerProfile.bio })
            };
        }

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

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }

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

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({ message: 'New password must be different from current password' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        await User.findByIdAndUpdate(userId, { password: hashedNewPassword });

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'An error occurred while changing password' });
    }
};

export const getApprovalStatus = async (req, res) => {
    try {
        const userId = req.user._id || req.user.userId;

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.role !== 'tasker') {
            return res.status(403).json({
                success: false,
                message: 'This endpoint is only available for taskers'
            });
        }

        const approvalStatus = user.taskerProfile?.approvalStatus || 'pending';
        const isApproved = user.taskerProfile?.isApproved || false;
        const rejectionReason = user.taskerProfile?.rejectionReason || null;
        const approvedAt = user.taskerProfile?.approvedAt || null;
        const approvedBy = user.taskerProfile?.approvedBy || null;

        let additionalInfo = {};
        if (approvalStatus === 'pending') {
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

        const query = {};

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        if (role && ['customer', 'tasker', 'admin'].includes(role)) {
            query.role = role;
        }

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

        if (status === 'suspended') {
            query.isSuspended = true;
        } else if (status === 'active') {
            query.isSuspended = { $ne: true };
        }

        if (req.query.province) {
            const province = req.query.province;
            query.$or = (query.$or || []).concat([
                { 'taskerProfile.province': province },
                { 'customerProfile.province': province }
            ]);
        }

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
                    const diffToMonday = (dayOfWeek + 6) % 7;
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

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const sortOptions = {};
        const validSortFields = ['createdAt', 'fullName', 'email', 'role', 'isSuspended', 'rating.average', 'statistics.tasksCompleted', 'lastActive'];
        const validSortOrders = ['asc', 'desc'];

        if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder)) {
            const sortField = sortBy === 'lastActive' ? 'updatedAt' : sortBy;
            sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;
        } else {
            sortOptions.createdAt = -1;
        }

        const users = await User.find(query)
            .select('-password')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('taskerProfile.approvedBy', 'fullName email');

        const total = await User.countDocuments(query);

        const totalPages = Math.ceil(total / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        const usersData = users.map(user => {
            const userObj = user.toObject();
            
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

export const getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const user = await User.findById(userId)
            .select('-password')
            .populate('taskerProfile.approvedBy', 'fullName email');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        let relatedData = {};

        if (user.role === 'tasker') {
            const applications = await Application.find({ taskerId: userId })
                .populate('taskId', 'title description budget status createdAt')
                .sort({ createdAt: -1 })
                .limit(10);

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
            const tasks = await Task.find({ customerId: userId })
                .sort({ createdAt: -1 })
                .limit(10);

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

        const userData = user.toObject();
        userData.isActive = !userData.isSuspended;
        userData.approvalStatus = userData.taskerProfile?.approvalStatus || null;
        userData.isApproved = userData.taskerProfile?.isApproved || false;

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

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.role === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Cannot suspend admin accounts'
            });
        }

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
