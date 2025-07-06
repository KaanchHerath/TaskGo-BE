import Task from '../models/Task.js';
import Application from '../models/Application.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private (Customer only)
export const createTask = async (req, res) => {
  try {
    // Verify user is customer
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

    // Handle targeted tasks
    if (req.body.targetedTasker) {
      // Validate that the targeted tasker exists and is actually a tasker
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
    
    // Increment customer's tasks posted count
    await req.user.incrementTaskStat('tasksPosted');
    
    // Populate customer details
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

// @desc    Get all active tasks
// @route   GET /api/tasks
// @access  Public (only shows active tasks - scheduled tasks are hidden from public view)
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

    // Build query - only show active tasks to public
    // Scheduled tasks are hidden from all users except customer and selectedTasker
    // Targeted tasks are only visible to the targeted tasker
    const query = { status: 'active', startDate: { $gt: new Date() } };
    
    // If user is authenticated, check for targeted tasks
    if (req.user && req.user.role === 'tasker') {
      // For taskers, show non-targeted tasks OR tasks targeted to them
      query.$or = [
        { isTargeted: false },
        { isTargeted: true, targetedTasker: req.user._id }
      ];
    } else {
      // For non-authenticated users or customers, only show non-targeted tasks
      query.isTargeted = false;
    }
    
    if (category) query.category = category;
    if (area) query.area = area;
    if (minPayment || maxPayment) {
      query.maxPayment = {};
      if (minPayment) query.maxPayment.$gte = Number(minPayment);
      if (maxPayment) query.maxPayment.$lte = Number(maxPayment);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute query
    const tasks = await Task.find(query)
      .populate('customer', 'fullName email rating statistics')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    // Manually populate application count for each task
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

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Public (for active tasks), Private (for scheduled/other statuses)
export const getTask = async (req, res) => {
  try {
    // Validate ObjectId format first
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

    // Updated access permissions based on task status
    if (task.status === 'active') {
      // Active tasks are visible to all users (public access)
      // However, targeted tasks should only be visible to customer and targeted tasker
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
      // Scheduled tasks are only visible to customer and selectedTasker
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
      // For other statuses (completed, cancelled, etc.), only allow task participants
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

    // Manually populate application count
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

// @desc    Apply for task
// @route   POST /api/tasks/:id/apply
// @access  Private (Tasker only)
export const applyForTask = async (req, res) => {
  try {
    // Verify user is tasker
    if (req.user.role !== 'tasker') {
      return res.status(403).json({
        success: false,
        message: 'Only taskers can apply for tasks'
      });
    }

    // Validate ObjectId format
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

    // Check if task is accessible to taskers
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

    // Check if already applied
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
    
    // Increment tasker's applications count
    await req.user.incrementTaskStat('tasksAppliedTo');
    
    // Populate application details
    await application.populate('tasker', 'fullName email phone skills rating');
    await application.populate('task', 'title category area');

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

// @desc    Get applications for task
// @route   GET /api/tasks/:id/applications
// @access  Private (Task owner only)
export const getTaskApplications = async (req, res) => {
  try {
    // Validate ObjectId format
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

    // Enhanced access control for task applications
    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isSelectedTasker = task.selectedTasker && 
                             task.selectedTasker.toString() === req.user._id.toString();

    // For scheduled, completed, and cancelled tasks, both customer and selectedTasker can view applications
    if (task.status === 'scheduled' || task.status === 'completed' || task.status === 'cancelled') {
      if (!isCustomer && !isSelectedTasker) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only the customer and selected tasker can view applications for this task.'
        });
      }
    } else {
      // For other statuses (active, etc.), only the customer can view applications
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

// @desc    Select tasker for task
// @route   POST /api/tasks/:id/select-tasker
// @access  Private (Task owner only)
export const selectTasker = async (req, res) => {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const { taskerId, agreedTime, agreedPayment } = req.body;

    // Validate required fields
    if (!taskerId || !agreedTime || !agreedPayment) {
      return res.status(400).json({
        success: false,
        message: 'All fields (taskerId, agreedTime, agreedPayment) are required'
      });
    }

    // Validate ObjectId format for taskerId
    if (!mongoose.Types.ObjectId.isValid(taskerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tasker ID'
      });
    }

    // Validate agreedTime is a valid date
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

    // Verify user is task owner
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

    // Validate agreed time is within task date range
    if (agreedTimeDate < task.startDate || agreedTimeDate > task.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Agreed time must be between task start date and end date'
      });
    }

    // Check if this is a targeted task
    const isTargetedTask = task.isTargeted && task.targetedTasker && task.targetedTasker.toString() === taskerId;
    
    // Find the tasker's application for this task
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

    // Check that tasker has confirmed availability
    if (!application.confirmedByTasker) {
      return res.status(400).json({
        success: false,
        message: 'Tasker has not confirmed their availability'
      });
    }

    // Check that agreed time matches the tasker's confirmed time (if provided)
    if (application.confirmedTime && Math.abs(agreedTimeDate.getTime() - application.confirmedTime.getTime()) > 60000) {
      return res.status(400).json({
        success: false,
        message: 'Agreed time should match the tasker\'s confirmed time'
      });
    }

    // Verify tasker exists and is active
    const tasker = await User.findById(taskerId);
    if (!tasker || tasker.role !== 'tasker') {
      return res.status(404).json({
        success: false,
        message: 'Tasker not found'
      });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update task with selected tasker but keep status as 'active' until payment is made
      task.selectedTasker = taskerId;
      task.agreedPayment = agreedPayment;
      task.agreedTime = agreedTimeDate;
      // Don't change status to 'scheduled' yet - wait for advance payment
      
      console.log('Saving task with data:', {
        taskId: task._id,
        selectedTasker: task.selectedTasker,
        agreedPayment: task.agreedPayment,
        agreedTime: task.agreedTime
      });
      
      await task.save({ session });
      
      console.log('Task saved successfully');

      // Update application status
      application.status = 'confirmed';
      await application.save({ session });

      // Reject all other applications (if any exist for this task)
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

      // Populate and return updated task
      await task.populate('selectedTasker', 'fullName email phone taskerProfile rating statistics');
      await task.populate('targetedTasker', 'fullName email phone taskerProfile rating statistics');
      await task.populate('customer', 'fullName email');

      console.log('Returning task data:', {
        taskId: task._id,
        agreedPayment: task.agreedPayment,
        agreedTime: task.agreedTime,
        selectedTasker: task.selectedTasker
      });

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

// @desc    Confirm availability time and payment (tasker)
// @route   POST /api/tasks/:id/confirm-time
// @access  Private (Tasker only - must have applied)
export const confirmTime = async (req, res) => {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    // Verify user is a tasker
    if (req.user.role !== 'tasker') {
      return res.status(403).json({
        success: false,
        message: 'Only taskers can confirm their availability'
      });
    }

    const { confirmedTime, confirmedPayment } = req.body;

    // Validate required fields
    if (!confirmedTime || !confirmedPayment) {
      return res.status(400).json({
        success: false,
        message: 'Both confirmedTime and confirmedPayment are required'
      });
    }

    // Validate confirmedTime is a valid date
    const confirmedTimeDate = new Date(confirmedTime);
    if (isNaN(confirmedTimeDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmed time format'
      });
    }

    // Ensure confirmedTime is in the future
    if (confirmedTimeDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Confirmed time must be in the future'
      });
    }

    // Validate confirmedPayment is a positive number
    if (typeof confirmedPayment !== 'number' || confirmedPayment <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Confirmed payment must be a positive number'
      });
    }

    // Find the task
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Ensure task is still in active state
    if (task.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Task is no longer in active state'
      });
    }

    // Ensure confirmedPayment is within task's min/max range
    if (confirmedPayment < task.minPayment || confirmedPayment > task.maxPayment) {
      return res.status(400).json({
        success: false,
        message: `Confirmed payment must be between $${task.minPayment} and $${task.maxPayment}`
      });
    }

    // Ensure confirmedTime is within task's date range
    if (confirmedTimeDate < task.startDate || confirmedTimeDate > task.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Confirmed time must be within the task\'s start and end date range'
      });
    }

    // Check if this is a targeted task where the current user is the targeted tasker
    const isTargetedTasker = task.isTargeted && task.targetedTasker && task.targetedTasker.toString() === req.user._id.toString();
    
    let application;
    
    if (isTargetedTasker) {
      // For targeted tasks, create an application if it doesn't exist
      application = await Application.findOne({
        task: req.params.id,
        tasker: req.user._id
      });
      
      if (!application) {
        // Create a new application for the targeted tasker
        application = await Application.create({
          task: req.params.id,
          tasker: req.user._id,
          proposedPayment: confirmedPayment, // Use confirmed payment as proposed payment
          note: 'Direct hire application',
          status: 'pending'
        });
      }
    } else {
      // For regular tasks, find the existing application
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

      // Check if application can be confirmed by tasker
      if (!application.canBeConfirmedByTasker()) {
        return res.status(400).json({
          success: false,
          message: 'Application cannot be confirmed (either already confirmed or not pending)'
        });
      }
    }

    // Update the application
    application.confirmedByTasker = true;
    application.confirmedTime = confirmedTimeDate;
    application.confirmedPayment = confirmedPayment;
    
    await application.save();

    // Populate application details
    await application.populate('task', 'title category area startDate endDate minPayment maxPayment');
    await application.populate('tasker', 'fullName email phone');

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

