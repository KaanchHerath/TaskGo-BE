import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Dummy data for customer and tasker
const customerData = {
  username: 'testcustomer',
  email: 'customer@example.com',
  phone: '+1234567890',
  password: 'TestPass123!',
  role: 'customer',
  fullName: 'Test Customer',
  province: 'TestProvince'
};
const taskerData = {
  email: 'tasker2@example.com',
  password: 'TestPass123!',
  confirmPassword: 'TestPass123!',
  fullName: 'Test Tasker2',
  skills: 'plumbing',
  country: 'TestCountry',
  area: 'TestArea'
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');

// Ensure MongoDB is connected and server is running

describe('Auth API', () => {
  let server;
  beforeAll(async () => {
    server = app.listen(4002); // Use a different port for test isolation
  });
  afterAll(async () => {
    await mongoose.connection.close();
    server.close();
  });

  it('should register a tasker with file upload and return JWT with role', async () => {
    const res = await request(server)
      .post('/api/auth/register-tasker')
      .field('email', taskerData.email)
      .field('password', taskerData.password)
      .field('confirmPassword', taskerData.confirmPassword)
      .field('fullName', taskerData.fullName)
      .field('skills', taskerData.skills)
      .field('country', taskerData.country)
      .field('area', taskerData.area)
      .attach('idDocument', path.join(fixturesDir, 'id.pdf'))
      .attach('qualificationDocuments', path.join(fixturesDir, 'qual.pdf'));
    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
    const payload = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64').toString());
    expect(payload.role).toBe('tasker');
  });

  it('should fail if passwords do not match', async () => {
    const res = await request(server)
      .post('/api/auth/register-tasker')
      .field('email', 'tasker3@example.com')
      .field('password', 'TestPass123!')
      .field('confirmPassword', 'WrongPass123!')
      .field('fullName', 'Test Tasker3')
      .field('skills', 'plumbing')
      .field('country', 'TestCountry')
      .field('area', 'TestArea')
      .attach('idDocument', path.join(fixturesDir, 'id.pdf'))
      .attach('qualificationDocuments', path.join(fixturesDir, 'qual.pdf'));
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Passwords do not match/);
  });

  it('should fail if required fields are missing', async () => {
    const res = await request(server)
      .post('/api/auth/register-tasker')
      .field('email', 'tasker4@example.com')
      .field('password', 'TestPass123!')
      .field('confirmPassword', 'TestPass123!')
      // missing fullName, skills, country, area
      .attach('idDocument', path.join(fixturesDir, 'id.pdf'))
      .attach('qualificationDocuments', path.join(fixturesDir, 'qual.pdf'));
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/All fields are required/);
  });

  it('should fail if idDocument is missing', async () => {
    const res = await request(server)
      .post('/api/auth/register-tasker')
      .field('email', 'tasker5@example.com')
      .field('password', 'TestPass123!')
      .field('confirmPassword', 'TestPass123!')
      .field('fullName', 'Test Tasker5')
      .field('skills', 'plumbing')
      .field('country', 'TestCountry')
      .field('area', 'TestArea')
      // no idDocument
      .attach('qualificationDocuments', path.join(fixturesDir, 'qual.pdf'));
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/ID Document is required/);
  });
}); 