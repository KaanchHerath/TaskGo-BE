import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Application from '../models/Application.js';
import jwt from 'jsonwebtoken';

// Test database connection
const MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/taskgo_test';

describe('Task Management API', () => {
  let customerToken, taskerToken, adminToken;
  let customerId, taskerId, adminId;
  let testTask, testApplication;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(MONGO_URI);
    
    // Clean database
    await User.deleteMany({});
    await Task.deleteMany({});
    await Application.deleteMany({});

    // Create test users
    const customer = await User.create({
      fullName: 'Test Customer',
      email: 'customer@test.com',
      password: 'password123',
      phone: '1234567890',
      role: 'customer',
      province: 'Colombo'
    });

    const tasker = await User.create({
      fullName: 'Test Tasker',
      email: 'tasker@test.com',
      password: 'password123',
      phone: '0987654321',
      role: 'tasker',
      province: 'Colombo',
      skills: ['Plumbing', 'Electrical'],
      rating: 4.5,
      completedTasks: 10
    });

    const admin = await User.create({
      fullName: 'Test Admin',
      email: 'admin@test.com',
      password: 'password123',
      phone: '1122334455',
      role: 'admin'
    });

    customerId = customer._id;
    taskerId = tasker._id;
    adminId = admin._id;

    // Generate JWT tokens
    customerToken = jwt.sign(
      { userId: customerId, role: 'customer' },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );

    taskerToken = jwt.sign(
      { userId: taskerId, role: 'tasker' },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { userId: adminId, role: 'admin' },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up and close connection
    await User.deleteMany({});
    await Task.deleteMany({});
    await Application.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/tasks', () => {
    test('Should create a new task successfully (customer)', async () => {
      const taskData = {
        title: 'Plumbing Service Needed',
        tags: ['plumbing', 'repair'],
        category: 'Plumbing',
        minPayment: 50,
        maxPayment: 100,
        area: 'Colombo',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // Day after tomorrow
        description: 'Fix a leaking pipe in my kitchen.',
        photos: ['https://example.com/photo1.jpg']
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.customer._id).toBe(customerId.toString());
      expect(response.body.data.status).toBe('active');

      testTask = response.body.data;
    });

    test('Should fail to create task with invalid data', async () => {
      const invalidTaskData = {
        title: '', // Empty title
        category: 'InvalidCategory',
        minPayment: -10, // Negative payment
        maxPayment: 5, // Less than minPayment
        area: 'InvalidArea'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(invalidTaskData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    test('Should fail when tasker tries to create task', async () => {
      const taskData = {
        title: 'Test Task',
        category: 'Cleaning',
        minPayment: 50,
        maxPayment: 100,
        area: 'Colombo',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${taskerToken}`)
        .send(taskData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Only customers can create tasks');
    });

    test('Should fail without authentication', async () => {
      const taskData = {
        title: 'Test Task',
        category: 'Cleaning',
        minPayment: 50,
        maxPayment: 100,
        area: 'Colombo',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
      };

      await request(app)
        .post('/api/tasks')
        .send(taskData)
        .expect(401);
    });
  });

  describe('GET /api/tasks', () => {
    test('Should get all active tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test('Should filter tasks by category', async () => {
      const response = await request(app)
        .get('/api/tasks?category=Plumbing')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(task => {
        expect(task.category).toBe('Plumbing');
      });
    });

    test('Should filter tasks by area', async () => {
      const response = await request(app)
        .get('/api/tasks?area=Colombo')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(task => {
        expect(task.area).toBe('Colombo');
      });
    });

    test('Should paginate results', async () => {
      const response = await request(app)
        .get('/api/tasks?page=1&limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/tasks/:id', () => {
    test('Should get single active task (public access)', async () => {
      const response = await request(app)
        .get(`/api/tasks/${testTask._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testTask._id);
    });

    test('Should return 404 for non-existent task', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/tasks/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Task not found');
    });

    test('Should return 400 for invalid task ID', async () => {
      const response = await request(app)
        .get('/api/tasks/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid task ID');
    });
  });

  describe('POST /api/tasks/:id/apply', () => {
    test('Should allow tasker to apply for task', async () => {
      const applicationData = {
        proposedPayment: 75,
        note: 'I have 5 years experience in plumbing',
        estimatedDuration: 2,
        availableStartDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
        availableEndDate: new Date(Date.now() + 36 * 60 * 60 * 1000)
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/apply`)
        .set('Authorization', `Bearer ${taskerToken}`)
        .send(applicationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.proposedPayment).toBe(applicationData.proposedPayment);
      expect(response.body.data.tasker._id).toBe(taskerId.toString());

      testApplication = response.body.data;
    });

    test('Should prevent duplicate applications', async () => {
      const applicationData = {
        proposedPayment: 80,
        note: 'Another application'
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/apply`)
        .set('Authorization', `Bearer ${taskerToken}`)
        .send(applicationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You have already applied for this task');
    });

    test('Should prevent customer from applying to tasks', async () => {
      const applicationData = {
        proposedPayment: 75,
        note: 'Test application'
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/apply`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(applicationData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Only taskers can apply for tasks');
    });

    test('Should validate proposed payment within range', async () => {
      // Create another tasker for this test
      const anotherTasker = await User.create({
        fullName: 'Another Tasker',
        email: 'tasker2@test.com',
        password: 'password123',
        phone: '5555555555',
        role: 'tasker',
        province: 'Colombo'
      });

      const anotherTaskerToken = jwt.sign(
        { userId: anotherTasker._id, role: 'tasker' },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      );

      const applicationData = {
        proposedPayment: 150, // Above maxPayment (100)
        note: 'High payment application'
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/apply`)
        .set('Authorization', `Bearer ${anotherTaskerToken}`)
        .send(applicationData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tasks/:id/applications', () => {
    test('Should allow task owner to view applications', async () => {
      const response = await request(app)
        .get(`/api/tasks/${testTask._id}/applications`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('Should prevent non-owner from viewing applications', async () => {
      const response = await request(app)
        .get(`/api/tasks/${testTask._id}/applications`)
        .set('Authorization', `Bearer ${taskerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });
  });

  describe('POST /api/tasks/:id/select-tasker', () => {
    test('Should allow customer to select tasker', async () => {
      const selectionData = {
        applicationId: testApplication._id,
        agreedPayment: 75
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/select-tasker`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(selectionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('scheduled');
      expect(response.body.data.selectedTasker._id).toBe(taskerId.toString());
      expect(response.body.data.agreedPayment).toBe(75);

      // Update testTask for subsequent tests
      testTask = response.body.data;
    });

    test('Should prevent non-owner from selecting tasker', async () => {
      // Create another task for this test
      const anotherTask = await Task.create({
        title: 'Another Task',
        category: 'Cleaning',
        minPayment: 30,
        maxPayment: 60,
        area: 'Colombo',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        customer: customerId
      });

      const selectionData = {
        applicationId: testApplication._id,
        agreedPayment: 50
      };

      const response = await request(app)
        .post(`/api/tasks/${anotherTask._id}/select-tasker`)
        .set('Authorization', `Bearer ${taskerToken}`)
        .send(selectionData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });
  });

  describe('POST /api/tasks/:id/confirm-schedule', () => {
    test('Should allow selected tasker to confirm schedule', async () => {
      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/confirm-schedule`)
        .set('Authorization', `Bearer ${taskerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.taskerConfirmed).toBe(true);

      // Update testTask for subsequent tests
      testTask = response.body.data;
    });

    test('Should prevent non-selected tasker from confirming', async () => {
      // Create another tasker
      const anotherTasker = await User.create({
        fullName: 'Third Tasker',
        email: 'tasker3@test.com',
        password: 'password123',
        phone: '6666666666',
        role: 'tasker',
        province: 'Colombo'
      });

      const anotherTaskerToken = jwt.sign(
        { userId: anotherTasker._id, role: 'tasker' },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/confirm-schedule`)
        .set('Authorization', `Bearer ${anotherTaskerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });
  });

  describe('POST /api/tasks/:id/tasker-complete', () => {
    test('Should allow selected tasker to mark task complete', async () => {
      const completionData = {
        completionPhotos: ['https://example.com/completion1.jpg'],
        notes: 'Task completed successfully'
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/tasker-complete`)
        .set('Authorization', `Bearer ${taskerToken}`)
        .send(completionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.completionPhotos).toEqual(completionData.completionPhotos);
    });

    test('Should prevent non-selected tasker from completing task', async () => {
      const anotherTasker = await User.create({
        fullName: 'Fourth Tasker',
        email: 'tasker4@test.com',
        password: 'password123',
        phone: '7777777777',
        role: 'tasker',
        province: 'Colombo'
      });

      const anotherTaskerToken = jwt.sign(
        { userId: anotherTasker._id, role: 'tasker' },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/tasker-complete`)
        .set('Authorization', `Bearer ${anotherTaskerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });
  });

  describe('POST /api/tasks/:id/complete', () => {
    test('Should allow customer to complete task with rating', async () => {
      const completionData = {
        rating: 5,
        review: 'Excellent work! Very professional and timely.'
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/complete`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(completionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.customerRating).toBe(5);
      expect(response.body.data.customerReview).toBe(completionData.review);

      // Verify tasker's rating was updated
      const updatedTasker = await User.findById(taskerId);
      expect(updatedTasker.completedTasks).toBe(11); // Was 10, now 11
      expect(updatedTasker.rating).toBeGreaterThan(4.5); // Should have increased
    });

    test('Should prevent non-owner from completing task', async () => {
      // Create another task for this test
      const anotherTask = await Task.create({
        title: 'Test Complete Task',
        category: 'Cleaning',
        minPayment: 30,
        maxPayment: 60,
        area: 'Colombo',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        customer: customerId,
        selectedTasker: taskerId,
        status: 'scheduled',
        taskerConfirmed: true
      });

      const completionData = {
        rating: 4,
        review: 'Good work'
      };

      const response = await request(app)
        .post(`/api/tasks/${anotherTask._id}/complete`)
        .set('Authorization', `Bearer ${taskerToken}`)
        .send(completionData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });
  });

  describe('GET /api/tasks/user/my-tasks', () => {
    test('Should get customer\'s tasks', async () => {
      const response = await request(app)
        .get('/api/tasks/user/my-tasks')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('Should get tasker\'s tasks', async () => {
      const response = await request(app)
        .get('/api/tasks/user/my-tasks')
        .set('Authorization', `Bearer ${taskerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('Should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/tasks/user/my-tasks?status=completed')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(task => {
        expect(task.status).toBe('completed');
      });
    });
  });

  describe('GET /api/tasks/user/my-applications', () => {
    test('Should get tasker\'s applications', async () => {
      const response = await request(app)
        .get('/api/tasks/user/my-applications')
        .set('Authorization', `Bearer ${taskerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('Should prevent customer from viewing applications', async () => {
      const response = await request(app)
        .get('/api/tasks/user/my-applications')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Only taskers can view applications');
    });

    test('Should filter applications by status', async () => {
      const response = await request(app)
        .get('/api/tasks/user/my-applications?status=confirmed')
        .set('Authorization', `Bearer ${taskerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(application => {
        expect(application.status).toBe('confirmed');
      });
    });
  });

  describe('Error Handling', () => {
    test('Should handle server errors gracefully', async () => {
      // Mock a server error by using invalid ObjectId
      const response = await request(app)
        .get('/api/tasks/invalid-object-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid task ID');
    });

    test('Should require authentication for protected routes', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({
          title: 'Test Task',
          category: 'Cleaning',
          minPayment: 50,
          maxPayment: 100,
          area: 'Colombo',
          startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
        })
        .expect(401);

      expect(response.body.message).toContain('token');
    });
  });

  describe('Task Model Validations', () => {
    test('Should validate task creation with all required fields', async () => {
      const validTask = {
        title: 'Valid Task',
        category: 'Cleaning',
        minPayment: 50,
        maxPayment: 100,
        area: 'Colombo',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        customer: customerId
      };

      const task = new Task(validTask);
      await expect(task.save()).resolves.toBeDefined();
    });

    test('Should reject task with end date before start date', async () => {
      const invalidTask = {
        title: 'Invalid Task',
        category: 'Cleaning',
        minPayment: 50,
        maxPayment: 100,
        area: 'Colombo',
        startDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Before start date
        customer: customerId
      };

      const task = new Task(invalidTask);
      await expect(task.save()).rejects.toThrow();
    });

    test('Should reject task with max payment less than min payment', async () => {
      const invalidTask = {
        title: 'Invalid Task',
        category: 'Cleaning',
        minPayment: 100,
        maxPayment: 50, // Less than min payment
        area: 'Colombo',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        customer: customerId
      };

      const task = new Task(invalidTask);
      await expect(task.save()).rejects.toThrow();
    });
  });

  describe('Application Model Validations', () => {
    test('Should prevent tasker from applying to own task', async () => {
      // Create a task by the tasker (simulating error scenario)
      const taskerTask = await Task.create({
        title: 'Tasker Own Task',
        category: 'Cleaning',
        minPayment: 50,
        maxPayment: 100,
        area: 'Colombo',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        customer: taskerId // Tasker as customer
      });

      const application = new Application({
        task: taskerTask._id,
        tasker: taskerId, // Same as customer
        proposedPayment: 75
      });

      await expect(application.save()).rejects.toThrow('Cannot apply to your own task');
    });

    test('Should validate proposed payment within task range', async () => {
      const testTaskForValidation = await Task.create({
        title: 'Payment Validation Task',
        category: 'Cleaning',
        minPayment: 50,
        maxPayment: 100,
        area: 'Colombo',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        customer: customerId
      });

      const application = new Application({
        task: testTaskForValidation._id,
        tasker: taskerId,
        proposedPayment: 150 // Above max payment
      });

      await expect(application.save()).rejects.toThrow();
    });
  });
}); 