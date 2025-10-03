import Task from '../models/Task.js';
import Application from '../models/Application.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

export const createTask = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Only customers can create tasks'
      });
    }

    const taskData = {
      ...req.body,
      customer: req.user._id
    };

    if (req.body.targetedTasker) {
      const targetedUser = await User.findById(req.body.targetedTasker);
      if (!targetedUser) {
        return res.status(400).json({
          success: false,
          message: 'Targeted tasker not found'
        });
      }
      if (targetedUser.role !== 'tasker') {
        return res.status(400).json({
          success: false,
          message: 'Targeted user is not a tasker'
        });
      }
      taskData.isTargeted = true;
      taskData.targetedTasker = req.body.targetedTasker;
    }

    const task = await Task.create(taskData);
    
    await req.user.incrementTaskStat('tasksPosted');
    
    await task.populate('customer', 'fullName email');

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    console.error('Create task error:', error);
    
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
      message: 'Server error while creating task'
    });
  }
};

export const getTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      area,
      minPayment,
      maxPayment,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { status: 'active', startDate: { $gt: new Date() } };
    
    if (req.user && req.user.role === 'tasker') {
      query.$or = [
        { isTargeted: false },
        { isTargeted: true, targetedTasker: req.user._id }
      ];
    } else {
      query.isTargeted = false;
    }
    
    if (category) query.category = category;
    if (area) query.area = area;
    if (minPayment || maxPayment) {
      query.maxPayment = {};
      if (minPayment) query.maxPayment.$gte = Number(minPayment);
      if (maxPayment) query.maxPayment.$lte = Number(maxPayment);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const tasks = await Task.find(query)
      .populate('customer', 'fullName email rating statistics')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const tasksWithApplicationCount = await Promise.all(
      tasks.map(async (task) => {
        const applicationCount = await Application.countDocuments({ task: task._id });
        let hasApplied = false;
        if (req.user && req.user.role === 'tasker') {
          const application = await Application.findOne({ task: task._id, tasker: req.user._id });
          hasApplied = !!application;
        }
        return {
          ...task.toObject(),
          applicationCount,
          hasApplied
        };
      })
    );

    const total = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      data: tasksWithApplicationCount,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tasks'
    });
  }
};

export const getTask = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const task = await Task.findById(req.params.id)
      .populate('customer', 'fullName email phone rating statistics')
      .populate('selectedTasker', 'fullName email phone rating statistics taskerProfile')
      .populate('targetedTasker', 'fullName email phone rating statistics taskerProfile');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.status === 'active') {
      if (task.isTargeted) {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required to view this targeted task'
          });
        }

        const isCustomer = req.user._id.toString() === task.customer._id.toString();
        const isTargetedTasker = task.targetedTasker && 
                                 req.user._id.toString() === task.targetedTasker._id.toString();

        if (!isCustomer && !isTargetedTasker) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. This is a private task.'
          });
        }
      }
    } else if (task.status === 'scheduled') {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to view this task'
        });
      }

      const isCustomer = req.user._id.toString() === task.customer._id.toString();
      const isSelectedTasker = task.selectedTasker && 
                               req.user._id.toString() === task.selectedTasker._id.toString();
      const isTargetedTasker = task.targetedTasker && 
                               req.user._id.toString() === task.targetedTasker._id.toString();

      if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only the customer and selected/targeted tasker can view scheduled tasks.'
        });
      }
    } else {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to view this task'
        });
      }

      const isCustomer = req.user._id.toString() === task.customer._id.toString();
      const isSelectedTasker = task.selectedTasker && 
                               req.user._id.toString() === task.selectedTasker._id.toString();
      const isTargetedTasker = task.targetedTasker && 
                               req.user._id.toString() === task.targetedTasker._id.toString();

      if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only task participants can view this task.'
        });
      }
    }

    const applicationCount = await Application.countDocuments({ task: task._id });
    let hasApplied = false;
    if (req.user && req.user.role === 'tasker') {
      const application = await Application.findOne({ task: task._id, tasker: req.user._id });
      hasApplied = !!application;
    }
    const taskWithApplicationCount = {
      ...task.toObject(),
      applicationCount,
      hasApplied
    };

    res.status(200).json({
      success: true,
      data: taskWithApplicationCount
    });
  } catch (error) {
    console.error('Get task error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching task'
    });
  }
};