// @desc    Confirm schedule (tasker)
// @route   POST /api/tasks/:id/confirm-schedule
// @access  Private (Selected tasker only)
export const confirmSchedule = async (req, res) => {
  try {
    // Validate ObjectId format
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

    // Verify user is selected tasker
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

// @desc    Complete task (customer)
// @route   POST /api/tasks/:id/complete
// @access  Private (Task owner only)
export const completeTask = async (req, res) => {
  try {
    // Validate ObjectId format
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

    // Verify user is task owner
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

    // Update task
    task.status = 'completed';
    task.customerRating = rating;
    task.customerReview = review;
    await task.save();

    // Update tasker's rating and statistics
    if (rating && task.selectedTasker) {
      const tasker = await User.findById(task.selectedTasker);
      if (tasker) {
        await tasker.updateRating(rating);
        await tasker.incrementTaskStat('tasksCompleted');
      }
    }

    // Update customer's completed tasks statistics
    await req.user.incrementTaskStat('tasksCompleted');

    await task.populate('customer', 'fullName email');
    await task.populate('selectedTasker', 'fullName email phone');
    await task.populate('targetedTasker', 'fullName email phone');

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

// @desc    Tasker complete task
// @route   POST /api/tasks/:id/tasker-complete
// @access  Private (Selected tasker only)
export const taskerCompleteTask = async (req, res) => {
  try {
    // Validate ObjectId format
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

    // Verify user is selected tasker
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

    // Update task with completion details
    if (completionPhotos) task.completionPhotos = completionPhotos;
    if (notes) task.notes = notes;
    
    await task.save();

    await task.populate('customer', 'fullName email phone');
    await task.populate('selectedTasker', 'fullName email phone');
    await task.populate('targetedTasker', 'fullName email phone');

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

// @desc    Get user's tasks
// @route   GET /api/tasks/my-tasks
// @access  Private
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

// @desc    Get user's applications
// @route   GET /api/tasks/my-applications
// @access  Private (Tasker only)
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

// @desc    Get tasks by customer ID
// @route   GET /api/tasks/customer/:customerId
// @access  Public
export const getTasksByCustomerId = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    // Verify customer exists
    const customer = await User.findById(customerId);
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Build query
    const query = { customer: customerId };
    if (status) query.status = status;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const tasks = await Task.find(query)
      .populate('selectedTasker', 'fullName email rating statistics')
      .populate('targetedTasker', 'fullName email rating statistics')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      data: tasks,
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

// @desc    Mark scheduled task as completed
// @route   POST /api/tasks/:id/mark-complete
// @access  Private (Customer or selected tasker only)
export const markTaskComplete = async (req, res) => {
  try {
    // Validate ObjectId format
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

    // Verify user is customer or selected tasker or targeted tasker
    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === req.user._id.toString();
    const isTargetedTasker = task.targetedTasker && task.targetedTasker.toString() === req.user._id.toString();
    
    if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the customer or selected/targeted tasker can mark task as complete.'
      });
    }

    // Verify task is scheduled
    if (task.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled tasks can be marked as complete'
      });
    }

    // Handle customer completion
    if (isCustomer) {
      if (rating) task.customerRating = rating;
      if (review) task.customerReview = review;
      task.customerCompletedAt = new Date();
    }
    
    // Handle tasker completion
    if (isSelectedTasker || isTargetedTasker) {
      if (completionPhotos && completionPhotos.length > 0) {
        task.completionPhotos = completionPhotos;
      }
      if (completionNotes) task.completionNotes = completionNotes;
      if (taskerFeedback) task.taskerFeedback = taskerFeedback;
      if (taskerRatingForCustomer) task.taskerRatingForCustomer = taskerRatingForCustomer;
      task.taskerCompletedAt = new Date();
    }

    // Check if both parties have completed
    const bothCompleted = task.taskerCompletedAt && task.customerCompletedAt;
    
    if (bothCompleted) {
      task.status = 'completed';
      
      // Update statistics for both users
      const workingTaskerId = task.selectedTasker || task.targetedTasker;
      if (workingTaskerId) {
        const tasker = await User.findById(workingTaskerId);
        if (tasker) {
          await tasker.incrementTaskStat('tasksCompleted');
          
          // Update tasker's rating if customer provided one
          if (task.customerRating) {
            await tasker.updateRating(task.customerRating);
          }
        }
      }

      // Update customer's completed tasks statistics and rating
      const customer = await User.findById(task.customer);
      if (customer) {
        await customer.incrementTaskStat('tasksCompleted');
        
        // Update customer's rating if tasker provided one
        if (task.taskerRatingForCustomer) {
          await customer.updateRating(task.taskerRatingForCustomer);
        }
      }
    }

    await task.save();

    // Populate for response
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

// @desc    Cancel scheduled task
// @route   POST /api/tasks/:id/cancel-schedule
// @access  Private (Customer or selected tasker only)
export const cancelScheduledTask = async (req, res) => {
  try {
    // Validate ObjectId format
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

    // Verify user is customer or selected tasker or targeted tasker
    const isCustomer = task.customer.toString() === req.user._id.toString();
    const isSelectedTasker = task.selectedTasker && task.selectedTasker.toString() === req.user._id.toString();
    const isTargetedTasker = task.targetedTasker && task.targetedTasker.toString() === req.user._id.toString();
    
    if (!isCustomer && !isSelectedTasker && !isTargetedTasker) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the customer or selected/targeted tasker can cancel the schedule.'
      });
    }

    // Verify task is scheduled
    if (task.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled tasks can be cancelled'
      });
    }

    // Update task status back to active and clear scheduling details
    task.status = 'active';
    task.selectedTasker = null;
    task.agreedTime = null;
    task.agreedPayment = null;
    task.taskerConfirmed = false;
    
    // Add cancellation details
    task.cancellationReason = reason;
    task.cancelledBy = req.user._id;
    task.cancelledAt = new Date();

    await task.save();

    // Populate for response
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

