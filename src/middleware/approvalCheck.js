import User from '../models/User.js';
import logger from '../utils/logger.js';


/**
 * Middleware to check if a tasker is approved
 * This middleware should be used after authentication middleware
 */
export const checkTaskerApproval = async (req, res, next) => {
  try {
    // Check if user exists and is a tasker
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'tasker') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only taskers can perform this action.'
      });
    }

    // Fetch the latest user data to ensure we have current approval status
    const tasker = await User.findById(req.user._id).select('taskerProfile');
    
    if (!tasker || !tasker.taskerProfile) {
      return res.status(400).json({
        success: false,
        message: 'Tasker profile not found'
      });
    }

    const { approvalStatus, isApproved, rejectionReason } = tasker.taskerProfile;

    // Check if tasker is approved
    if (!isApproved || approvalStatus !== 'approved') {
      const errorResponse = {
        success: false,
        message: 'Tasker approval required',
        approvalStatus: approvalStatus || 'pending',
        isApproved: isApproved || false
      };

      // Add rejection reason if available
      if (approvalStatus === 'rejected' && rejectionReason) {
        errorResponse.rejectionReason = rejectionReason;
      }

      // Add specific messages based on status
      switch (approvalStatus) {
        case 'pending':
          errorResponse.message = 'Your account is pending approval. Please wait for admin review.';
          break;
        case 'rejected':
          errorResponse.message = 'Your account has been rejected. Please contact support for more information.';
          break;
        default:
          errorResponse.message = 'Your account requires approval before you can perform this action.';
      }

      logger.warn('Tasker approval check failed', {
        taskerId: req.user._id,
        approvalStatus,
        isApproved,
        action: req.originalUrl
      });

      return res.status(403).json(errorResponse);
    }

    // Tasker is approved, continue
    next();
  } catch (error) {
    logger.error('Error in tasker approval check', {
      error: error.message,
      taskerId: req.user?._id,
      action: req.originalUrl
    });

    return res.status(500).json({
      success: false,
      message: 'Internal server error during approval check'
    });
  }
};

/**
 * Middleware to check if a tasker is approved for specific actions
 * Allows custom error messages and status codes
 */
export const checkTaskerApprovalWithCustomMessage = (customMessage = null, customStatus = 403) => {
  return async (req, res, next) => {
    try {
      // Check if user exists and is a tasker
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (req.user.role !== 'tasker') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only taskers can perform this action.'
        });
      }

      // Fetch the latest user data
      const tasker = await User.findById(req.user._id).select('taskerProfile');
      
      if (!tasker || !tasker.taskerProfile) {
        return res.status(400).json({
          success: false,
          message: 'Tasker profile not found'
        });
      }

      const { approvalStatus, isApproved, rejectionReason } = tasker.taskerProfile;

      // Check if tasker is approved
      if (!isApproved || approvalStatus !== 'approved') {
        const errorResponse = {
          success: false,
          message: customMessage || 'Tasker approval required',
          approvalStatus: approvalStatus || 'pending',
          isApproved: isApproved || false
        };

        // Add rejection reason if available
        if (approvalStatus === 'rejected' && rejectionReason) {
          errorResponse.rejectionReason = rejectionReason;
        }

        logger.warn('Tasker approval check failed with custom message', {
          taskerId: req.user._id,
          approvalStatus,
          isApproved,
          action: req.originalUrl,
          customMessage
        });

        return res.status(customStatus).json(errorResponse);
      }

      // Tasker is approved, continue
      next();
    } catch (error) {
      logger.error('Error in tasker approval check with custom message', {
        error: error.message,
        taskerId: req.user?._id,
        action: req.originalUrl
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error during approval check'
      });
    }
  };
};

/**
 * Middleware to check tasker approval status without blocking
 * Adds approval info to request object for conditional logic
 */
