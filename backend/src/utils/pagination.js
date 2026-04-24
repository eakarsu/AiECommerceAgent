/**
 * Parse pagination, sorting, and filtering params from query string.
 */
export function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = ['ASC', 'DESC'].includes(query.sortOrder?.toUpperCase()) ? query.sortOrder.toUpperCase() : 'DESC';

  return { page, limit, offset, sortBy, sortOrder };
}

/**
 * Format a Sequelize findAndCountAll result into a paginated response.
 */
export function formatPaginatedResponse(rows, count, { page, limit }) {
  return {
    data: rows,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit)
  };
}
