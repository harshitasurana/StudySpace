import RoleTemplate from "./role_template_schema.js";

export const ROLE_TEMPLATE_FILTER_SCHEMA = (() => {
  const searchable = ['created_by_name', 'updated_by_name'];
  const exact = [];
  const range = { number: [
      'updated_by',
      'created_by',], date: [
      'updated_at',
      'created_at',] };
  const sortable = [];

  const attributes = RoleTemplate.rawAttributes;

  for (const [field, config] of Object.entries(attributes)) {
    sortable.push(field);

    let type;
    if (config.type.constructor.name === 'STRING') type = 'string';
    else if (config.type.constructor.name === 'INTEGER') type = 'number';
    else if (config.type.constructor.name === 'DATE') type = 'date';
    else if (config.type.constructor.name === 'BOOLEAN') type = 'boolean';
    else if (config.type.constructor.name === 'JSONB' || config.type.constructor.name === 'JSON') type = 'json';
    else type = 'unknown';

    switch (type) {
      case "string":
        searchable.push(field);
        exact.push(field);
        break;
      case "number":
        range.number.push(field);
        exact.push(field);
        break;
      case "boolean":
        exact.push(field);
        break;
      case "date":
        range.date.push(field);
        break;
      default:
        break;
    }
  }

  return {
    searchable,
    exact,
    range,
    sortable
  };
})();
