const { scoreAnswer } = require('../src/utils/scoring');

describe('scoreAnswer', () => {
  test('returns 0 when no model answer', () => {
    const r = scoreAnswer('', 'student', 5);
    expect(r.score).toBe(0);
  });

  test('gives higher score for overlaps', () => {
    const r1 = scoreAnswer('photosynthesis chlorophyll light', 'random words', 5);
    const r2 = scoreAnswer('photosynthesis chlorophyll light', 'The process of photosynthesis uses light', 5);
    expect(r2.score).toBeGreaterThanOrEqual(r1.score);
  });
});
