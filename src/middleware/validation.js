import Joi from 'joi';


/**
 * Validation middleware using Joi schemas
 */

// Common validation schemas
const commonSchemas = {
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(15),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }
};

// Auth validation schemas
const authSchemas = {
  register: Joi.object({
    fullName: Joi.string().min(2).max(50).required(),
    email: commonSchemas.email,
    password: commonSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    phone: commonSchemas.phone.required(),
    role: Joi.string().valid('customer', 'tasker').required()
  }),

  login: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password
  }),

  taskerRegistration: Joi.object({
    fullName: Joi.string().min(2).max(50).required(),
    email: commonSchemas.email,
    password: commonSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
    phone: commonSchemas.phone.required(),
    categories: Joi.array().items(Joi.string()).min(1).required(),
    experience: Joi.string().required(),
    hourlyRate: Joi.number().min(0).required(),
    availability: Joi.object({
      monday: Joi.boolean().default(false),
      tuesday: Joi.boolean().default(false),
      wednesday: Joi.boolean().default(false),
      thursday: Joi.boolean().default(false),
      friday: Joi.boolean().default(false),
      saturday: Joi.boolean().default(false),
      sunday: Joi.boolean().default(false)
    }).required()
  })
};

// Task validation schemas
const taskSchemas = {
  createTask: Joi.object({
    title: Joi.string().min(5).max(100).required(),
    description: Joi.string().min(10).max(1000).required(),
    category: Joi.string().required(),
    area: Joi.string().required(),
    maxPayment: Joi.number().min(0).required(),
    startDate: Joi.date().greater('now').required(),
    duration: Joi.number().min(1).max(24).required(),
    targetedTasker: commonSchemas.objectId.optional()
  }),

  updateTask: Joi.object({
    title: Joi.string().min(5).max(100).optional(),
    description: Joi.string().min(10).max(1000).optional(),
    category: Joi.string().optional(),
    area: Joi.string().optional(),
    maxPayment: Joi.number().min(0).optional(),
    startDate: Joi.date().greater('now').optional(),
    duration: Joi.number().min(1).max(24).optional()
  }),

  getTasks: Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit,
    category: Joi.string().optional(),
    area: Joi.string().optional(),
    minPayment: Joi.number().min(0).optional(),
    maxPayment: Joi.number().min(0).optional(),
    sortBy: Joi.string().valid('createdAt', 'maxPayment', 'startDate').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  })
};

// User validation schemas
const userSchemas = {
  updateProfile: Joi.object({
    fullName: Joi.string().min(2).max(50).optional(),
    phone: commonSchemas.phone.optional(),
    address: Joi.string().max(200).optional(),
    bio: Joi.string().max(500).optional()
  }),

  changePassword: Joi.object({
    currentPassword: commonSchemas.password,
    newPassword: commonSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  })
};

// Payment validation schemas
const paymentSchemas = {
  initiatePayment: Joi.object({
    taskId: commonSchemas.objectId,
    amount: Joi.number().min(0).required(),
    paymentMethod: Joi.string().valid('advance', 'on_completion').required()
  })
};

// Feedback validation schemas
const feedbackSchemas = {
  createFeedback: Joi.object({
    taskId: commonSchemas.objectId,
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().min(10).max(500).required()
  })
};

// Chat validation schemas
const chatSchemas = {
  sendMessage: Joi.object({
    taskId: commonSchemas.objectId,
    message: Joi.string().min(1).max(1000).required()
  })
};

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
              // Validation failed 
        endpoint: req.originalUrl, 
        errors 
      };
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Replace request data with validated data
    req[property] = value;
    next();
  };


// Export validation functions
export const validateAuth = {
  register: validate(authSchemas.register),
  login: validate(authSchemas.login),
  taskerRegistration: validate(authSchemas.taskerRegistration)
};

export const validateTask = {
  create: validate(taskSchemas.createTask),
  update: validate(taskSchemas.updateTask),
  getTasks: validate(taskSchemas.getTasks, 'query'),
  getById: validate(Joi.object({ id: commonSchemas.objectId }), 'params')
};

export const validateUser = {
  updateProfile: validate(userSchemas.updateProfile),
  changePassword: validate(userSchemas.changePassword),
  getById: validate(Joi.object({ id: commonSchemas.objectId }), 'params')
};

export const validatePayment = {
  initiate: validate(paymentSchemas.initiatePayment)
};

export const validateFeedback = {
  create: validate(feedbackSchemas.createFeedback)
};

export const validateChat = {
  sendMessage: validate(chatSchemas.sendMessage)
};

// Generic validation for ObjectId parameters
export const validateObjectId = (paramName) => {
  return validate(Joi.object({ [paramName]: commonSchemas.objectId }), 'params');
};

// Generic validation for query parameters
export const validatePagination = validate(Joi.object(commonSchemas.pagination), 'query'); 