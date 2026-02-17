/**
 * Environment Variable Validation
 * 
 * Validates that all required environment variables are present on startup.
 * Fails fast with clear error messages to prevent silent failures in production.
 */

const logger = require('./logger');

/**
 * Required environment variables with descriptions
 */
const REQUIRED_ENV_VARS = [
  {
    name: 'MONGO_URI',
    description: 'MongoDB connection string',
    example: 'mongodb://localhost:27017/evalio'
  },
  {
    name: 'CLERK_SECRET_KEY',
    description: 'Clerk secret key for authentication',
    example: 'sk_test_your_clerk_secret_key',
    minLength: 32
  }
];

/**
 * Optional but recommended environment variables
 */
const RECOMMENDED_ENV_VARS = [
  {
    name: 'REDIS_HOST',
    description: 'Redis host for caching and queues',
    default: 'localhost'
  },
  {
    name: 'REDIS_PORT',
    description: 'Redis port',
    default: '6379'
  },
  {
    name: 'CLOUDINARY_URL',
    description: 'Cloudinary configuration for image uploads',
    example: 'cloudinary://key:secret@cloud'
  },
  {
    name: 'GEMINI_API_KEY',
    description: 'Google Gemini API key for ML evaluation',
    example: 'your-gemini-api-key'
  }
];

/**
 * Validates a single environment variable
 * 
 * @param {Object} envVar - Environment variable configuration
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateEnvVar(envVar) {
  const value = process.env[envVar.name];

  // Check if required variable is missing
  if (!value || value.trim() === '') {
    return {
      valid: false,
      error: `Missing required environment variable: ${envVar.name}\n` +
             `  Description: ${envVar.description}\n` +
             `  Example: ${envVar.example || 'N/A'}`
    };
  }

  // Check minimum length if specified
  if (envVar.minLength && value.length < envVar.minLength) {
    return {
      valid: false,
      error: `Environment variable ${envVar.name} is too short\n` +
             `  Minimum length: ${envVar.minLength} characters\n` +
             `  Current length: ${value.length} characters\n` +
             `  Recommendation: Use a strong, randomly generated value`
    };
  }

  // Validate MongoDB URI format
  if (envVar.name === 'MONGO_URI' && !value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
    return {
      valid: false,
      error: `Invalid MongoDB URI format: ${envVar.name}\n` +
             `  Must start with 'mongodb://' or 'mongodb+srv://'\n` +
             `  Example: ${envVar.example}`
    };
  }

  // Validate JWT_SECRET is not a common default
  if (envVar.name === 'JWT_SECRET') {
    const unsafeDefaults = ['secret', 'devsecret', 'test', 'password', '123456'];
    if (unsafeDefaults.includes(value.toLowerCase())) {
      return {
        valid: false,
        error: `Unsafe JWT secret detected: ${envVar.name}\n` +
               `  The current value is too common and insecure\n` +
               `  Recommendation: Generate a strong random secret`
      };
    }
  }

  return { valid: true };
}

/**
 * Validates all required environment variables
 * Logs warnings for missing recommended variables
 * 
 * @throws {Error} If any required environment variable is invalid
 */
function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // Skip validation in test environment
  if (process.env.NODE_ENV === 'test') {
    logger.info('Skipping environment validation in test mode');
    return;
  }

  logger.info('Validating environment configuration...');

  // Validate required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    const result = validateEnvVar(envVar);
    if (!result.valid) {
      errors.push(result.error);
    }
  }

  // Check recommended variables
  for (const envVar of RECOMMENDED_ENV_VARS) {
    const value = process.env[envVar.name];
    if (!value || value.trim() === '') {
      warnings.push(
        `Optional: ${envVar.name} not set\n` +
        `  Description: ${envVar.description}\n` +
        `  Default: ${envVar.default || 'None'}`
      );
    }
  }

  // Report warnings (non-blocking)
  if (warnings.length > 0) {
    logger.warn('Environment configuration warnings:');
    warnings.forEach(warning => {
      logger.warn(warning);
    });
  }

  // Report errors and exit (blocking)
  if (errors.length > 0) {
    logger.error('❌ Environment validation failed!\n');
    logger.error('The following required environment variables are invalid:\n');
    errors.forEach(error => {
      logger.error(error);
      logger.error('---');
    });
    logger.error('\n💡 TIP: Create a .env file in the project root with these variables');
    logger.error('💡 TIP: Copy .env.example if available\n');
    
    // Exit process with error code
    process.exit(1);
  }

  logger.info('✅ Environment validation passed');
}

module.exports = {
  validateEnvironment,
  validateEnvVar
};