export const applyForTask = async (req, res) => {
  try {
    if (req.user.role !== 'tasker') {
      return res.status(403).json({
        success: false,
        message: 'Only taskers can apply for tasks'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'This task is not available for applications'
      });
    }

    if (!task.canBeAppliedTo()) {
      return res.status(400).json({
        success: false,
        message: 'Task is not available for applications'
      });
    }

    const existingApplication = await Application.findOne({
      task: req.params.id,
      tasker: req.user._id
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this task'
      });
    }

    const applicationData = {
      task: req.params.id,
      tasker: req.user._id,
      proposedPayment: req.body.proposedPayment,
      note: req.body.note,
      estimatedDuration: req.body.estimatedDuration,
      availableStartDate: req.body.availableStartDate,
      availableEndDate: req.body.availableEndDate
    };

    const application = await Application.create(applicationData);
    
    await req.user.incrementTaskStat('tasksAppliedTo');
    
    await application.populate('tasker', 'fullName email phone skills rating');
    await application.populate('task', 'title category area');

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${task.customer}`).emit('task-update', {
          type: 'application-submitted',
          taskId: task._id,
          taskTitle: application.task?.title,
          applicantId: application.tasker?._id,
          applicantName: application.tasker?.fullName,
          message: `${application.tasker?.fullName || 'A tasker'} applied to your task ${application.task?.title || ''}`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (wsError) {
      console.error('WebSocket task update (application-submitted) error:', wsError);
    }

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application
    });
  } catch (error) {
    console.error('Apply for task error:', error);
    
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
      message: 'Server error while applying for task'
    });
  }
};

export const getTaskApplications = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isSelectedTasker = task.selectedTasker && 
                             task.selectedTasker.toString() === req.user._id.toString();

    if (task.status === 'scheduled' || task.status === 'completed' || task.status === 'cancelled') {
      if (!isCustomer && !isSelectedTasker) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only the customer and selected tasker can view applications for this task.'
        });
      }
    } else {
      if (!isCustomer) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only the task owner can view applications.'
        });
      }
    }

    const { status } = req.query;
    const applications = await Application.getApplicationsForTask(req.params.id, status);

    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Get task applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching applications'
    });
  }
};

export const selectTasker = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const { taskerId, agreedTime, agreedPayment } = req.body;

    if (!taskerId || !agreedTime || !agreedPayment) {
      return res.status(400).json({
        success: false,
        message: 'All fields (taskerId, agreedTime, agreedPayment) are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(taskerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tasker ID'
      });
    }

    const agreedTimeDate = new Date(agreedTime);
    if (isNaN(agreedTimeDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agreed time format'
      });
    }

    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!task.canBeScheduled()) {
      return res.status(400).json({
        success: false,
        message: 'Task cannot be scheduled'
      });
    }

    if (agreedTimeDate < task.startDate || agreedTimeDate > task.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Agreed time must be between task start date and end date'
      });
    }

    const isTargetedTask = task.isTargeted && task.targetedTasker && task.targetedTasker.toString() === taskerId;
    

    let application = await Application.findOne({
      task: req.params.id,
      tasker: taskerId,
      status: 'pending'
    });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'No pending application found for this tasker'
      });
    }

    if (!application.confirmedByTasker) {
      return res.status(400).json({
        success: false,
        message: 'Tasker has not confirmed their availability'
      });
    }

    if (application.confirmedTime && Math.abs(agreedTimeDate.getTime() - application.confirmedTime.getTime()) > 60000) {
      return res.status(400).json({
        success: false,
        message: 'Agreed time should match the tasker\'s confirmed time'
      });
    }

    const tasker = await User.findById(taskerId);
    if (!tasker || tasker.role !== 'tasker') {
      return res.status(404).json({
        success: false,
        message: 'Tasker not found'
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      task.selectedTasker = taskerId;
      task.agreedPayment = agreedPayment;
      task.agreedTime = agreedTimeDate;
      
      console.log('Saving task with data:', {
        taskId: task._id,
        selectedTasker: task.selectedTasker,
        agreedPayment: task.agreedPayment,
        agreedTime: task.agreedTime
      });
      
      await task.save({ session });
      
      console.log('Task saved successfully');

      application.status = 'confirmed';
      await application.save({ session });

      await Application.updateMany(
        { 
          task: req.params.id, 
          _id: { $ne: application._id },
          status: 'pending'
        },
        { status: 'rejected' },
        { session }
      );

      await session.commitTransaction();

      await task.populate('selectedTasker', 'fullName email phone taskerProfile rating statistics');
      await task.populate('targetedTasker', 'fullName email phone taskerProfile rating statistics');
      await task.populate('customer', 'fullName email');

      console.log('Returning task data:', {
        taskId: task._id,
        agreedPayment: task.agreedPayment,
        agreedTime: task.agreedTime,
        selectedTasker: task.selectedTasker
      });

      try {
        const io = req.app.get('io');
        if (io) {
          io.to(`user-${task.selectedTasker._id || task.selectedTasker}`).emit('task-update', {
            type: 'tasker-selected',
            taskId: task._id,
            taskTitle: task.title,
            message: `You have been selected for task ${task.title}. Please proceed to confirm and complete payment process.`,
            timestamp: new Date().toISOString()
          });
          io.to(`user-${task.customer._id || task.customer}`).emit('task-update', {
            type: 'tasker-selected',
            taskId: task._id,
            taskTitle: task.title,
            message: `You selected a tasker for task ${task.title}. Awaiting payment to schedule.`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (wsError) {
        console.error('WebSocket task update (tasker-selected) error:', wsError);
      }

      res.status(200).json({
        success: true,
        message: 'Tasker selected successfully. Please complete the advance payment to schedule the task.',
        data: task,
        requiresPayment: true,
        advanceAmount: Math.round(agreedPayment * 0.2)
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Select tasker error:', error);
    
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
      message: 'Server error while selecting tasker'
    });
  }
};

export const confirmTime = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    if (req.user.role !== 'tasker') {
      return res.status(403).json({
        success: false,
        message: 'Only taskers can confirm their availability'
      });
    }

    const { confirmedTime, confirmedPayment } = req.body;

    if (!confirmedTime || !confirmedPayment) {
      return res.status(400).json({
        success: false,
        message: 'Both confirmedTime and confirmedPayment are required'
      });
    }

    const confirmedTimeDate = new Date(confirmedTime);
    if (isNaN(confirmedTimeDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmed time format'
      });
    }

    if (confirmedTimeDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Confirmed time must be in the future'
      });
    }

    if (typeof confirmedPayment !== 'number' || confirmedPayment <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Confirmed payment must be a positive number'
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Task is no longer in active state'
      });
    }

    if (confirmedPayment < task.minPayment || confirmedPayment > task.maxPayment) {
      return res.status(400).json({
        success: false,
        message: `Confirmed payment must be between $${task.minPayment} and $${task.maxPayment}`
      });
    }

    if (confirmedTimeDate < task.startDate || confirmedTimeDate > task.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Confirmed time must be within the task\'s start and end date range'
      });
    }

    const isTargetedTasker = task.isTargeted && task.targetedTasker && task.targetedTasker.toString() === req.user._id.toString();
    
    let application;
    
    if (isTargetedTasker) {
      application = await Application.findOne({
        task: req.params.id,
        tasker: req.user._id
      });
      
      if (!application) {
        application = await Application.create({
          task: req.params.id,
          tasker: req.user._id,
          proposedPayment: confirmedPayment,
          note: 'Direct hire application',
          status: 'pending'
        });
      }
    } else {
      application = await Application.findOne({
        task: req.params.id,
        tasker: req.user._id
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: 'You have not applied for this task'
        });
      }

      if (!application.canBeConfirmedByTasker()) {
        return res.status(400).json({
          success: false,
          message: 'Application cannot be confirmed (either already confirmed or not pending)'
        });
      }
    }

    application.confirmedByTasker = true;
    application.confirmedTime = confirmedTimeDate;
    application.confirmedPayment = confirmedPayment;
    
    await application.save();

    await application.populate('task', 'title category area startDate endDate minPayment maxPayment');
    await application.populate('tasker', 'fullName email phone');

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${task.customer}`).emit('task-update', {
          type: 'availability-confirmed',
          taskId: task._id,
          taskTitle: task.title,
          message: `${application.tasker?.fullName || 'Tasker'} confirmed availability for ${task.title}.`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (wsError) {
      console.error('WebSocket task update (availability-confirmed) error:', wsError);
    }

    res.status(200).json({
      success: true,
      message: 'Availability confirmed successfully',
      data: application
    });

  } catch (error) {
    console.error('Confirm time error:', error);
    
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
      message: 'Server error while confirming availability'
    });
  }
};

