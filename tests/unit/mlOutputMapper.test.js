/**
 * Unit Tests for ML Output Mapper
 * 
 * Tests transformation of ML results into Evaluation model format
 */

const { mapMLResultToEvaluation } = require('../../src/services/mlOutputMapper');
const { EVALUATION_STATUS } = require('../../src/constants/evaluationStatus');
const mongoose = require('mongoose');

describe('ML Output Mapper', () => {
  const submissionId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const questionIds = [
    new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
    new mongoose.Types.ObjectId('507f1f77bcf86cd799439015')
  ];

  const validMLResult = {
    results: [
      {
        questionId: questionIds[0].toString(),
        aiScore: 4,
        maxScore: 5,
        aiFeedback: 'Good understanding of photosynthesis',
        confidence: 0.85,
        matchedKeypoints: ['chlorophyll', 'light energy'],
        missingKeypoints: ['calvin cycle']
      },
      {
        questionId: questionIds[1].toString(),
        aiScore: 3,
        maxScore: 5,
        aiFeedback: 'Needs more detail on cell division',
        confidence: 0.75,
        matchedKeypoints: ['mitosis'],
        missingKeypoints: ['prophase', 'metaphase']
      }
    ],
    aiTotalScore: 7,
    maxTotalScore: 10,
    averageConfidence: 0.8,
    method: 'gemini-ai',
    evaluatedAt: new Date().toISOString()
  };

  const context = {
    submissionId: submissionId.toString(),
    expectedQuestionCount: 2,
    expectedQuestionIds: questionIds.map(id => id.toString())
  };

  describe('mapMLResultToEvaluation', () => {
    test('transforms ML result to Evaluation schema format', () => {
      const result = mapMLResultToEvaluation(validMLResult, context);

      expect(result).toHaveProperty('submission_id', submissionId.toString());
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('aiTotalScore', 7);
      expect(result).toHaveProperty('totalScore', 7);
      expect(result).toHaveProperty('averageConfidence', 0.8);
      expect(result).toHaveProperty('status', EVALUATION_STATUS.AI_EVALUATED);
    });

    test('maps results array correctly', () => {
      const result = mapMLResultToEvaluation(validMLResult, context);

      expect(result.results).toHaveLength(2);
      
      const firstResult = result.results[0];
      expect(firstResult.questionId).toBe(questionIds[0].toString());
      expect(firstResult.aiScore).toBe(4);
      expect(firstResult.finalScore).toBe(4); // Initially same as aiScore
      expect(firstResult.maxScore).toBe(5);
      expect(firstResult.aiFeedback).toBe('Good understanding of photosynthesis');
      expect(firstResult.feedback).toBe('Good understanding of photosynthesis'); // Initially same
      expect(firstResult.confidence).toBe(0.85);
      expect(firstResult.isOverridden).toBe(false);
    });

    test('sets finalScore equal to aiScore initially', () => {
      const result = mapMLResultToEvaluation(validMLResult, context);

      result.results.forEach((r, idx) => {
        expect(r.finalScore).toBe(r.aiScore);
        expect(r.finalScore).toBe(validMLResult.results[idx].aiScore);
      });
    });

    test('sets totalScore equal to aiTotalScore initially', () => {
      const result = mapMLResultToEvaluation(validMLResult, context);

      expect(result.totalScore).toBe(result.aiTotalScore);
      expect(result.totalScore).toBe(7);
    });

    test('preserves AI metadata', () => {
      const result = mapMLResultToEvaluation(validMLResult, context);

      expect(result.averageConfidence).toBe(0.8);
      expect(result.status).toBe(EVALUATION_STATUS.AI_EVALUATED);
    });

    test('marks evaluation as not overridden initially', () => {
      const result = mapMLResultToEvaluation(validMLResult, context);

      result.results.forEach(r => {
        expect(r.isOverridden).toBe(false);
      });
    });

    test('includes submission_id from context', () => {
      const result = mapMLResultToEvaluation(validMLResult, context);

      expect(result.submission_id).toBe(context.submissionId);
    });

    test('throws error for invalid ML result', () => {
      const invalidResult = { ...validMLResult, results: [] }; // Empty results

      expect(() => {
        mapMLResultToEvaluation(invalidResult, context);
      }).toThrow();
    });

    test('throws error for mismatched question count', () => {
      const mismatchContext = {
        ...context,
        expectedQuestionCount: 3 // Expects 3 but ML result has 2
      };

      expect(() => {
        mapMLResultToEvaluation(validMLResult, mismatchContext);
      }).toThrow();
    });

    test('throws error for missing expected question IDs', () => {
      const wrongQuestionId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439099');
      const mismatchContext = {
        ...context,
        expectedQuestionIds: [wrongQuestionId.toString(), questionIds[1].toString()]
      };

      expect(() => {
        mapMLResultToEvaluation(validMLResult, mismatchContext);
      }).toThrow();
    });

    test('preserves feedback strings correctly', () => {
      const result = mapMLResultToEvaluation(validMLResult, context);

      expect(result.results[0].aiFeedback).toBe('Good understanding of photosynthesis');
      expect(result.results[0].feedback).toBe('Good understanding of photosynthesis');
      expect(result.results[1].aiFeedback).toBe('Needs more detail on cell division');
      expect(result.results[1].feedback).toBe('Needs more detail on cell division');
    });

    test('handles zero scores correctly', () => {
      const zeroScoreResult = {
        ...validMLResult,
        results: [
          { ...validMLResult.results[0], aiScore: 0 },
          { ...validMLResult.results[1], aiScore: 0 }
        ],
        aiTotalScore: 0
      };

      const result = mapMLResultToEvaluation(zeroScoreResult, context);

      expect(result.aiTotalScore).toBe(0);
      expect(result.totalScore).toBe(0);
      result.results.forEach(r => {
        expect(r.aiScore).toBe(0);
        expect(r.finalScore).toBe(0);
      });
    });

    test('handles perfect scores correctly', () => {
      const perfectScoreResult = {
        ...validMLResult,
        results: [
          { ...validMLResult.results[0], aiScore: 5, maxScore: 5 },
          { ...validMLResult.results[1], aiScore: 5, maxScore: 5 }
        ],
        aiTotalScore: 10,
        maxTotalScore: 10
      };

      const result = mapMLResultToEvaluation(perfectScoreResult, context);

      expect(result.aiTotalScore).toBe(10);
      expect(result.totalScore).toBe(10);
      result.results.forEach(r => {
        expect(r.aiScore).toBe(5);
        expect(r.finalScore).toBe(5);
        expect(r.maxScore).toBe(5);
      });
    });

    test('produces consistent output for same input', () => {
      const result1 = mapMLResultToEvaluation(validMLResult, context);
      const result2 = mapMLResultToEvaluation(validMLResult, context);

      expect(result1.aiTotalScore).toBe(result2.aiTotalScore);
      expect(result1.totalScore).toBe(result2.totalScore);
      expect(result1.results.length).toBe(result2.results.length);
      expect(result1.status).toBe(result2.status);
    });

    test('does not mutate input ML result', () => {
      const originalResult = JSON.parse(JSON.stringify(validMLResult));
      const testMLResult = JSON.parse(JSON.stringify(validMLResult));
      
      mapMLResultToEvaluation(testMLResult, context);

      // Compare structure, not Date objects
      expect(testMLResult.aiTotalScore).toBe(originalResult.aiTotalScore);
      expect(testMLResult.results.length).toBe(originalResult.results.length);
      expect(testMLResult.results[0].aiScore).toBe(originalResult.results[0].aiScore);
    });

    test('does not mutate input context', () => {
      const originalContext = JSON.parse(JSON.stringify(context));
      
      mapMLResultToEvaluation(validMLResult, context);

      expect(context).toEqual(originalContext);
    });
  });
});
