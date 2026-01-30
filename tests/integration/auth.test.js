/**
 * Integration Tests for Authentication Endpoints
 * 
 * Tests teacher and student authentication flows
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Teacher = require('../../src/models/Teacher');
const Student = require('../../src/models/Student');

describe('Authentication Integration Tests', () => {
  describe('Teacher Authentication', () => {
    const teacherData = {
      name: 'Dr. Smith',
      email: 'teacher@test.com',
      password: 'SecurePass123!'
    };

    test('POST /api/teacher/signup - creates new teacher account', async () => {
      const response = await request(app)
        .post('/api/teacher/signup')
        .send(teacherData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Teacher registered successfully');
      expect(response.body).toHaveProperty('teacher');
      expect(response.body.teacher).toHaveProperty('email', teacherData.email);
      expect(response.body.teacher).toHaveProperty('name', teacherData.name);
      expect(response.body.teacher).not.toHaveProperty('password');
    });

    test('POST /api/teacher/signup - rejects duplicate email', async () => {
      // Create first teacher
      await request(app)
        .post('/api/teacher/signup')
        .send(teacherData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/teacher/signup')
        .send(teacherData)
        .expect(409);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('already exists');
    });

    test('POST /api/teacher/signup - validates required fields', async () => {
      const response = await request(app)
        .post('/api/teacher/signup')
        .send({ email: 'test@test.com' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    test('POST /api/teacher/login - authenticates valid credentials', async () => {
      // Create teacher first
      await request(app)
        .post('/api/teacher/signup')
        .send(teacherData)
        .expect(201);

      // Login
      const response = await request(app)
        .post('/api/teacher/login')
        .send({
          email: teacherData.email,
          password: teacherData.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('teacher');
      expect(response.body.teacher).toHaveProperty('email', teacherData.email);
    });

    test('POST /api/teacher/login - rejects invalid password', async () => {
      // Create teacher first
      await request(app)
        .post('/api/teacher/signup')
        .send(teacherData)
        .expect(201);

      // Try wrong password
      const response = await request(app)
        .post('/api/teacher/login')
        .send({
          email: teacherData.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid');
    });

    test('POST /api/teacher/login - rejects non-existent email', async () => {
      const response = await request(app)
        .post('/api/teacher/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'SomePassword123!'
        })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    test('JWT token contains correct teacher ID', async () => {
      // Create and login
      const signupRes = await request(app)
        .post('/api/teacher/signup')
        .send(teacherData)
        .expect(201);

      const loginRes = await request(app)
        .post('/api/teacher/login')
        .send({
          email: teacherData.email,
          password: teacherData.password
        })
        .expect(200);

      const token = loginRes.body.token;
      expect(token).toBeTruthy();

      // Decode token (simple check without verification)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      expect(payload).toHaveProperty('userId', signupRes.body.teacher._id);
      expect(payload).toHaveProperty('role', 'teacher');
    });
  });

  describe('Student Authentication', () => {
    const studentData = {
      name: 'John Student',
      email: 'student@test.com',
      password: 'StudentPass123!',
      rollNumber: 'STU001'
    };

    test('POST /api/student/signup - creates new student account', async () => {
      const response = await request(app)
        .post('/api/student/signup')
        .send(studentData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Student registered successfully');
      expect(response.body).toHaveProperty('student');
      expect(response.body.student).toHaveProperty('email', studentData.email);
      expect(response.body.student).toHaveProperty('rollNumber', studentData.rollNumber);
      expect(response.body.student).not.toHaveProperty('password');
    });

    test('POST /api/student/signup - rejects duplicate roll number', async () => {
      // Create first student
      await request(app)
        .post('/api/student/signup')
        .send(studentData)
        .expect(201);

      // Try duplicate roll number with different email
      const response = await request(app)
        .post('/api/student/signup')
        .send({
          ...studentData,
          email: 'different@test.com'
        })
        .expect(409);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('already exists');
    });

    test('POST /api/student/login - authenticates valid credentials', async () => {
      // Create student first
      await request(app)
        .post('/api/student/signup')
        .send(studentData)
        .expect(201);

      // Login
      const response = await request(app)
        .post('/api/student/login')
        .send({
          email: studentData.email,
          password: studentData.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('student');
    });

    test('JWT token contains correct student ID', async () => {
      // Create and login
      const signupRes = await request(app)
        .post('/api/student/signup')
        .send(studentData)
        .expect(201);

      const loginRes = await request(app)
        .post('/api/student/login')
        .send({
          email: studentData.email,
          password: studentData.password
        })
        .expect(200);

      const token = loginRes.body.token;
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      expect(payload).toHaveProperty('userId', signupRes.body.student._id);
      expect(payload).toHaveProperty('role', 'student');
    });
  });

  describe('Cross-Role Validation', () => {
    test('Teacher and student can have same email without conflict', async () => {
      const sharedEmail = 'same@test.com';

      // Create teacher
      await request(app)
        .post('/api/teacher/signup')
        .send({
          name: 'Teacher',
          email: sharedEmail,
          password: 'TeacherPass123!'
        })
        .expect(201);

      // Create student with same email (should work - different collections)
      await request(app)
        .post('/api/student/signup')
        .send({
          name: 'Student',
          email: sharedEmail,
          password: 'StudentPass123!',
          rollNumber: 'STU002'
        })
        .expect(201);
    });
  });
});
