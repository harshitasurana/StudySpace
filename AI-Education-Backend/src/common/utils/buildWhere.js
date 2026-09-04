import { Op } from "sequelize";

export const buildWhere = ({
  baseWhere = {},
  search,
  filters = {},
  schema = {}
}) => {
  const where = { ...baseWhere };

  /* 🔍 GLOBAL SEARCH */
  if (search && schema.searchable?.length) {
    where[Op.or] = schema.searchable.map(field => ({
      [field]: { [Op.iLike]: `%${search}%` }
    }));
  }

  /* 🎯 EXACT MATCH */
  for (const field of schema.exact || []) {
    if (schema.associated?.[field]) {
      continue;
    }

    if (filters[field] !== undefined) {
      let value = filters[field];

      // Enums must use exact match only (no ILIKE)
      if (schema.types?.[field] === 'enum') {
        where[field] = value;
        continue;
      }

      // Convert string values to appropriate types
      if (typeof value === 'string') {
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(value) && value !== '') value = Number(value);
        else {
          // For string fields, use partial match
          where[field] = { [Op.iLike]: `%${value}%` };
          continue;
        }
      }
      where[field] = value;
    }
  }

  /* 🧩 ASSOCIATED MODEL FILTERS */
  for (const key in schema.associated || {}) {
    if (filters[key] !== undefined && filters[key] !== '') {
      const value = filters[key];
      const association = schema.associated[key];
      const path = Array.isArray(association.model)
        ? association.model.join('.')
        : association.model;
      const sequelizeKey = `$${path}.${association.field}$`;

      if (typeof value === 'string') {
        where[sequelizeKey] = { [Op.iLike]: `%${value}%` };
      } else {
        where[sequelizeKey] = value;
      }
    }
  }

  /* 🔢 NUMBER RANGE - supports both _min/_max and _from/_to */
  for (const field of schema.range?.number || []) {
    // Support salary_min / salary_max
    let min = filters[`${field}_min`];
    let max = filters[`${field}_max`];
    
    // Also support salary_from / salary_to
    if (min === undefined) min = filters[`${field}_from`];
    if (max === undefined) max = filters[`${field}_to`];

    if (min !== undefined || max !== undefined) {
      where[field] = {};
      if (min !== undefined) {
        where[field][Op.gte] = typeof min === 'string' ? Number(min) : min;
      }
      if (max !== undefined) {
        where[field][Op.lte] = typeof max === 'string' ? Number(max) : max;
      }
    }
  }

  /* 📅 DATE RANGE */
  for (const field of schema.range?.date || []) {
    const from = filters[`${field}_from`];
    const to = filters[`${field}_to`];

    if (from || to) {
      where[field] = {};
      
      if (from) {
        // If from is a date-only string (YYYY-MM-DD), set to start of day
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) {
          // Check if it's a date-only string (no time component)
          if (from.match(/^\d{4}-\d{2}-\d{2}$/)) {
            fromDate.setHours(0, 0, 0, 0);
          }
          where[field][Op.gte] = fromDate;
        }
      }
      
      if (to) {
        // If to is a date-only string (YYYY-MM-DD), set to end of day
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          // Check if it's a date-only string (no time component)
          if (to.match(/^\d{4}-\d{2}-\d{2}$/)) {
            toDate.setHours(23, 59, 59, 999);
          }
          where[field][Op.lte] = toDate;
        }
      }
    }
  }

  /* 📅 SINGLE DATE FILTER (whole day) */
  for (const field of schema.range?.date || []) {
    const dateValue = filters[field];
    if (dateValue && !filters[`${field}_from`] && !filters[`${field}_to`]) {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        where[field] = {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        };
      }
    }
  }

  return where;
};

// Backward compatibility
export default ({ search, filters }, searchableFields = []) => {
  const where = {};

  // 🔍 Global search
  if (search && searchableFields.length) {
    where[Op.or] = searchableFields.map(field => ({
      [field]: { [Op.iLike]: `%${search}%` },
    }));
  }

  // 🎯 Column filters
  for (const key in filters) {
    const value = filters[key];

    if (value === undefined || value === '') continue;

    // Range filter (balanceMin / balanceMax)
    if (key.endsWith('Min')) {
      const field = key.replace('Min', '');
      where[field] ??= {};
      where[field][Op.gte] = value;
    }

    else if (key.endsWith('Max')) {
      const field = key.replace('Max', '');
      where[field] ??= {};
      where[field][Op.lte] = value;
    }

    // Not contains
    else if (value.startsWith('!')) {
      where[key] = { [Op.notILike]: `%${value.slice(1)}%` };
    }

    // Exact / contains
    else {
      where[key] = value;
    }
  }

  return where;
};
