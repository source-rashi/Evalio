/**
 * Jest Test Setup File
 * Runs before each test suite to configure the test environment
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables FIRST
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Critical safety check: Prevent tests from touching production database
if (process.env.NODE_ENV !== 'test') {
  console.error('❌ CRITICAL: Tests must run with NODE_ENV=test');
  process.exit(1);
}

// Force test environment
process.env.NODE_ENV = 'test';

// Use test database - NEVER production
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/evalio_test';

// Safety check: Ensure we're not using production database
if (TEST_DB_URI.includes('evalio') && !TEST_DB_URI.includes('test')) {
  console.error('❌ CRITICAL: Test database URI must include "test" to prevent production data loss');
  console.error(`Current URI: ${TEST_DB_URI}`);
  process.exit(1);
}

// Configure test-only service mocks
process.env.CLOUDINARY_URL = process.env.CLOUDINARY_URL || 'cloudinary://test:test@test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_2025';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test_gemini_key';
process.env.AI_PROVIDER = 'none';  // Disable AI in tests

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
