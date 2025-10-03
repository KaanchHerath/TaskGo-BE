import mongoose from 'mongoose';
import ChatMessage from '../models/ChatMessage.js';
import Task from '../models/Task.js';
import Application from '../models/Application.js';

export const sendMessage = async (req, res) => {
  try {
    const { taskId, senderId, receiverId, message } = req.body;

    if (!taskId || !senderId || !receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields (taskId, senderId, receiverId, message) are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(taskId) || 
        !mongoose.Types.ObjectId.isValid(senderId) || 
        !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    if (senderId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only send messages as yourself'
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === req.user._id.toString();
    const isTargetedTasker = task.isTargeted && task.targetedTasker && task.targetedTasker.toString() === req.user._id.toString();
    
    if (task.status === 'scheduled') {
      if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
        return res.status(403).json({
          success: false,
          message: 'Only the customer and selected tasker can chat about scheduled tasks'
        });
      }
    } else if (task.status === 'active') {
      let hasApplied = false;
      if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
        const application = await Application.findOne({
          task: taskId,
          tasker: req.user._id
        });
        hasApplied = !!application;
      }

      if (!isCustomer && !isSelectedTasker && !isTargetedTasker && !hasApplied) {
        return res.status(403).json({
          success: false,
          message: 'You can only chat about tasks you are involved in'
        });
      }
    } else {
      let hasApplied = false;
      if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
        const application = await Application.findOne({
          task: taskId,
          tasker: req.user._id
        });
        hasApplied = !!application;
      }

      if (!isCustomer && !isSelectedTasker && !isTargetedTasker && !hasApplied) {
        return res.status(403).json({
          success: false,
          message: 'You can only chat about tasks you are involved in'
        });
      }
    }

    const receiverIsCustomer = task.customer.toString() === receiverId;
    const receiverIsSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === receiverId;
    const receiverIsTargetedTasker = task.isTargeted && task.targetedTasker && task.targetedTasker.toString() === receiverId;
    
    if (task.status === 'scheduled') {
      if (!receiverIsCustomer && !receiverIsSelectedTasker && !receiverIsTargetedTasker) {
        return res.status(400).json({
          success: false,
          message: 'Only the customer and selected tasker can receive messages for scheduled tasks'
        });
      }
    } else {
      let receiverHasApplied = false;
      if (!receiverIsCustomer && !receiverIsSelectedTasker && !receiverIsTargetedTasker) {
        const receiverApplication = await Application.findOne({
          task: taskId,
          tasker: receiverId
        });
        receiverHasApplied = !!receiverApplication;
      }

      if (!receiverIsCustomer && !receiverIsSelectedTasker && !receiverIsTargetedTasker && !receiverHasApplied) {
        return res.status(400).json({
          success: false,
          message: 'Receiver is not involved in this task'
        });
      }
    }

    const chatMessage = new ChatMessage({
      taskId,
      senderId,
      receiverId,
      message: message.trim()
    });

    await chatMessage.save();

    await chatMessage.populate('senderId', 'fullName email');
    await chatMessage.populate('receiverId', 'fullName email');
    await chatMessage.populate('taskId', 'title');

    try {
      const io = req.app.get('io');
      console.log('🔌 WebSocket emission attempt:', { io: !!io, app: !!req.app });
      
      if (io) {
        const messageData = {
          message: chatMessage,
          taskId: taskId,
          senderId: senderId,
          receiverId: receiverId
        };
        
        console.log('Emitting chat-message event:', messageData);
        
        io.to(`user-${receiverId}`).emit('chat-message', messageData);
        
        io.to(`user-${senderId}`).emit('message-sent', {
          message: chatMessage,
          taskId: taskId
        });
        
        console.log(`WebSocket chat message sent to user ${receiverId}`);
        console.log(`WebSocket message-sent confirmation sent to user ${senderId}`);
      } else {
        console.error('WebSocket io instance not available');
      }
    } catch (wsError) {
      console.error('WebSocket chat notification error:', wsError);
    }

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

export const getConversation = async (req, res) => {
  try {
    const { taskId, userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === req.user._id.toString();
    const isTargetedTasker = task.isTargeted && task.targetedTasker && task.targetedTasker.toString() === req.user._id.toString();
    
    if (task.status === 'scheduled') {
      if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
        return res.status(403).json({
          success: false,
          message: 'Only the customer and selected tasker can view conversations for scheduled tasks'
        });
      }
    } else if (task.status === 'active') {
      let hasApplied = false;
      if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
        const application = await Application.findOne({
          task: taskId,
          tasker: req.user._id
        });
        hasApplied = !!application;
      }

      if (!isCustomer && !isSelectedTasker && !isTargetedTasker && !hasApplied) {
        return res.status(403).json({
          success: false,
          message: 'You can only view conversations for tasks you are involved in'
        });
      }
    } else {
      let hasApplied = false;
      if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
        const application = await Application.findOne({
          task: taskId,
          tasker: req.user._id
        });
        hasApplied = !!application;
      }

      if (!isCustomer && !isSelectedTasker && !isTargetedTasker && !hasApplied) {
        return res.status(403).json({
          success: false,
          message: 'You can only view conversations for tasks you are involved in'
        });
      }
    }

    const otherUserIsCustomer = task.customer.toString() === userId;
    const otherUserIsSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === userId;
    const otherUserIsTargetedTasker = task.isTargeted && task.targetedTasker && task.targetedTasker.toString() === userId;
    
    if (task.status === 'scheduled') {
      if (!otherUserIsCustomer && !otherUserIsSelectedTasker && !otherUserIsTargetedTasker) {
        return res.status(400).json({
          success: false,
          message: 'Only the customer and selected tasker can participate in conversations for scheduled tasks'
        });
      }
    } else {
      let otherUserHasApplied = false;
      if (!otherUserIsCustomer && !otherUserIsSelectedTasker && !otherUserIsTargetedTasker) {
        const otherUserApplication = await Application.findOne({
          task: taskId,
          tasker: userId
        });
        otherUserHasApplied = !!otherUserApplication;
      }

      if (!otherUserIsCustomer && !otherUserIsSelectedTasker && !otherUserIsTargetedTasker && !otherUserHasApplied) {
        return res.status(400).json({
          success: false,
          message: 'The specified user is not involved in this task'
        });
      }
    }

    const skip = (page - 1) * limit;

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

    const total = await ChatMessage.countDocuments({
      taskId: taskId,
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id }
      ]
    });

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

export const markMessagesAsRead = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format'
      });
    }

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