export const confirmSchedule = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (!task.selectedTasker || task.selectedTasker.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (task.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Task is not in scheduled status'
      });
    }

    task.taskerConfirmed = true;
    await task.save();

    await task.populate('customer', 'fullName email phone');
    await task.populate('selectedTasker', 'fullName email phone');
    await task.populate('targetedTasker', 'fullName email phone');

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${task.customer._id || task.customer}`).emit('task-update', {
          type: 'schedule-confirmed',
          taskId: task._id,
          taskTitle: task.title,
          message: `${task.selectedTasker?.fullName || 'Tasker'} confirmed the schedule for ${task.title}.`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (wsError) {
      console.error('WebSocket task update (schedule-confirmed) error:', wsError);
    }

    res.status(200).json({
      success: true,
      message: 'Schedule confirmed successfully',
      data: task
    });
  } catch (error) {
    console.error('Confirm schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while confirming schedule'
    });
  }
};

export const completeTask = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const { rating, review } = req.body;

    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!task.canBeCompleted()) {
      return res.status(400).json({
        success: false,
        message: 'Task cannot be completed yet'
      });
    }

    task.status = 'completed';
    task.customerRating = rating;
    task.customerReview = review;
    await task.save();

    if (rating && task.selectedTasker) {
      const tasker = await User.findById(task.selectedTasker);
      if (tasker) {
        await tasker.updateRating(rating);
        await tasker.incrementTaskStat('tasksCompleted');
      }
    }

    await req.user.incrementTaskStat('tasksCompleted');

    await task.populate('customer', 'fullName email');
    await task.populate('selectedTasker', 'fullName email phone');
    await task.populate('targetedTasker', 'fullName email phone');

    try {
      const io = req.app.get('io');
      if (io && task.selectedTasker) {
        io.to(`user-${task.selectedTasker._id || task.selectedTasker}`).emit('task-update', {
          type: 'task-completed-by-customer',
          taskId: task._id,
          taskTitle: task.title,
          message: `Customer marked ${task.title} as completed.`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (wsError) {
      console.error('WebSocket task update (task-completed-by-customer) error:', wsError);
    }

    res.status(200).json({
      success: true,
      message: 'Task completed successfully',
      data: task
    });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while completing task'
    });
  }
};

export const taskerCompleteTask = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const { completionPhotos, notes } = req.body;

    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (!task.selectedTasker || task.selectedTasker.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (task.status !== 'scheduled' || !task.taskerConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'Task is not ready for completion'
      });
    }

    if (completionPhotos) task.completionPhotos = completionPhotos;
    if (notes) task.completionNotes = notes;
    
    await task.save();

    await task.populate('customer', 'fullName email phone');
    await task.populate('selectedTasker', 'fullName email phone');
    await task.populate('targetedTasker', 'fullName email phone');

    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${task.customer._id || task.customer}`).emit('task-update', {
          type: 'task-completed-by-tasker',
          taskId: task._id,
          taskTitle: task.title,
          message: `${(task.selectedTasker && task.selectedTasker.fullName) || 'Tasker'} marked ${task.title} as complete. Please review and confirm.`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (wsError) {
      console.error('WebSocket task update (task-completed-by-tasker) error:', wsError);
    }

    res.status(200).json({
      success: true,
      message: 'Task marked as complete. Awaiting customer confirmation.',
      data: task
    });
  } catch (error) {
    console.error('Tasker complete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking task complete'
    });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const { status } = req.query;
    let tasks;

    if (req.user.role === 'customer') {
      tasks = await Task.getTasksByCustomer(req.user._id, status);
    } else if (req.user.role === 'tasker') {
      tasks = await Task.getTasksByTasker(req.user._id, status);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tasks'
    });
  }
};

