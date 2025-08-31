import Feedback from '../models/Feedback.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// @desc    Create feedback
// @route   POST /api/feedback
// @access  Private
export const createFeedback = async (req, res) => {
  try {
    const {
      taskId,
      toUserId,
      rating,
      review,
      feedbackType,
      taskerFeedbackCategories,
      customerFeedbackCategories
    } = req.body;

    // Validate required fields
    if (!taskId || !toUserId || !rating || !review || !feedbackType) {
      return res.status(400).json({
        success: false,
        message: 'Task ID, recipient, rating, review, and feedback type are required'
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID or user ID'
      });
    }

    // Get the task and verify permissions
    const task = await Task.findById(taskId).populate('customer selectedTasker');
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Verify task is completed
    if (task.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be given for completed tasks'
      });
    }

    // Verify user is part of this task
    const isCustomer = task.customer._id.toString() === req.user._id.toString();
    const isTasker = task.selectedTasker && task.selectedTasker._id.toString() === req.user._id.toString();

    if (!isCustomer && !isTasker) {
      return res.status(403).json({
        success: false,
        message: 'You can only give feedback for tasks you were involved in'
      });
    }

    // Create feedback data
    const feedbackData = {
      task: taskId,
      fromUser: req.user._id,
      toUser: toUserId,
      rating,
      review,
      feedbackType
    };

    // Add category ratings based on feedback type
    if (feedbackType === 'customer-to-tasker' && taskerFeedbackCategories) {
      feedbackData.taskerFeedbackCategories = taskerFeedbackCategories;
    } else if (feedbackType === 'tasker-to-customer' && customerFeedbackCategories) {
      feedbackData.customerFeedbackCategories = customerFeedbackCategories;
    }

    // Create the feedback
    const feedback = await Feedback.create(feedbackData);

    // Update recipient's rating and statistics
    const recipient = await User.findById(toUserId);
    if (recipient) {
      const categoryRatings = feedbackType === 'customer-to-tasker' ? 
        taskerFeedbackCategories : customerFeedbackCategories;
      await recipient.updateRating(rating, categoryRatings);
    }

    // Populate the feedback for response
    await feedback.populate([
      { path: 'fromUser', select: 'fullName role' },
      { path: 'toUser', select: 'fullName role' },
      { path: 'task', select: 'title category' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Feedback created successfully',
      data: feedback
    });
  } catch (error) {
    console.error('Create feedback error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating feedback'
    });
  }
};

// @desc    Get feedback for a user
// @route   GET /api/feedback/user/:userId
// @access  Public
export const getUserFeedback = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const skip = (page - 1) * limit;
    const feedbacks = await Feedback.getFeedbackForUser(userId, type, parseInt(limit), skip);
    
    // Get rating statistics
    const ratingStats = await Feedback.getUserRatingStats(userId, type);

    res.status(200).json({
      success: true,
      data: {
        feedbacks,
        ratingStats: ratingStats[0] || {
          averageRating: 0,
          totalFeedbacks: 0,
          ratingBreakdown: {
            fiveStars: 0,
            fourStars: 0,
            threeStars: 0,
            twoStars: 0,
            oneStar: 0
          }
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: feedbacks.length
        }
      }
    });
  } catch (error) {
    console.error('Get user feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching feedback'
    });
  }
};

// @desc    Get feedback given by a user
// @route   GET /api/feedback/given
// @access  Private
export const getFeedbackGivenByUser = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const feedbacks = await Feedback.getFeedbackByUser(req.user._id, parseInt(limit), skip);

    res.status(200).json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: feedbacks.length
        }
      }
    });
  } catch (error) {
    console.error('Get feedback given by user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching feedback'
    });
  }
};

// @desc    Get feedback for a specific task
// @route   GET /api/feedback/task/:taskId
// @access  Private
export const getTaskFeedback = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    // Verify user has access to this task
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isTasker = task.selectedTasker && task.selectedTasker.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isTasker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const feedbacks = await Feedback.getTaskFeedback(taskId);

    res.status(200).json({
      success: true,
      data: feedbacks
    });
  } catch (error) {
    console.error('Get task feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching task feedback'
    });
  }
};

// @desc    Add response to feedback
// @route   POST /api/feedback/:feedbackId/response
// @access  Private
export const addFeedbackResponse = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { response } = req.body;

    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feedback ID'
      });
    }

    if (!response || response.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Response text is required'
      });
    }

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    if (!feedback.canBeRespondedTo(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only respond to feedback given to you, and only once'
      });
    }

    await feedback.addResponse(response.trim());
    await feedback.populate([
      { path: 'fromUser', select: 'fullName role' },
      { path: 'toUser', select: 'fullName role' },
      { path: 'task', select: 'title category' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      data: feedback
    });
  } catch (error) {
    console.error('Add feedback response error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding response'
    });
  }
};

// @desc    Vote feedback as helpful
// @route   POST /api/feedback/:feedbackId/helpful
// @access  Private
export const voteFeedbackHelpful = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feedback ID'
      });
    }

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Prevent users from voting on their own feedback
    if (feedback.fromUser.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot vote on your own feedback'
      });
    }

    await feedback.addHelpfulVote();

    res.status(200).json({
      success: true,
      message: 'Feedback marked as helpful',
      data: { helpfulVotes: feedback.helpfulVotes }
    });
  } catch (error) {
    console.error('Vote feedback helpful error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while voting feedback as helpful'
    });
  }
};

// @desc    Report feedback
// @route   POST /api/feedback/:feedbackId/report
// @access  Private
export const reportFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feedback ID'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Report reason is required'
      });
    }

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    try {
      await feedback.reportFeedback(req.user._id, reason);
      
      res.status(200).json({
        success: true,
        message: 'Feedback reported successfully'
      });
    } catch (reportError) {
      res.status(400).json({
        success: false,
        message: reportError.message
      });
    }
  } catch (error) {
    console.error('Report feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reporting feedback'
    });
  }
};

// @desc    Get recent reviews for dashboard
// @route   GET /api/feedback/recent-reviews
// @access  Public
export const getRecentReviews = async (req, res) => {
  try {
    const { limit = 10, type } = req.query;

    let query = {};
    if (type) {
      query.feedbackType = type;
    }

    const recentReviews = await Feedback.find(query)
      .populate('fromUser', 'fullName role')
      .populate('toUser', 'fullName role')
      .populate('task', 'title category')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: recentReviews
    });
  } catch (error) {
    console.error('Get recent reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recent reviews'
    });
  }
};

// @desc    Get user rating summary
// @route   GET /api/feedback/rating-summary/:userId
// @access  Public
export const getUserRatingSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId).select('rating statistics role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get recent feedback
    const recentFeedback = await Feedback.getFeedbackForUser(userId, null, 5, 0);

    res.status(200).json({
      success: true,
      data: {
        rating: user.rating,
        statistics: user.statistics,
        role: user.role,
        recentFeedback
      }
    });
  } catch (error) {
    console.error('Get user rating summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching rating summary'
    });
  }
}; 