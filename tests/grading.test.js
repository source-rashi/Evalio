const { gradeAnswer } = require('../src/services/grading');

describe('gradeAnswer fallback', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...OLD_ENV, AI_PROVIDER: 'none' }; });
  afterAll(() => { process.env = OLD_ENV; });

  test('uses heuristic when provider is none', async () => {
    const res = await gradeAnswer({ modelAnswer: 'gravity force apple', studentAnswer: 'apple falls due to gravity', maxScore: 5 });
    expect(res.provider).toBe('heuristic');
    expect(res.score).toBeGreaterThanOrEqual(1);
  });
});