export const getMyApplications = async (req, res) => {
  try {
    if (req.user.role !== 'tasker') {
      return res.status(403).json({
        success: false,
        message: 'Only taskers can view applications'
      });
    }

    const { status } = req.query;
    const applications = await Application.getApplicationsByTasker(req.user._id, status);

    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('Get my applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching applications'
    });
  }
};

export const getTasksByCustomerId = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    const customer = await User.findById(customerId);
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const query = { customer: customerId };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const tasks = await Task.find(query)
      .populate('selectedTasker', 'fullName email rating statistics')
      .populate('targetedTasker', 'fullName email rating statistics')
      .populate('applications')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    const tasksWithApplicationCount = await Promise.all(
      tasks.map(async (task) => {
        const applicationCount = await Application.countDocuments({ task: task._id });
        return {
          ...task.toObject(),
          applicationCount: applicationCount || (task.applications ? task.applications.length : 0)
        };
      })
    );

    const total = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      data: tasksWithApplicationCount,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get tasks by customer ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tasks'
    });
  }
};

export const markTaskComplete = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const { rating, review, completionPhotos, completionNotes, taskerFeedback, taskerRatingForCustomer } = req.body;

    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }    
    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === req.user._id.toString();
    const isTargetedTasker = task.targetedTasker && task.targetedTasker.toString() === req.user._id.toString();
    
    if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the customer or selected/targeted tasker can mark task as complete.'
      });
    }

    if (task.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled tasks can be marked as complete'
      });
    }

    if (isCustomer) {
      if (rating) task.customerRating = rating;
      if (review) task.customerReview = review;
      task.customerCompletedAt = new Date();
    }
    
    if (isSelectedTasker || isTargetedTasker) {
      if (completionPhotos && completionPhotos.length > 0) {
        task.completionPhotos = completionPhotos;
      }
      if (completionNotes) task.completionNotes = completionNotes;
      if (taskerFeedback) task.taskerFeedback = taskerFeedback;
      if (taskerRatingForCustomer) task.taskerRatingForCustomer = taskerRatingForCustomer;
      task.taskerCompletedAt = new Date();
    }

    const bothCompleted = task.taskerCompletedAt && task.customerCompletedAt;
    
    if (bothCompleted) {
      task.status = 'completed';
      
      const workingTaskerId = task.selectedTasker || task.targetedTasker;
      if (workingTaskerId) {
        const tasker = await User.findById(workingTaskerId);
        if (tasker) {
          await tasker.incrementTaskStat('tasksCompleted');
          
          if (task.customerRating) {
            await tasker.updateRating(task.customerRating);
          }
        }
      }

      const customer = await User.findById(task.customer);
      if (customer) {
        await customer.incrementTaskStat('tasksCompleted');
        
        if (task.taskerRatingForCustomer) {
          await customer.updateRating(task.taskerRatingForCustomer);
        }
      }

      const Feedback = (await import('../models/Feedback.js')).default;
      
      if (task.customerRating || task.customerReview) {
        try {
          await Feedback.create({
            task: task._id,
            fromUser: task.customer,
            toUser: workingTaskerId,
            rating: task.customerRating || 3,
            review: task.customerReview || 'No review provided',
            feedbackType: 'customer-to-tasker',
            taskerFeedbackCategories: {
              quality: task.customerRating || 3,
              punctuality: task.customerRating || 3,
              communication: task.customerRating || 3,
              professionalism: task.customerRating || 3
            }
          });
        } catch (feedbackError) {
          console.error('Error creating customer feedback:', feedbackError);
        }
      }

      if (task.taskerRatingForCustomer || task.taskerFeedback) {
        try {
          await Feedback.create({
            task: task._id,
            fromUser: workingTaskerId,
            toUser: task.customer,
            rating: task.taskerRatingForCustomer || 3,
            review: task.taskerFeedback || 'No review provided',
            feedbackType: 'tasker-to-customer',
            customerFeedbackCategories: {
              clarity: task.taskerRatingForCustomer || 3,
              responsiveness: task.taskerRatingForCustomer || 3,
              cooperation: task.taskerRatingForCustomer || 3,
              fairness: task.taskerRatingForCustomer || 3
            }
          });
        } catch (feedbackError) {
          console.error('Error creating tasker feedback:', feedbackError);
        }
      }
    }

    await task.save();

    await task.populate('customer', 'fullName email phone');
    await task.populate('selectedTasker', 'fullName email phone');
    await task.populate('targetedTasker', 'fullName email phone');

    const message = bothCompleted 
      ? 'Task completed successfully by both parties!' 
      : isCustomer 
        ? 'Task marked as complete by customer. Waiting for tasker confirmation.'
        : 'Task marked as complete by tasker. Waiting for customer confirmation.';

    res.status(200).json({
      success: true,
      message,
      data: task,
      bothCompleted
    });
  } catch (error) {
    console.error('Mark task complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking task as complete'
    });
  }
};