// @desc    Upload task photos
// @route   POST /api/tasks/upload-photos
// @access  Private (Customers only)
export const uploadTaskPhotos = async (req, res) => {
  try {
    // Verify user is customer
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
      // Validate file type
      if (!allowedTypes.includes(photo.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `Invalid file type for ${photo.name}. Only JPEG, PNG, GIF, and WebP are allowed.`
        });
      }

      // Validate file size (5MB limit per photo)
      if (photo.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: `File ${photo.name} is too large. Maximum size is 5MB per photo.`
        });
      }

      // For now, create a data URL (in production, upload to cloud storage)
      const base64 = photo.data.toString('base64');
      const dataUrl = `data:${photo.mimetype};base64,${base64}`;
      
      uploadedPhotos.push({
        url: dataUrl,
        filename: photo.name,
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

// @desc    Upload completion photos
// @route   POST /api/tasks/upload-completion-photo
// @access  Private (Taskers only)
export const uploadCompletionPhoto = async (req, res) => {
  try {
    // For now, we'll create a simple mock upload that converts the file to a data URL
    // In production, you'd upload to AWS S3, Cloudinary, or similar service
    
    if (!req.files || !req.files.photo) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    const photo = req.files.photo;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(photo.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'
      });
    }

    // Validate file size (10MB limit)
    if (photo.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }

    // For now, create a data URL (in production, upload to cloud storage)
    const base64 = photo.data.toString('base64');
    const dataUrl = `data:${photo.mimetype};base64,${base64}`;

    res.status(200).json({
      success: true,
      data: {
        url: dataUrl,
        filename: photo.name,
        size: photo.size,
        mimetype: photo.mimetype
      }
    });
  } catch (error) {
    console.error('Upload completion photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading photo'
    });
  }
};

// @desc    Get category statistics with task counts
// @route   GET /api/tasks/category-stats
// @access  Public
export const getCategoryStats = async (req, res) => {
  try {
    // Get task counts by category for active tasks only
    const categoryStats = await Task.aggregate([
      {
        $match: {
          status: 'active',
          startDate: { $gt: new Date() },
          isTargeted: false  // Only count non-targeted tasks for public stats
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

    // Transform the data into a more usable format
    const categoryData = categoryStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Define all possible categories with default count of 0
    const allCategories = [
      'Cleaning', 'Repairing', 'Handyman', 'Maintenance', 
      'Gardening', 'Landscaping', 'Installations', 'Security',
      'Moving', 'Plumbing', 'Electrical', 'Painting', 
      'Carpentry', 'Repairs', 'Delivery', 'Other'
    ];

    // Ensure all categories are included with their counts
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