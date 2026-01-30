/**
 * Jest Test Setup File
 * Runs before each test suite to configure the test environment
 */

const mongoose = require('mongoose');

// Prevent tests from touching production database
process.env.NODE_ENV = 'test';

// Use in-memory MongoDB or separate test database
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/evalio_test';

// Disable external services in tests
process.env.CLOUDINARY_URL = 'test://cloudinary';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_SECRET = 'test_jwt_secret_key_2025';

// Suppress console logs during tests (optional)
if (process.env.SUPPRESS_TEST_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

// Global test helpers
global.testHelpers = {
  /**
   * Wait for a condition with timeout
   */
  waitFor: async (conditionFn, timeout = 5000, interval = 100) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await conditionFn()) return true;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Timeout waiting for condition');
  },
  
  /**
   * Generate test ObjectId
   */
  generateObjectId: () => {
    return new mongoose.Types.ObjectId();
  }
};

// Setup hooks
beforeAll(async () => {
  // Connect to test database before running tests
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
});

afterAll(async () => {
  // Clean up and close database connection after all tests
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// Clean up between test files
afterEach(async () => {
  // Clear all collections between tests to ensure isolation
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});