export const cancelScheduledTask = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const { reason } = req.body;

    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === req.user._id.toString();
    const isTargetedTasker = task.targetedTasker && task.targetedTasker.toString() === req.user._id.toString();
    
    if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the customer or selected/targeted tasker can cancel the schedule.'
      });
    }

    if (task.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled tasks can be cancelled'
      });
    }

    task.status = 'active';
    task.selectedTasker = null;
    task.agreedTime = null;
    task.agreedPayment = null;
    task.taskerConfirmed = false;
    
    task.cancellationReason = reason;
    task.cancelledBy = req.user._id;
    task.cancelledAt = new Date();

    await task.save();

    await task.populate('customer', 'fullName email phone');

    res.status(200).json({
      success: true,
      message: 'Schedule cancelled successfully. Task is now active again.',
      data: task
    });
  } catch (error) {
    console.error('Cancel scheduled task error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling schedule'
    });
  }
};

export const uploadTaskPhotos = async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Only customers can upload task photos'
      });
    }

    if (!req.files || !req.files.photos) {
      return res.status(400).json({
        success: false,
        message: 'No photos provided'
      });
    }

    const photos = Array.isArray(req.files.photos) ? req.files.photos : [req.files.photos];
    
    if (photos.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 photos allowed'
      });
    }

    const uploadedPhotos = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    for (const photo of photos) {
      if (!allowedTypes.includes(photo.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `Invalid file type for ${photo.name}. Only JPEG, PNG, GIF, and WebP are allowed.`
        });
      }

      if (photo.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: `File ${photo.name} is too large. Maximum size is 5MB per photo.`
        });
      }

      const userId = String(req.user._id);
      const baseUploadsDir = path.join(process.cwd(), 'uploads', 'tasks', userId);
      fs.mkdirSync(baseUploadsDir, { recursive: true });

      const originalExt = path.extname(photo.name) || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(originalExt.toLowerCase())
        ? originalExt
        : '.jpg';

      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
      const targetPath = path.join(baseUploadsDir, filename);

      await photo.mv(targetPath);

      const relativeUrl = `/uploads/tasks/${userId}/${filename}`;

      uploadedPhotos.push({
        url: relativeUrl,
        filename,
        size: photo.size,
        mimetype: photo.mimetype
      });
    }

    res.status(200).json({
      success: true,
      data: uploadedPhotos
    });
  } catch (error) {
    console.error('Upload task photos error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading photos'
    });
  }
};

