export const list = async ({
  model,
  where,
  limit,
  offset,
  order,
  include
}) => {
  const options = {
    where,
    limit,
    offset,
    order
  };

  if (include && include.length > 0) {
    options.include = include;
  }

  const result = await model.findAndCountAll(options);

  return {
    data: result.rows,
    total: result.count,
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(result.count / limit)
  };

};
