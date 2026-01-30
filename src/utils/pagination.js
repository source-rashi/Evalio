/**
 * Pagination utility for consistent pagination across all list endpoints
 * 
 * Usage:
 *   const { page, limit, skip } = getPaginationParams(req);
 *   const items = await Model.find(query).skip(skip).limit(limit);
 *   const total = await Model.countDocuments(query);
 *   const response = buildPaginationResponse(items, total, page, limit);
 */

/**
 * Extract and validate pagination parameters from request
 * @param {Object} req - Express request object
 * @returns {Object} { page, limit, skip }
 */
function getPaginationParams(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20)); // Default 20, max 100
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Build consistent pagination response structure
 * @param {Array} items - Array of items for current page
 * @param {Number} total - Total count of items matching query
 * @param {Number} page - Current page number
 * @param {Number} limit - Items per page
 * @returns {Object} Pagination response object
 */
function buildPaginationResponse(items, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
}

module.exports = {
  getPaginationParams,
  buildPaginationResponse
};