export const uploadCompletionPhoto = async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ success: false, message: 'taskId is required' });
    }

    if (!req.files || !req.files.photo) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const photo = req.files.photo;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(photo.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'
      });
    }

    if (photo.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }

    const baseUploadsDir = path.join(process.cwd(), 'uploads', 'completions', String(taskId));
    fs.mkdirSync(baseUploadsDir, { recursive: true });

    const originalExt = path.extname(photo.name) || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(originalExt.toLowerCase())
      ? originalExt
      : '.jpg';

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    const targetPath = path.join(baseUploadsDir, filename);

    await photo.mv(targetPath);

    const relativeUrl = `/uploads/completions/${taskId}/${filename}`;

    return res.status(200).json({
      success: true,
      data: {
        url: relativeUrl,
        filename,
        size: photo.size,
        mimetype: photo.mimetype
      }
    });
  } catch (error) {
    console.error('Upload completion photo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while uploading photo'
    });
  }
};

export const getCategoryStats = async (req, res) => {
  try {
    const categoryStats = await Task.aggregate([
      {
        $match: {
          status: 'active',
          startDate: { $gt: new Date() },
          isTargeted: false
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const categoryData = categoryStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const allCategories = [
      'Cleaning', 'Repairing', 'Handyman', 'Maintenance', 
      'Gardening', 'Landscaping', 'Installations', 'Security',
      'Moving', 'Plumbing', 'Electrical', 'Painting', 
      'Carpentry', 'Repairs', 'Delivery', 'Other'
    ];

    const result = allCategories.map(category => ({
      category,
      count: categoryData[category] || 0
    }));

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching category statistics'
    });
  }
}; 