export const checkTaskerApprovalStatus = async (req, res, next) => {
  try {
    // Check if user exists and is a tasker
    if (!req.user || req.user.role !== 'tasker') {
      req.taskerApprovalStatus = null;
      return next();
    }

    // Fetch the latest user data
    const tasker = await User.findById(req.user._id).select('taskerProfile');
    
    if (!tasker || !tasker.taskerProfile) {
      req.taskerApprovalStatus = null;
      return next();
    }

    const { approvalStatus, isApproved, rejectionReason } = tasker.taskerProfile;

    // Add approval status to request object
    req.taskerApprovalStatus = {
      isApproved: isApproved || false,
      approvalStatus: approvalStatus || 'pending',
      rejectionReason: approvalStatus === 'rejected' ? rejectionReason : null
    };

    next();
  } catch (error) {
    logger.error('Error in tasker approval status check', {
      error: error.message,
      taskerId: req.user?._id,
      action: req.originalUrl
    });

    req.taskerApprovalStatus = null;
    next();
  }
};

/**
 * Middleware to check if tasker can apply to tasks
 * Combines approval check with availability check
 */
export const checkTaskerCanApply = async (req, res, next) => {
  try {
    // First check if user is authenticated and is a tasker
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role !== 'tasker') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only taskers can apply to tasks.'
      });
    }

    // Fetch the latest user data
    const tasker = await User.findById(req.user._id).select('taskerProfile');
    
    if (!tasker || !tasker.taskerProfile) {
      return res.status(400).json({
        success: false,
        message: 'Tasker profile not found'
      });
    }

    const { 
      approvalStatus, 
      isApproved, 
      rejectionReason, 
      isAvailable 
    } = tasker.taskerProfile;

    // Check approval status
    if (!isApproved || approvalStatus !== 'approved') {
      const errorResponse = {
        success: false,
        message: 'Your account requires approval before you can apply to tasks.',
        approvalStatus: approvalStatus || 'pending',
        isApproved: isApproved || false
      };

      if (approvalStatus === 'rejected' && rejectionReason) {
        errorResponse.rejectionReason = rejectionReason;
      }

      logger.warn('Tasker application blocked - not approved', {
        taskerId: req.user._id,
        approvalStatus,
        action: req.originalUrl
      });

      return res.status(403).json(errorResponse);
    }

    // Check availability
    if (isAvailable === false) {
      return res.status(403).json({
        success: false,
        message: 'You are currently unavailable. Please update your availability status to apply to tasks.',
        isAvailable: false
      });
    }

    // Tasker is approved and available, continue
    next();
  } catch (error) {
    logger.error('Error in tasker application check', {
      error: error.message,
      taskerId: req.user?._id,
      action: req.originalUrl
    });

    return res.status(500).json({
      success: false,
      message: 'Internal server error during application check'
    });
  }
};

/**
 * Middleware to check if tasker can be selected for tasks
 * Ensures tasker is approved and available
 */
export const checkTaskerCanBeSelected = async (req, res, next) => {
  try {
    const { taskerId } = req.params;

    if (!taskerId) {
      return res.status(400).json({
        success: false,
        message: 'Tasker ID is required'
      });
    }

    // Fetch tasker data
    const tasker = await User.findById(taskerId).select('taskerProfile');
    
    if (!tasker || !tasker.taskerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Tasker not found'
      });
    }

    const { 
      approvalStatus, 
      isApproved, 
      rejectionReason, 
      isAvailable 
    } = tasker.taskerProfile;

    // Check approval status
    if (!isApproved || approvalStatus !== 'approved') {
      const errorResponse = {
        success: false,
        message: 'This tasker is not approved and cannot be selected.',
        approvalStatus: approvalStatus || 'pending',
        isApproved: isApproved || false
      };

      if (approvalStatus === 'rejected' && rejectionReason) {
        errorResponse.rejectionReason = rejectionReason;
      }

      logger.warn('Tasker selection blocked - not approved', {
        taskerId,
        approvalStatus,
        action: req.originalUrl
      });

      return res.status(403).json(errorResponse);
    }

    // Check availability
    if (isAvailable === false) {
      return res.status(403).json({
        success: false,
        message: 'This tasker is currently unavailable.',
        isAvailable: false
      });
    }

    // Tasker is approved and available, continue
    next();
  } catch (error) {
    logger.error('Error in tasker selection check', {
      error: error.message,
      taskerId: req.params.taskerId,
      action: req.originalUrl
    });

    return res.status(500).json({
      success: false,
      message: 'Internal server error during selection check'
    });
  }
}; 