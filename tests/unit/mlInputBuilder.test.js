/**
 * Unit Tests for ML Input Builder
 * 
 * Tests the transformation of MongoDB documents into ML-ready input
 */

const { buildMLInput } = require('../../src/services/mlInputBuilder');
const mongoose = require('mongoose');

describe('ML Input Builder', () => {
  // Test fixtures
  const mockSubmission = {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
    student_id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
    exam_id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
    createdAt: new Date('2025-01-01T10:00:00Z'),
    status: 'submitted'
  };

  const mockExam = {
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
    title: 'Biology Midterm',
    subject: 'Biology',
    instructions: 'Answer all questions'
  };

  const mockQuestions = [
    {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
      text: 'Explain photosynthesis',
      modelAnswer: 'Photosynthesis is the process...',
      marks: 5,
      keypoints: [
        { text: 'chlorophyll', weight: 1 },
        { text: 'light energy', weight: 1 }
      ]
    },
    {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439015'),
      text: 'Describe cell division',
      modelAnswer: 'Cell division occurs...',
      marks: 5,
      keypoints: [
        { text: 'mitosis', weight: 1 }
      ]
    }
  ];

  const mockAnswers = [
    {
      question_id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
      answer_text: 'Photosynthesis uses chlorophyll',
      image_url: 'https://cloudinary.com/image1.jpg'
    },
    {
      question_id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439015'),
      answer_text: 'Mitosis is a type of cell division',
      image_url: 'https://cloudinary.com/image2.jpg'
    }
  ];

  describe('buildMLInput', () => {
    test('builds valid ML input from complete data', () => {
      const result = buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: mockQuestions,
        answers: mockAnswers
      });

      expect(result).toHaveProperty('submission');
      expect(result).toHaveProperty('exam');
      expect(result).toHaveProperty('questions');
      expect(result).toHaveProperty('answers');
    });

    test('includes submission metadata correctly', () => {
      const result = buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: mockQuestions,
        answers: mockAnswers
      });

      expect(result.submission._id).toEqual(mockSubmission._id);
      expect(result.submission.student_id).toEqual(mockSubmission.student_id);
      expect(result.submission.exam_id).toEqual(mockSubmission.exam_id);
    });

    test('includes exam metadata correctly', () => {
      const result = buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: mockQuestions,
        answers: mockAnswers
      });

      expect(result.exam._id).toEqual(mockExam._id);
      expect(result.exam.title).toBe('Biology Midterm');
      expect(result.exam.subject).toBe('Biology');
    });

    test('transforms questions with all required fields', () => {
      const result = buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: mockQuestions,
        answers: mockAnswers
      });

      expect(result.questions).toHaveLength(2);
      
      const q1 = result.questions[0];
      expect(q1).toHaveProperty('_id');
      expect(q1).toHaveProperty('questionText');
      expect(q1).toHaveProperty('modelAnswer');
      expect(q1).toHaveProperty('maxScore');
      expect(q1).toHaveProperty('rubric');
    });

    test('transforms answers with student responses', () => {
      const result = buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: mockQuestions,
        answers: mockAnswers
      });

      expect(result.answers).toHaveLength(2);
      
      const a1 = result.answers[0];
      expect(a1).toHaveProperty('questionId');
      expect(a1).toHaveProperty('studentAnswer');
      expect(a1.studentAnswer).toBe('Photosynthesis uses chlorophyll');
    });

    test('throws error when submission is missing', () => {
      expect(() => buildMLInput({
        submission: null,
        exam: mockExam,
        questions: mockQuestions,
        answers: mockAnswers
      })).toThrow('submission is required');
    });

    test('throws error when exam is missing', () => {
      expect(() => buildMLInput({
        submission: mockSubmission,
        exam: null,
        questions: mockQuestions,
        answers: mockAnswers
      })).toThrow('exam is required');
    });

    test('throws error when questions is empty array', () => {
      expect(() => buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: [],
        answers: mockAnswers
      })).toThrow('questions must be a non-empty array');
    });

    test('throws error when questions is not an array', () => {
      expect(() => buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: null,
        answers: mockAnswers
      })).toThrow('questions must be a non-empty array');
    });

    test('throws error when answers is not an array', () => {
      expect(() => buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: mockQuestions,
        answers: 'invalid'
      })).toThrow('answers must be an array');
    });

    test('handles empty answers array', () => {
      const result = buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: mockQuestions,
        answers: []
      });

      expect(result.answers).toEqual([]);
    });

    test('handles exam without subject', () => {
      const examNoSubject = { ...mockExam, subject: undefined };
      
      const result = buildMLInput({
        submission: mockSubmission,
        exam: examNoSubject,
        questions: mockQuestions,
        answers: mockAnswers
      });

      expect(result.exam.subject).toBeNull();
    });

    test('handles questions without keypoints', () => {
      const questionsNoKeypoints = [{
        ...mockQuestions[0],
        keypoints: undefined
      }];
      
      const result = buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: questionsNoKeypoints,
        answers: mockAnswers
      });

      expect(result.questions[0].rubric).toEqual([]);
    });

    test('produces deterministic output for same input', () => {
      const result1 = buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: mockQuestions,
        answers: mockAnswers
      });

      const result2 = buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: mockQuestions,
        answers: mockAnswers
      });

      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    test('does not mutate input objects', () => {
      const originalSubmission = { ...mockSubmission };
      const originalExam = { ...mockExam };
      
      buildMLInput({
        submission: mockSubmission,
        exam: mockExam,
        questions: mockQuestions,
        answers: mockAnswers
      });

      expect(mockSubmission).toEqual(originalSubmission);
      expect(mockExam).toEqual(originalExam);
    });
  });
});
