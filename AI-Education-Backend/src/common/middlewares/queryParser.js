export default (req, res, next) => {
  const {
    page,
    limit,
    search,
    sort,
    sortBy,
    sort_by,
    sortOrder,
    sort_order,
    ...filters
  } = req.query;

  let sortConfig = [['created_at', 'DESC']];
  if (sort) {
    // Handle sort in format "field:order"
    const [field, order = 'desc'] = sort.split(':');
    sortConfig = getSortConfig(field, order.toUpperCase());
  } else if (sortBy || sort_by) {
    // Fallback to separate sortBy and sortOrder
    const finalSortBy = sortBy || sort_by;
    const finalSortOrder = (sortOrder || sort_order) ? (sortOrder || sort_order).toUpperCase() : 'DESC';
    sortConfig = getSortConfig(finalSortBy, finalSortOrder);
  }

  req.queryOptions = {};
  if (page !== undefined) req.queryOptions.page = +page;
  if (limit !== undefined) req.queryOptions.limit = +limit;
  if (page !== undefined && limit !== undefined) {
    req.queryOptions.offset = (+page - 1) * +limit;
  }
  req.queryOptions.sort = sortConfig;
  req.queryOptions.search = search;
  req.queryOptions.filters = filters;

  next();
};

/**
 * Helper function to map fields to their associations for sorting
 * Returns Sequelize-compatible sort config
 */
function getSortConfig(field, order = 'DESC') {
  // Simply return [['fieldName', 'DIRECTION']]
  // The patient model's processSortForNestedFields will handle mapping to nested paths
  return [[field, order]];
}
