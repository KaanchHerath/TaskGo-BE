import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, role });

        await newUser.save();
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getProfile = async (req, res) => {
    try {
        console.log('REQ.USER:', req.user); // DEBUG
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
                ...(taskerProfile.area && { area: taskerProfile.area }),
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
