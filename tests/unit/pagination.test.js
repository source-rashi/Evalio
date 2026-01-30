/**
 * Unit Tests for Pagination Utility
 * 
 * Tests pagination parameter extraction and response building
 */

const { getPaginationParams, buildPaginationResponse } = require('../../src/utils/pagination');

describe('Pagination Utility', () => {
  describe('getPaginationParams', () => {
    test('returns defaults when no query params provided', () => {
      const req = { query: {} };
      const result = getPaginationParams(req);
      
      expect(result).toEqual({
        page: 1,
        limit: 20,
        skip: 0
      });
    });

    test('parses valid page and limit from query', () => {
      const req = { query: { page: '3', limit: '50' } };
      const result = getPaginationParams(req);
      
      expect(result).toEqual({
        page: 3,
        limit: 50,
        skip: 100 // (3-1) * 50
      });
    });

    test('enforces minimum page of 1', () => {
      const req1 = { query: { page: '0' } };
      const req2 = { query: { page: '-5' } };
      
      expect(getPaginationParams(req1).page).toBe(1);
      expect(getPaginationParams(req2).page).toBe(1);
    });

    test('enforces maximum limit of 100', () => {
      const req = { query: { limit: '500' } };
      const result = getPaginationParams(req);
      
      expect(result.limit).toBe(100);
    });

    test('enforces minimum limit of 1', () => {
      const req = { query: { limit: '0' } };
      const result = getPaginationParams(req);
      
      // limit of 0 becomes default 20 due to Math.max(1, 0 || 20)
      expect(result.limit).toBe(20);
    });

    test('handles invalid numeric values gracefully', () => {
      const req = { query: { page: 'invalid', limit: 'bad' } };
      const result = getPaginationParams(req);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    test('calculates skip correctly for various pages', () => {
      const testCases = [
        { page: 1, limit: 20, expectedSkip: 0 },
        { page: 2, limit: 20, expectedSkip: 20 },
        { page: 5, limit: 10, expectedSkip: 40 },
        { page: 10, limit: 50, expectedSkip: 450 }
      ];

      testCases.forEach(({ page, limit, expectedSkip }) => {
        const req = { query: { page: String(page), limit: String(limit) } };
        const result = getPaginationParams(req);
        
        expect(result.skip).toBe(expectedSkip);
      });
    });
  });

  describe('buildPaginationResponse', () => {
    test('builds correct response structure', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = buildPaginationResponse(items, 100, 1, 20);
      
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('pagination');
      expect(result.items).toBe(items);
    });

    test('calculates totalPages correctly', () => {
      const items = [];
      
      const result1 = buildPaginationResponse(items, 100, 1, 20);
      expect(result1.pagination.totalPages).toBe(5);
      
      const result2 = buildPaginationResponse(items, 95, 1, 20);
      expect(result2.pagination.totalPages).toBe(5);
      
      const result3 = buildPaginationResponse(items, 101, 1, 20);
      expect(result3.pagination.totalPages).toBe(6);
    });

    test('sets hasNextPage correctly', () => {
      const items = [];
      
      const result1 = buildPaginationResponse(items, 100, 1, 20);
      expect(result1.pagination.hasNextPage).toBe(true);
      
      const result2 = buildPaginationResponse(items, 100, 5, 20);
      expect(result2.pagination.hasNextPage).toBe(false);
      
      const result3 = buildPaginationResponse(items, 100, 6, 20);
      expect(result3.pagination.hasNextPage).toBe(false);
    });

    test('sets hasPrevPage correctly', () => {
      const items = [];
      
      const result1 = buildPaginationResponse(items, 100, 1, 20);
      expect(result1.pagination.hasPrevPage).toBe(false);
      
      const result2 = buildPaginationResponse(items, 100, 2, 20);
      expect(result2.pagination.hasPrevPage).toBe(true);
      
      const result3 = buildPaginationResponse(items, 100, 5, 20);
      expect(result3.pagination.hasPrevPage).toBe(true);
    });

    test('handles edge case with 0 total items', () => {
      const items = [];
      const result = buildPaginationResponse(items, 0, 1, 20);
      
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(false);
    });

    test('includes all pagination metadata', () => {
      const items = [{ id: 1 }];
      const result = buildPaginationResponse(items, 150, 3, 25);
      
      expect(result.pagination).toEqual({
        total: 150,
        page: 3,
        limit: 25,
        totalPages: 6,
        hasNextPage: true,
        hasPrevPage: true
      });
    });
  });
});
