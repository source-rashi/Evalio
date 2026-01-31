/**
 * Integration Tests for Evaluation Endpoints
 * 
 * Tests the complete evaluation lifecycle including:
 * - Triggering evaluations
 * - Retrieving evaluation results
 * - Manual override flow
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Teacher = require('../../src/models/Teacher');
const Student = require('../../src/models/Student');
const Exam = require('../../src/models/Exam');
const Question = require('../../src/models/Question');
const Submission = require('../../src/models/Submission');
const Evaluation = require('../../src/models/Evaluation');
const ManualOverride = require('../../src/models/ManualOverride');

describe('Evaluation Integration Tests', () => {
  let teacherToken;
  let teacherId;
  let studentId;
  let examId;
  let questionIds;
  let submissionId;

  beforeEach(async () => {
    // Create teacher
    const teacherRes = await request(app)
      .post('/api/teacher/signup')
      .send({
        name: 'Dr. Smith',
        email: 'teacher@eval.test',
        password: 'TeacherPass123!'
      });
    teacherId = teacherRes.body.teacher._id;

    // Login teacher
    const loginRes = await request(app)
      .post('/api/teacher/login')
      .send({
        email: 'teacher@eval.test',
        password: 'TeacherPass123!'
      });
    teacherToken = loginRes.body.token;

    // Create student
    const studentRes = await request(app)
      .post('/api/student/signup')
      .send({
        name: 'John Doe',
        email: 'student@eval.test',
        rollNumber: 'EVAL001',
        password: 'StudentPass123!'
      });
    studentId = studentRes.body.student._id;

    // Create exam
    const examRes = await request(app)
      .post('/api/exam/create')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Biology Test',
        subject: 'Biology',
        isPublic: true
      });
    examId = examRes.body.exam._id;

    // Add questions
    const q1Res = await request(app)
      .post(`/api/exam/${examId}/question/add`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        text: 'Explain photosynthesis',
        modelAnswer: 'Photosynthesis uses chlorophyll to convert light energy into chemical energy',
        marks: 5,
        keypoints: [
          { text: 'chlorophyll', weight: 1 },
          { text: 'light energy', weight: 1 }
        ]
      });

    const q2Res = await request(app)
      .post(`/api/exam/${examId}/question/add`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        text: 'Describe cell division',
        modelAnswer: 'Cell division occurs through mitosis',
        marks: 5,
        keypoints: [{ text: 'mitosis', weight: 1 }]
      });

    questionIds = [q1Res.body.question._id, q2Res.body.question._id];

    // Create submission
    const submissionRes = await request(app)
      .post('/api/submission/create')
      .send({
        student_id: studentId,
        exam_id: examId,
        answers: [
          {
            questionId: questionIds[0],
            answerImage: 'data:image/png;base64,mockImageData1',
            extractedText: 'Plants use chlorophyll for photosynthesis'
          },
          {
            questionId: questionIds[1],
            answerImage: 'data:image/png;base64,mockImageData2',
            extractedText: 'Cells divide through mitosis'
          }
        ]
      });
    submissionId = submissionRes.body.submission._id;

    // Finalize submission
    await request(app)
      .post(`/api/submission/${submissionId}/finalize`)
      .send();
  });

  describe('POST /api/evaluate/:submissionId - Trigger Evaluation', () => {
    test('triggers evaluation for submitted exam', async () => {
      const response = await request(app)
        .post(`/api/evaluate/${submissionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(202);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('queued');
      expect(response.body).toHaveProperty('evaluation');
      expect(response.body.evaluation).toHaveProperty('jobId');
      expect(response.body.evaluation).toHaveProperty('status');
    });

    test('requires teacher authentication', async () => {
      const response = await request(app)
        .post(`/api/evaluate/${submissionId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('rejects evaluation of draft submission', async () => {
      // Create draft submission
      const draftRes = await request(app)
        .post('/api/submission/create')
        .send({
          student_id: studentId,
          exam_id: examId,
          answers: []
        });

      const response = await request(app)
        .post(`/api/evaluate/${draftRes.body.submission._id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Finalize');
    });

    test('prevents duplicate evaluation', async () => {
      // Trigger first evaluation
      await request(app)
        .post(`/api/evaluate/${submissionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(202);

      // Complete the evaluation manually for testing
      await Evaluation.findOneAndUpdate(
        { submission_id: submissionId },
        { status: 'ai_evaluated' }
      );

      // Try to trigger again
      const response = await request(app)
        .post(`/api/evaluate/${submissionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already');
    });

    test('returns 404 for non-existent submission', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/evaluate/${fakeId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/evaluate/:submissionId - Retrieve Evaluation', () => {
    test('returns evaluation results after completion', async () => {
      // Create completed evaluation manually for testing
      const evaluation = await Evaluation.create({
        submission_id: submissionId,
        results: [
          {
            questionId: questionIds[0],
            aiScore: 4,
            finalScore: 4,
            maxScore: 5,
            aiFeedback: 'Good answer',
            feedback: 'Good answer',
            confidence: 0.85,
            isOverridden: false
          },
          {
            questionId: questionIds[1],
            aiScore: 3,
            finalScore: 3,
            maxScore: 5,
            aiFeedback: 'Needs more detail',
            feedback: 'Needs more detail',
            confidence: 0.75,
            isOverridden: false
          }
        ],
        aiTotalScore: 7,
        totalScore: 7,
        averageConfidence: 0.8,
        status: 'ai_evaluated'
      });

      const response = await request(app)
        .get(`/api/evaluate/${submissionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('evaluation');
      expect(response.body.evaluation).toHaveProperty('totalScore', 7);
      expect(response.body.evaluation).toHaveProperty('maxScore', 10);
      expect(response.body.evaluation).toHaveProperty('questionScores');
      expect(response.body.evaluation.questionScores).toHaveLength(2);
    });

    test('returns null when no evaluation exists', async () => {
      const response = await request(app)
        .get(`/api/evaluate/${submissionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('evaluation', null);
    });

    test('includes job tracking information', async () => {
      await Evaluation.create({
        submission_id: submissionId,
        results: [],
        status: 'pending',
        jobId: 'job-123',
        jobStatus: 'processing'
      });

      const response = await request(app)
        .get(`/api/evaluate/${submissionId}`)
        .expect(200);

      expect(response.body.evaluation).toHaveProperty('jobId', 'job-123');
      expect(response.body.evaluation).toHaveProperty('jobStatus', 'processing');
    });

    test('returns 400 for invalid submission ID', async () => {
      const response = await request(app)
        .get('/api/evaluate/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/override/:evaluationId/question/:questionId - Manual Override', () => {
    let evaluationId;

    beforeEach(async () => {
      // Create evaluation
      const evaluation = await Evaluation.create({
        submission_id: submissionId,
        results: [
          {
            questionId: questionIds[0],
            aiScore: 4,
            finalScore: 4,
            maxScore: 5,
            aiFeedback: 'Good answer',
            feedback: 'Good answer',
            confidence: 0.85,
            isOverridden: false
          }
        ],
        aiTotalScore: 4,
        totalScore: 4,
        status: 'ai_evaluated'
      });
      evaluationId = evaluation._id.toString();
    });

    test('allows teacher to override question score', async () => {
      const response = await request(app)
        .post(`/api/override/${evaluationId}/question/${questionIds[0]}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          overriddenScore: 5,
          reason: 'Student showed good understanding',
          overriddenFeedback: 'Excellent work'
        })
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('applied');

      // Verify override was recorded
      const override = await ManualOverride.findOne({ evaluationId });
      expect(override).toBeTruthy();
      expect(override.overriddenScore).toBe(5);
      expect(override.reason).toBe('Student showed good understanding');
    });

    test('requires teacher authentication', async () => {
      const response = await request(app)
        .post(`/api/override/${evaluationId}/question/${questionIds[0]}`)
        .send({
          overriddenScore: 5,
          reason: 'Test'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('validates score is within max score', async () => {
      const response = await request(app)
        .post(`/api/override/${evaluationId}/question/${questionIds[0]}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          overriddenScore: 10, // Max is 5
          reason: 'Test'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('validates reason is provided', async () => {
      const response = await request(app)
        .post(`/api/override/${evaluationId}/question/${questionIds[0]}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          overriddenScore: 5
          // Missing reason
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('returns 404 for non-existent evaluation', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/override/${fakeId}/question/${questionIds[0]}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          overriddenScore: 5,
          reason: 'Test'
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/override/:evaluationId/overrides - List Overrides', () => {
    let evaluationId;

    beforeEach(async () => {
      const evaluation = await Evaluation.create({
        submission_id: submissionId,
        results: [
          {
            questionId: questionIds[0],
            aiScore: 4,
            finalScore: 5,
            maxScore: 5,
            isOverridden: true
          }
        ],
        aiTotalScore: 4,
        totalScore: 5,
        status: 'ai_evaluated'
      });
      evaluationId = evaluation._id.toString();

      // Create override record
      await ManualOverride.create({
        evaluationId,
        questionId: questionIds[0],
        teacherId,
        originalScore: 4,
        overriddenScore: 5,
        maxScore: 5,
        reason: 'Good work',
        originalFeedback: 'Good answer',
        overriddenFeedback: 'Excellent work'
      });
    });

    test('returns list of overrides for evaluation', async () => {
      const response = await request(app)
        .get(`/api/override/${evaluationId}/overrides`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('overrides');
      expect(response.body.overrides).toHaveLength(1);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalOverrides', 1);
    });

    test('requires teacher authentication', async () => {
      const response = await request(app)
        .get(`/api/override/${evaluationId}/overrides`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('returns empty array when no overrides exist', async () => {
      const newEvaluation = await Evaluation.create({
        submission_id: submissionId,
        results: [],
        status: 'ai_evaluated'
      });

      const response = await request(app)
        .get(`/api/override/${newEvaluation._id}/overrides`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body.overrides).toHaveLength(0);
      expect(response.body.stats.totalOverrides).toBe(0);
    });
  });
});
