/**
 * Unit Tests for Scoring Utility
 * 
 * Tests the heuristic scoring algorithm used as fallback when ML is unavailable
 */

const { scoreAnswer } = require('../../src/utils/scoring');

describe('Scoring Utility', () => {
  describe('scoreAnswer', () => {
    test('returns 0 score when model answer is empty', () => {
      const result = scoreAnswer('', 'student answer here', 5);
      
      expect(result.score).toBe(0);
      expect(result.feedback).toBe('No model answer provided');
    });

    test('returns 0 score when model answer is null/undefined', () => {
      const result1 = scoreAnswer(null, 'student answer', 5);
      const result2 = scoreAnswer(undefined, 'student answer', 5);
      
      expect(result1.score).toBe(0);
      expect(result2.score).toBe(0);
    });

    test('handles empty student answer', () => {
      const result = scoreAnswer('photosynthesis chlorophyll', '', 5);
      
      expect(result.score).toBe(0);
      expect(result.feedback).toBe('Needs more key points from the model answer');
    });

    test('gives higher score for exact keyword matches', () => {
      const modelAnswer = 'photosynthesis chlorophyll light energy';
      const goodAnswer = 'Photosynthesis uses chlorophyll to capture light energy';
      const poorAnswer = 'Plants are green and grow in sunlight';
      
      const goodResult = scoreAnswer(modelAnswer, goodAnswer, 5);
      const poorResult = scoreAnswer(modelAnswer, poorAnswer, 5);
      
      expect(goodResult.score).toBeGreaterThan(poorResult.score);
    });

    test('is case-insensitive', () => {
      const modelAnswer = 'PHOTOSYNTHESIS CHLOROPHYLL';
      const studentAnswer = 'photosynthesis chlorophyll';
      
      const result1 = scoreAnswer(modelAnswer.toUpperCase(), studentAnswer.toLowerCase(), 5);
      const result2 = scoreAnswer(modelAnswer.toLowerCase(), studentAnswer.toUpperCase(), 5);
      
      expect(result1.score).toBe(result2.score);
    });

    test('ignores punctuation and special characters', () => {
      const modelAnswer = 'photosynthesis, chlorophyll!';
      const studentAnswer = 'photosynthesis chlorophyll';
      
      const result = scoreAnswer(modelAnswer, studentAnswer, 5);
      
      expect(result.score).toBeGreaterThan(0);
    });

    test('respects max score parameter', () => {
      const modelAnswer = 'photosynthesis chlorophyll light';
      const perfectAnswer = 'photosynthesis chlorophyll light';
      
      const result10 = scoreAnswer(modelAnswer, perfectAnswer, 10);
      const result20 = scoreAnswer(modelAnswer, perfectAnswer, 20);
      
      expect(result10.score).toBeLessThanOrEqual(10);
      expect(result20.score).toBeLessThanOrEqual(20);
      expect(result20.score).toBeGreaterThan(result10.score);
    });

    test('provides appropriate feedback based on score', () => {
      const modelAnswer = 'photosynthesis chlorophyll light energy carbon dioxide';
      const goodAnswer = 'photosynthesis uses chlorophyll and light energy';
      const poorAnswer = 'plants make food';
      
      const goodResult = scoreAnswer(modelAnswer, goodAnswer, 10);
      const poorResult = scoreAnswer(modelAnswer, poorAnswer, 10);
      
      expect(goodResult.feedback).toContain('Good coverage');
      expect(poorResult.feedback).toContain('Needs more');
    });

    test('handles multiple spaces in input', () => {
      const modelAnswer = 'photosynthesis    chlorophyll';
      const studentAnswer = 'photosynthesis   chlorophyll';
      
      const result = scoreAnswer(modelAnswer, studentAnswer, 5);
      
      expect(result.score).toBeGreaterThan(0);
    });

    test('returns deterministic results for same input', () => {
      const modelAnswer = 'photosynthesis chlorophyll';
      const studentAnswer = 'photosynthesis uses chlorophyll';
      
      const result1 = scoreAnswer(modelAnswer, studentAnswer, 5);
      const result2 = scoreAnswer(modelAnswer, studentAnswer, 5);
      
      expect(result1.score).toBe(result2.score);
      expect(result1.feedback).toBe(result2.feedback);
    });
  });
});
