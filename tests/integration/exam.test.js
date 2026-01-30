/**
 * Integration Tests for Exam Endpoints
 * 
 * Tests exam CRUD operations, question management, and authorization
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Teacher = require('../../src/models/Teacher');
const Exam = require('../../src/models/Exam');
const Question = require('../../src/models/Question');

describe('Exam Integration Tests', () => {
  let teacherToken;
  let teacherId;
  let otherTeacherToken;
  let otherTeacherId;

  // Setup: Create teachers and get auth tokens
  beforeEach(async () => {
    // Create first teacher
    const teacher1 = await request(app)
      .post('/api/teacher/signup')
      .send({
        name: 'Teacher 1',
        email: 'teacher1@test.com',
        password: 'Pass123!'
      });
    
    teacherId = teacher1.body.teacher._id;
    
    const login1 = await request(app)
      .post('/api/teacher/login')
      .send({
        email: 'teacher1@test.com',
        password: 'Pass123!'
      });
    
    teacherToken = login1.body.token;

    // Create second teacher for authorization tests
    const teacher2 = await request(app)
      .post('/api/teacher/signup')
      .send({
        name: 'Teacher 2',
        email: 'teacher2@test.com',
        password: 'Pass123!'
      });
    
    otherTeacherId = teacher2.body.teacher._id;
    
    const login2 = await request(app)
      .post('/api/teacher/login')
      .send({
        email: 'teacher2@test.com',
        password: 'Pass123!'
      });
    
    otherTeacherToken = login2.body.token;
  });

  describe('POST /api/exam/create', () => {
    test('creates exam with valid data', async () => {
      const examData = {
        title: 'Biology Midterm',
        subject: 'Biology',
        instructions: 'Answer all questions',
        duration: 120
      };

      const response = await request(app)
        .post('/api/exam/create')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(examData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Exam created successfully');
      expect(response.body).toHaveProperty('exam');
      expect(response.body.exam).toHaveProperty('title', examData.title);
      expect(response.body.exam).toHaveProperty('teacher_id', teacherId);
      expect(response.body.exam).toHaveProperty('isPublic', false);
    });

    test('requires authentication', async () => {
      const examData = {
        title: 'Test Exam',
        subject: 'Math'
      };

      await request(app)
        .post('/api/exam/create')
        .send(examData)
        .expect(401);
    });

    test('validates required fields', async () => {
      const response = await request(app)
        .post('/api/exam/create')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Only Title' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/exam/list', () => {
    test('returns paginated list of teacher exams', async () => {
      // Create multiple exams
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/exam/create')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: `Exam ${i}`,
            subject: 'Math',
            instructions: 'Test instructions'
          });
      }

      const response = await request(app)
        .get('/api/exam/list')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.items.length).toBe(3);
      expect(response.body.pagination).toHaveProperty('total', 3);
      expect(response.body.pagination).toHaveProperty('page', 1);
    });

    test('respects pagination parameters', async () => {
      // Create 5 exams
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post('/api/exam/create')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: `Exam ${i}`,
            subject: 'Math',
            instructions: 'Test'
          });
      }

      const response = await request(app)
        .get('/api/exam/list?page=1&limit=3')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(3);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(3);
      expect(response.body.pagination.totalPages).toBe(2);
      expect(response.body.pagination.hasNextPage).toBe(true);
    });

    test('only returns exams owned by authenticated teacher', async () => {
      // Teacher 1 creates exam
      await request(app)
        .post('/api/exam/create')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Teacher 1 Exam',
          subject: 'Math',
          instructions: 'Test'
        });

      // Teacher 2 creates exam
      await request(app)
        .post('/api/exam/create')
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({
          title: 'Teacher 2 Exam',
          subject: 'Science',
          instructions: 'Test'
        });

      // Teacher 1 should only see their exam
      const response = await request(app)
        .get('/api/exam/list')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(1);
      expect(response.body.items[0].title).toBe('Teacher 1 Exam');
    });

    test('requires authentication', async () => {
      await request(app)
        .get('/api/exam/list')
        .expect(401);
    });
  });

  describe('POST /api/exam/:examId/question/add', () => {
    let examId;

    beforeEach(async () => {
      const exam = await request(app)
        .post('/api/exam/create')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Exam',
          subject: 'Math',
          instructions: 'Test'
        });
      
      examId = exam.body.exam._id;
    });

    test('adds question to exam', async () => {
      const questionData = {
        text: 'What is photosynthesis?',
        modelAnswer: 'Photosynthesis is the process...',
        marks: 5,
        keypoints: [
          { text: 'chlorophyll', weight: 1 },
          { text: 'light energy', weight: 1 }
        ]
      };

      const response = await request(app)
        .post(`/api/exam/${examId}/question/add`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Question added successfully');
      expect(response.body).toHaveProperty('question');
      expect(response.body.question).toHaveProperty('text', questionData.text);
      expect(response.body.question).toHaveProperty('marks', questionData.marks);
    });

    test('validates required question fields', async () => {
      const response = await request(app)
        .post(`/api/exam/${examId}/question/add`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ text: 'Only text' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    test('rejects unauthorized teacher', async () => {
      const questionData = {
        text: 'Question',
        modelAnswer: 'Answer',
        marks: 5
      };

      await request(app)
        .post(`/api/exam/${examId}/question/add`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send(questionData)
        .expect(403);
    });

    test('rejects invalid exam ID', async () => {
      const questionData = {
        text: 'Question',
        modelAnswer: 'Answer',
        marks: 5
      };

      await request(app)
        .post('/api/exam/invalid-id/question/add')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(questionData)
        .expect(400);
    });
  });

  describe('PUT /api/exam/:examId/toggle-public', () => {
    let examId;

    beforeEach(async () => {
      const exam = await request(app)
        .post('/api/exam/create')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Exam',
          subject: 'Math',
          instructions: 'Test'
        });
      
      examId = exam.body.exam._id;
    });

    test('toggles exam visibility', async () => {
      // Toggle to public
      const response1 = await request(app)
        .put(`/api/exam/${examId}/toggle-public`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response1.body.exam.isPublic).toBe(true);

      // Toggle back to private
      const response2 = await request(app)
        .put(`/api/exam/${examId}/toggle-public`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response2.body.exam.isPublic).toBe(false);
    });

    test('rejects unauthorized teacher', async () => {
      await request(app)
        .put(`/api/exam/${examId}/toggle-public`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .expect(403);
    });
  });

  describe('DELETE /api/exam/:examId', () => {
    let examId;

    beforeEach(async () => {
      const exam = await request(app)
        .post('/api/exam/create')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Test Exam',
          subject: 'Math',
          instructions: 'Test'
        });
      
      examId = exam.body.exam._id;
    });

    test('deletes exam successfully', async () => {
      const response = await request(app)
        .delete(`/api/exam/${examId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Exam deleted successfully');

      // Verify exam is deleted
      const listResponse = await request(app)
        .get('/api/exam/list')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(listResponse.body.items.length).toBe(0);
    });

    test('rejects unauthorized teacher', async () => {
      await request(app)
        .delete(`/api/exam/${examId}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .expect(403);
    });

    test('returns 404 for non-existent exam', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      await request(app)
        .delete(`/api/exam/${fakeId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });
  });
});
