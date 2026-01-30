/**
 * Unit Tests for ML Result Validator
 * 
 * Tests contract enforcement and business logic validation for ML output
 */

const { 
  validateAndSanitize, 
  safeValidate,
  MLResultValidationError 
} = require('../../src/validators/mlResultValidator');

describe('ML Result Validator', () => {
  // Valid ML result fixture that matches the contract
  const validMLResult = {
    results: [
      {
        questionId: '507f1f77bcf86cd799439011',
        aiScore: 4,
        maxScore: 5,
        aiFeedback: 'Good answer',
        confidence: 0.85,
        matchedKeypoints: ['chlorophyll', 'photosynthesis'],
        missingKeypoints: ['light reaction']
      },
      {
        questionId: '507f1f77bcf86cd799439012',
        aiScore: 3,
        maxScore: 5,
        aiFeedback: 'Needs improvement',
        confidence: 0.75,
        matchedKeypoints: ['mitosis'],
        missingKeypoints: ['prophase', 'metaphase']
      }
    ],
    aiTotalScore: 7,
    maxTotalScore: 10,
    averageConfidence: 0.8,
    method: 'gemini-ai',
    evaluatedAt: new Date().toISOString(),
    systemMetadata: {
      mlVersion: '1.0.0',
      processingTimeMs: 1500
    }
  };

  describe('validateAndSanitize', () => {
    test('accepts valid ML result', () => {
      expect(() => validateAndSanitize(validMLResult)).not.toThrow();
      
      const result = validateAndSanitize(validMLResult);
      expect(result).toBeDefined();
      expect(result.results).toHaveLength(2);
    });

    test('rejects null or undefined input', () => {
      expect(() => validateAndSanitize(null)).toThrow();
      expect(() => validateAndSanitize(undefined)).toThrow();
    });

    test('rejects result without results array', () => {
      const invalid = { ...validMLResult, results: undefined };
      
      expect(() => validateAndSanitize(invalid)).toThrow(MLResultValidationError);
    });

    test('rejects empty results array', () => {
      const invalid = { ...validMLResult, results: [] };
      
      expect(() => validateAndSanitize(invalid)).toThrow(MLResultValidationError);
    });

    test('rejects result with missing required fields', () => {
      const invalid = {
        results: validMLResult.results
        // Missing aiTotalScore, maxTotalScore, etc.
      };
      
      expect(() => validateAndSanitize(invalid)).toThrow(MLResultValidationError);
    });

    test('rejects negative scores', () => {
      const invalid = {
        ...validMLResult,
        results: [
          { ...validMLResult.results[0], aiScore: -1 }
        ]
      };
      
      expect(() => validateAndSanitize(invalid)).toThrow(MLResultValidationError);
    });

    test('rejects score exceeding maxScore', () => {
      const invalid = {
        ...validMLResult,
        results: [
          { ...validMLResult.results[0], aiScore: 10, maxScore: 5 }
        ]
      };
      
      expect(() => validateAndSanitize(invalid)).toThrow(MLResultValidationError);
    });

    test('rejects invalid confidence range', () => {
      const invalid1 = {
        ...validMLResult,
        results: [
          { ...validMLResult.results[0], confidence: 1.5 }
        ]
      };
      
      const invalid2 = {
        ...validMLResult,
        results: [
          { ...validMLResult.results[0], confidence: -0.1 }
        ]
      };
      
      expect(() => validateAndSanitize(invalid1)).toThrow(MLResultValidationError);
      expect(() => validateAndSanitize(invalid2)).toThrow(MLResultValidationError);
    });

    test('validates question count matches expectation', () => {
      const context = { expectedQuestionCount: 3 };
      
      expect(() => validateAndSanitize(validMLResult, context))
        .toThrow(MLResultValidationError);
    });

    test('validates expected question IDs are present', () => {
      const context = {
        expectedQuestionIds: [
          '507f1f77bcf86cd799439011',
          '507f1f77bcf86cd799439999' // Not in results
        ]
      };
      
      expect(() => validateAndSanitize(validMLResult, context))
        .toThrow(MLResultValidationError);
    });

    test('validates total score matches sum of individual scores', () => {
      const invalid = {
        ...validMLResult,
        aiTotalScore: 100 // Should be 7
      };
      
      expect(() => validateAndSanitize(invalid)).toThrow(MLResultValidationError);
    });

    test('allows small floating point differences in totals', () => {
      const almostValid = {
        ...validMLResult,
        aiTotalScore: 7.009 // Within tolerance
      };
      
      expect(() => validateAndSanitize(almostValid)).not.toThrow();
    });
  });

  describe('safeValidate', () => {
    test('returns success with valid result', () => {
      const result = safeValidate(validMLResult);
      
      expect(result.valid).toBe(true);
      expect(result.sanitizedResult).toBeDefined();
      expect(result.errors).toEqual([]);
    });

    test('returns error without throwing for invalid result', () => {
      const invalid = { results: [] };
      const result = safeValidate(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.sanitizedResult).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('returns error details for validation failures', () => {
      const invalid = {
        ...validMLResult,
        results: [
          { ...validMLResult.results[0], aiScore: -5 }
        ]
      };
      
      const result = safeValidate(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('does not throw exceptions', () => {
      const invalid = null;
      
      expect(() => safeValidate(invalid)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('handles zero scores correctly', () => {
      const zeroScore = {
        ...validMLResult,
        results: [
          { ...validMLResult.results[0], aiScore: 0 },
          { ...validMLResult.results[1], aiScore: 0 }
        ],
        aiTotalScore: 0,
        maxTotalScore: 10
      };
      
      expect(() => validateAndSanitize(zeroScore)).not.toThrow();
    });

    test('handles maximum scores correctly', () => {
      const maxScore = {
        ...validMLResult,
        results: [
          { ...validMLResult.results[0], aiScore: 5, maxScore: 5 },
          { ...validMLResult.results[1], aiScore: 5, maxScore: 5 }
        ],
        aiTotalScore: 10,
        maxTotalScore: 10,
        averageConfidence: 0.8
      };
      
      expect(() => validateAndSanitize(maxScore)).not.toThrow();
    });

    test('handles missing optional fields', () => {
      const minimal = {
        results: validMLResult.results,
        aiTotalScore: 7,
        maxTotalScore: 10,
        averageConfidence: 0.8,
        method: 'gemini-ai',
        evaluatedAt: new Date()
        // Missing systemMetadata (which is optional)
      };
      
      expect(() => validateAndSanitize(minimal)).not.toThrow();
    });
  });
});
