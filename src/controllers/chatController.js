import mongoose from 'mongoose';
import ChatMessage from '../models/ChatMessage.js';
import Task from '../models/Task.js';
import Application from '../models/Application.js';

// @desc    Send a new chat message
// @route   POST /api/v1/chat
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { taskId, senderId, receiverId, message } = req.body;

    // Validate required fields
    if (!taskId || !senderId || !receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields (taskId, senderId, receiverId, message) are required'
      });
    }

    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(taskId) || 
        !mongoose.Types.ObjectId.isValid(senderId) || 
        !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    // Verify the sender is the authenticated user
    if (senderId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only send messages as yourself'
      });
    }

    // Verify the task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if the user has permission to chat about this task
    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === req.user._id.toString();
    
    // Updated access control based on task status
    if (task.status === 'scheduled') {
      // For scheduled tasks, only customer and selectedTasker can chat
      if (!isCustomer && !isSelectedTasker) {
        return res.status(403).json({
          success: false,
          message: 'Only the customer and selected tasker can chat about scheduled tasks'
        });
      }
    } else if (task.status === 'active') {
      // For active tasks, customer and any applied tasker can chat
      let hasApplied = false;
      if (!isCustomer && !isSelectedTasker) {
        const application = await Application.findOne({
          task: taskId,
          tasker: req.user._id
        });
        hasApplied = !!application;
      }

      if (!isCustomer && !isSelectedTasker && !hasApplied) {
        return res.status(403).json({
          success: false,
          message: 'You can only chat about tasks you are involved in'
        });
      }
    } else {
      // For other statuses, maintain existing logic
      let hasApplied = false;
      if (!isCustomer && !isSelectedTasker) {
        const application = await Application.findOne({
          task: taskId,
          tasker: req.user._id
        });
        hasApplied = !!application;
      }

      if (!isCustomer && !isSelectedTasker && !hasApplied) {
        return res.status(403).json({
          success: false,
          message: 'You can only chat about tasks you are involved in'
        });
      }
    }

    // Verify the receiver is involved in this task
    const receiverIsCustomer = task.customer.toString() === receiverId;
    const receiverIsSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === receiverId;
    
    // Updated receiver validation based on task status
    if (task.status === 'scheduled') {
      // For scheduled tasks, only customer and selectedTasker can receive messages
      if (!receiverIsCustomer && !receiverIsSelectedTasker) {
        return res.status(400).json({
          success: false,
          message: 'Only the customer and selected tasker can receive messages for scheduled tasks'
        });
      }
    } else {
      // For other statuses, check if receiver has applied or is involved
      let receiverHasApplied = false;
      if (!receiverIsCustomer && !receiverIsSelectedTasker) {
        const receiverApplication = await Application.findOne({
          task: taskId,
          tasker: receiverId
        });
        receiverHasApplied = !!receiverApplication;
      }

      if (!receiverIsCustomer && !receiverIsSelectedTasker && !receiverHasApplied) {
        return res.status(400).json({
          success: false,
          message: 'Receiver is not involved in this task'
        });
      }
    }

    // Create the chat message
    const chatMessage = new ChatMessage({
      taskId,
      senderId,
      receiverId,
      message: message.trim()
    });

    await chatMessage.save();

    // Populate sender and receiver information
    await chatMessage.populate('senderId', 'fullName email');
    await chatMessage.populate('receiverId', 'fullName email');
    await chatMessage.populate('taskId', 'title');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: chatMessage
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending message'
    });
  }
};

// @desc    Get conversation between two users for a specific task
// @route   GET /api/v1/chat/:taskId/:userId
// @access  Private
export const getConversation = async (req, res) => {
  try {
    const { taskId, userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    // Verify the task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if the authenticated user has permission to view this conversation
    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === req.user._id.toString();
    
    // Updated access control based on task status
    if (task.status === 'scheduled') {
      // For scheduled tasks, only customer and selectedTasker can access conversations
      if (!isCustomer && !isSelectedTasker) {
        return res.status(403).json({
          success: false,
          message: 'Only the customer and selected tasker can view conversations for scheduled tasks'
        });
      }
    } else if (task.status === 'active') {
      // For active tasks, customer and any applied tasker can access conversations
      let hasApplied = false;
      if (!isCustomer && !isSelectedTasker) {
        const application = await Application.findOne({
          task: taskId,
          tasker: req.user._id
        });
        hasApplied = !!application;
      }

      if (!isCustomer && !isSelectedTasker && !hasApplied) {
        return res.status(403).json({
          success: false,
          message: 'You can only view conversations for tasks you are involved in'
        });
      }
    } else {
      // For other statuses, maintain existing logic
      let hasApplied = false;
      if (!isCustomer && !isSelectedTasker) {
        const application = await Application.findOne({
          task: taskId,
          tasker: req.user._id
        });
        hasApplied = !!application;
      }

      if (!isCustomer && !isSelectedTasker && !hasApplied) {
        return res.status(403).json({
          success: false,
          message: 'You can only view conversations for tasks you are involved in'
        });
      }
    }

    // Verify the other user is involved in this task
    const otherUserIsCustomer = task.customer.toString() === userId;
    const otherUserIsSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === userId;
    
    // Updated other user validation based on task status
    if (task.status === 'scheduled') {
      // For scheduled tasks, only customer and selectedTasker can be conversation participants
      if (!otherUserIsCustomer && !otherUserIsSelectedTasker) {
        return res.status(400).json({
          success: false,
          message: 'Only the customer and selected tasker can participate in conversations for scheduled tasks'
        });
      }
    } else {
      // For other statuses, check if other user has applied or is involved
      let otherUserHasApplied = false;
      if (!otherUserIsCustomer && !otherUserIsSelectedTasker) {
        const otherUserApplication = await Application.findOne({
          task: taskId,
          tasker: userId
        });
        otherUserHasApplied = !!otherUserApplication;
      }

      if (!otherUserIsCustomer && !otherUserIsSelectedTasker && !otherUserHasApplied) {
        return res.status(400).json({
          success: false,
          message: 'The specified user is not involved in this task'
        });
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get the conversation
    const messages = await ChatMessage.find({
      taskId: taskId,
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id }
      ]
    })
    .populate('senderId', 'fullName email')
    .populate('receiverId', 'fullName email')
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(Number(limit));

    // Get total count for pagination
    const total = await ChatMessage.countDocuments({
      taskId: taskId,
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id }
      ]
    });

    // Mark messages as read for the authenticated user
    await ChatMessage.updateMany(
      {
        taskId: taskId,
        receiverId: req.user._id,
        senderId: userId,
        isRead: false
      },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      task: {
        _id: task._id,
        title: task.title,
        status: task.status
      }
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching conversation'
    });
  }
};

// @desc    Get unread message count for the authenticated user
// @route   GET /api/v1/chat/unread-count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await ChatMessage.countDocuments({
      receiverId: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      data: {
        unreadCount
      }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread count'
    });
  }
};

// @desc    Mark messages as read for a specific task
// @route   PUT /api/v1/chat/:taskId/mark-read
// @access  Private
export const markMessagesAsRead = async (req, res) => {
  try {
    const { taskId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format'
      });
    }

    // Mark all unread messages for this task and user as read
    const result = await ChatMessage.updateMany(
      {
        taskId: taskId,
        receiverId: req.user._id,
        isRead: false
      },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      data: {
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking messages as read'
    });
  }
}; 