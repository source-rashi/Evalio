/**
 * Read-Through Cache Utility (Redis-ready)
 * 
 * Caching Strategy:
 * - ONLY cache immutable/rarely-changing data (exams, questions)
 * - DO NOT cache mutable data (submissions, evaluations, user data)
 * - Use TTL to prevent stale data
 * - Provide clear invalidation patterns
 */

const logger = require('./logger');

// In-memory cache fallback (when Redis unavailable)
const memoryCache = new Map();

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  // Exam metadata is relatively static
  EXAM_TTL: 5 * 60, // 5 minutes
  
  // Questions rarely change after exam creation
  QUESTIONS_TTL: 10 * 60, // 10 minutes
  
  // Enable/disable caching globally
  ENABLED: process.env.CACHE_ENABLED !== 'false'
};

/**
 * Cache key generators - consistent naming convention
 */
const CacheKeys = {
  exam: (examId) => `exam:${examId}`,
  examQuestions: (examId) => `exam:${examId}:questions`,
  examWithQuestions: (examId) => `exam:${examId}:full`
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null
 */
async function get(key) {
  if (!CACHE_CONFIG.ENABLED) return null;
  
  try {
    // TODO: Replace with Redis client when available
    // const value = await redisClient.get(key);
    // return value ? JSON.parse(value) : null;
    
    const cached = memoryCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      logger.debug(`Cache hit: ${key}`);
      return cached.value;
    }
    
    if (cached) {
      memoryCache.delete(key); // Remove expired
      logger.debug(`Cache expired: ${key}`);
    }
    
    return null;
  } catch (err) {
    logger.error(err, `Cache get error for key: ${key}`);
    return null; // Fail gracefully
  }
}

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 */
async function set(key, value, ttl) {
  if (!CACHE_CONFIG.ENABLED) return;
  
  try {
    // TODO: Replace with Redis client when available
    // await redisClient.setex(key, ttl, JSON.stringify(value));
    
    memoryCache.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000)
    });
    
    logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
  } catch (err) {
    logger.error(err, `Cache set error for key: ${key}`);
    // Fail gracefully - caching is not critical
  }
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 */
async function del(key) {
  if (!CACHE_CONFIG.ENABLED) return;
  
  try {
    // TODO: Replace with Redis client when available
    // await redisClient.del(key);
    
    memoryCache.delete(key);
    logger.debug(`Cache deleted: ${key}`);
  } catch (err) {
    logger.error(err, `Cache delete error for key: ${key}`);
  }
}

/**
 * Delete multiple keys matching pattern
 * @param {string} pattern - Key pattern (e.g., "exam:123:*")
 */
async function delPattern(pattern) {
  if (!CACHE_CONFIG.ENABLED) return;
  
  try {
    // TODO: Replace with Redis SCAN when available
    // const keys = await redisClient.keys(pattern);
    // if (keys.length > 0) await redisClient.del(...keys);
    
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    const keysToDelete = [];
    
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => memoryCache.delete(key));
    logger.debug(`Cache pattern deleted: ${pattern} (${keysToDelete.length} keys)`);
  } catch (err) {
    logger.error(err, `Cache pattern delete error: ${pattern}`);
  }
}

/**
 * Cache invalidation helpers
 */
const invalidate = {
  /**
   * Invalidate all cache entries for an exam
   * Call this when exam is updated or deleted
   */
  exam: async (examId) => {
    await delPattern(`exam:${examId}*`);
  },
  
  /**
   * Invalidate questions cache for an exam
   * Call this when questions are added/updated/deleted
   */
  examQuestions: async (examId) => {
    await del(CacheKeys.examQuestions(examId));
    await del(CacheKeys.examWithQuestions(examId));
  }
};

/**
 * Read-through cache wrapper
 * Tries cache first, falls back to fetcher function
 * 
 * @param {string} key - Cache key
 * @param {Function} fetcher - Async function to fetch data if not cached
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>} Data from cache or fetcher
 */
async function readThrough(key, fetcher, ttl) {
  // Try cache first
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }
  
  // Cache miss - fetch data
  logger.debug(`Cache miss: ${key} - fetching...`);
  const data = await fetcher();
  
  // Cache the result
  if (data !== null && data !== undefined) {
    await set(key, data, ttl);
  }
  
  return data;
}

/**
 * Clear entire cache (use with caution)
 * Useful for testing or major data migrations
 */
async function clear() {
  try {
    // TODO: Replace with Redis FLUSHDB when available
    // await redisClient.flushdb();
    
    memoryCache.clear();
    logger.info('Cache cleared');
  } catch (err) {
    logger.error(err, 'Cache clear error');
  }
}

/**
 * Get cache statistics (for monitoring)
 */
function getStats() {
  return {
    enabled: CACHE_CONFIG.ENABLED,
    size: memoryCache.size,
    keys: Array.from(memoryCache.keys()),
    backend: 'memory' // TODO: Change to 'redis' when Redis is connected
  };
}

module.exports = {
  get,
  set,
  del,
  delPattern,
  readThrough,
  invalidate,
  clear,
  getStats,
  CacheKeys,
  CACHE_CONFIG
};
