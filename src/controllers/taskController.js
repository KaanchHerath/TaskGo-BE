import Task from '../models/Task.js';
import Application from '../models/Application.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// @desc    Create new task
// @route   POST /api/v1/tasks
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
// @route   GET /api/v1/tasks
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
    const query = { status: 'active', startDate: { $gt: new Date() } };
    
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
        return {
          ...task.toObject(),
          applicationCount
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
// @route   GET /api/v1/tasks/:id
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
      .populate('selectedTasker', 'fullName email phone rating statistics taskerProfile');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Updated access permissions based on task status
    if (task.status === 'active') {
      // Active tasks are visible to all users (public access)
      // No authentication required
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

      if (!isCustomer && !isSelectedTasker) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only the customer and selected tasker can view scheduled tasks.'
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

      if (!isCustomer && !isSelectedTasker) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only task participants can view this task.'
        });
      }
    }

    // Manually populate application count
    const applicationCount = await Application.countDocuments({ task: task._id });
    const taskWithApplicationCount = {
      ...task.toObject(),
      applicationCount
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
// @route   POST /api/v1/tasks/:id/apply
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
// @route   GET /api/v1/tasks/:id/applications
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
// @route   POST /api/v1/tasks/:id/select-tasker
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

    // Find the tasker's application for this task
    const application = await Application.findOne({
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
      // Update task
      task.selectedTasker = taskerId;
      task.agreedPayment = agreedPayment;
      task.agreedTime = agreedTimeDate;
      task.status = 'scheduled';
      await task.save({ session });

      // Update application status
      application.status = 'confirmed';
      await application.save({ session });

      // Reject all other applications
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
      await task.populate('customer', 'fullName email');

      res.status(200).json({
        success: true,
        message: 'Tasker selected successfully',
        data: task
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
// @route   POST /api/v1/tasks/:id/confirm-time
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

    // Find the tasker's application for this task
    const application = await Application.findOne({
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
// @route   POST /api/v1/tasks/:id/confirm-schedule
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
// @route   POST /api/v1/tasks/:id/complete
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
// @route   POST /api/v1/tasks/:id/tasker-complete
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
// @route   GET /api/v1/tasks/my-tasks
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
// @route   GET /api/v1/tasks/my-applications
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
// @route   GET /api/v1/tasks/customer/:customerId
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
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get tasks with pagination
    const tasks = await Task.find(query)
      .populate('customer', 'fullName email rating statistics')
      .populate('selectedTasker', 'fullName email rating statistics')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Manually populate application count for each task
    const tasksWithApplicationCount = await Promise.all(
      tasks.map(async (task) => {
        const applicationCount = await Application.countDocuments({ task: task._id });
        return {
          ...task.toObject(),
          applicationCount
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
      },
      customer: {
        _id: customer._id,
        fullName: customer.fullName,
        email: customer.email,
        rating: customer.rating,
        statistics: customer.statistics
      }
    });
  } catch (error) {
    console.error('Get tasks by customer ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching customer tasks'
    });
  }
}; 