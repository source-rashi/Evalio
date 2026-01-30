/**
 * Integration Tests for Submission Endpoints
 * 
 * Tests student submission creation and retrieval
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');

describe('Submission Integration Tests', () => {
  let studentToken;
  let studentId;
  let teacherToken;
  let examId;
  let questionIds = [];

  // Setup: Create teacher, exam, questions, and student
  beforeEach(async () => {
    // Create teacher
    const teacher = await request(app)
      .post('/api/teacher/signup')
      .send({
        name: 'Teacher',
        email: 'teacher@test.com',
        password: 'Pass123!'
      });

    const teacherLogin = await request(app)
      .post('/api/teacher/login')
      .send({
        email: 'teacher@test.com',
        password: 'Pass123!'
      });

    teacherToken = teacherLogin.body.token;

    // Create exam
    const exam = await request(app)
      .post('/api/exam/create')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Test Exam',
        subject: 'Math',
        instructions: 'Answer all questions',
        duration: 60
      });

    examId = exam.body.exam._id;

    // Add questions
    const q1 = await request(app)
      .post(`/api/exam/${examId}/question/add`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        text: 'What is 2+2?',
        modelAnswer: 'The answer is 4',
        marks: 2,
        keypoints: [{ text: '4', weight: 1 }]
      });

    const q2 = await request(app)
      .post(`/api/exam/${examId}/question/add`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        text: 'What is 5*5?',
        modelAnswer: 'The answer is 25',
        marks: 3,
        keypoints: [{ text: '25', weight: 1 }]
      });

    questionIds = [q1.body.question._id, q2.body.question._id];

    // Make exam public
    await request(app)
      .put(`/api/exam/${examId}/toggle-public`)
      .set('Authorization', `Bearer ${teacherToken}`);

    // Create student
    const student = await request(app)
      .post('/api/student/signup')
      .send({
        name: 'Student',
        email: 'student@test.com',
        password: 'Pass123!',
        rollNumber: 'STU001'
      });

    studentId = student.body.student._id;

    const studentLogin = await request(app)
      .post('/api/student/login')
      .send({
        email: 'student@test.com',
        password: 'Pass123!'
      });

    studentToken = studentLogin.body.token;
  });

  describe('POST /api/submission/create', () => {
    test('creates submission with answers', async () => {
      const submissionData = {
        exam_id: examId,
        answers: [
          {
            question_id: questionIds[0],
            answer_text: 'The answer is 4'
          },
          {
            question_id: questionIds[1],
            answer_text: 'The answer is 25'
          }
        ]
      };

      const response = await request(app)
        .post('/api/submission/create')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(submissionData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Submission created successfully');
      expect(response.body).toHaveProperty('submission');
      expect(response.body.submission).toHaveProperty('student_id', studentId);
      expect(response.body.submission).toHaveProperty('exam_id', examId);
      expect(response.body.submission).toHaveProperty('status', 'submitted');
      expect(response.body.submission.answers).toHaveLength(2);
    });

    test('requires authentication', async () => {
      const submissionData = {
        exam_id: examId,
        answers: [
          {
            question_id: questionIds[0],
            answer_text: 'Answer'
          }
        ]
      };

      await request(app)
        .post('/api/submission/create')
        .send(submissionData)
        .expect(401);
    });

    test('validates required fields', async () => {
      const response = await request(app)
        .post('/api/submission/create')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ exam_id: examId })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    test('prevents duplicate submission for same exam', async () => {
      const submissionData = {
        exam_id: examId,
        answers: [
          {
            question_id: questionIds[0],
            answer_text: 'Answer'
          }
        ]
      };

      // First submission
      await request(app)
        .post('/api/submission/create')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(submissionData)
        .expect(201);

      // Duplicate submission
      const response = await request(app)
        .post('/api/submission/create')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(submissionData)
        .expect(409);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('already submitted');
    });

    test('rejects submission for private exam', async () => {
      // Make exam private
      await request(app)
        .put(`/api/exam/${examId}/toggle-public`)
        .set('Authorization', `Bearer ${teacherToken}`);

      const submissionData = {
        exam_id: examId,
        answers: [
          {
            question_id: questionIds[0],
            answer_text: 'Answer'
          }
        ]
      };

      const response = await request(app)
        .post('/api/submission/create')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(submissionData)
        .expect(403);

      expect(response.body.message).toContain('not available');
    });
  });

  describe('GET /api/submission/student/:studentId', () => {
    beforeEach(async () => {
      // Create a submission
      await request(app)
        .post('/api/submission/create')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          exam_id: examId,
          answers: [
            {
              question_id: questionIds[0],
              answer_text: 'Answer'
            }
          ]
        });
    });

    test('returns paginated student submissions', async () => {
      const response = await request(app)
        .get(`/api/submission/student/${studentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.items.length).toBe(1);
      expect(response.body.items[0]).toHaveProperty('exam_id', examId);
      expect(response.body.items[0]).toHaveProperty('status', 'submitted');
    });

    test('respects pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/submission/student/${studentId}?page=1&limit=10`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
    });

    test('requires authentication', async () => {
      await request(app)
        .get(`/api/submission/student/${studentId}`)
        .expect(401);
    });

    test('student can only view own submissions', async () => {
      // Create another student
      const otherStudent = await request(app)
        .post('/api/student/signup')
        .send({
          name: 'Other Student',
          email: 'other@test.com',
          password: 'Pass123!',
          rollNumber: 'STU002'
        });

      const otherLogin = await request(app)
        .post('/api/student/login')
        .send({
          email: 'other@test.com',
          password: 'Pass123!'
        });

      const otherToken = otherLogin.body.token;

      // Try to access first student's submissions
      const response = await request(app)
        .get(`/api/submission/student/${studentId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.message).toContain('access');
    });
  });

  describe('GET /api/submission/:submissionId', () => {
    let submissionId;

    beforeEach(async () => {
      const submission = await request(app)
        .post('/api/submission/create')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          exam_id: examId,
          answers: [
            {
              question_id: questionIds[0],
              answer_text: 'My answer to question 1'
            },
            {
              question_id: questionIds[1],
              answer_text: 'My answer to question 2'
            }
          ]
        });

      submissionId = submission.body.submission._id;
    });

    test('returns submission details', async () => {
      const response = await request(app)
        .get(`/api/submission/${submissionId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('submission');
      expect(response.body.submission).toHaveProperty('_id', submissionId);
      expect(response.body.submission).toHaveProperty('student_id', studentId);
      expect(response.body.submission.answers).toHaveLength(2);
      expect(response.body.submission.answers[0]).toHaveProperty('answer_text');
    });

    test('requires authentication', async () => {
      await request(app)
        .get(`/api/submission/${submissionId}`)
        .expect(401);
    });

    test('returns 404 for non-existent submission', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .get(`/api/submission/${fakeId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(404);
    });
  });
});
