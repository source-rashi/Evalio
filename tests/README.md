# Test Infrastructure

## Test Database Configuration

Tests use an **isolated test database** to ensure production data is never touched.

### Default Test Database
- **URI**: `mongodb://localhost:27017/evalio_test`
- **Auto-cleanup**: Database is dropped after all tests complete
- **Isolation**: Collections are cleared between test files

### Custom Test Database

You can specify a custom test database using environment variables:

```bash
TEST_MONGODB_URI=mongodb://localhost:27017/my_test_db npm test
```

### In-Memory Testing (Future)

For faster tests, consider using `mongodb-memory-server`:

```bash
npm install -D mongodb-memory-server
```

Update `tests/setup.js` to use in-memory MongoDB.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/scoring.test.js

# Run with coverage
npm test -- --coverage

# Suppress logs during tests
SUPPRESS_TEST_LOGS=true npm test
```

## Test Structure

```
tests/
├── setup.js              # Global test setup (DB, env vars)
├── unit/                 # Fast, isolated unit tests
├── integration/          # API + DB integration tests
└── helpers/              # Shared test utilities
```

## Important Notes

- ✅ Tests NEVER touch production database
- ✅ Each test file gets clean database state
- ✅ External services (Redis, Cloudinary) are mocked in tests
- ✅ Test environment is set to `NODE_ENV=test`

## CI/CD Integration

Tests are CI-ready. Example GitHub Actions:

```yaml
- name: Run tests
  run: npm test
  env:
    TEST_MONGODB_URI: ${{ secrets.TEST_MONGODB_URI }}
```
