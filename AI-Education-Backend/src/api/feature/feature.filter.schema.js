import Feature from "./feature_schema.js";

/**
 * Auto-generate enterprise filter schema from Feature model
 * Only TEXT fields should be searchable with ILIKE
 */
export const FEATURE_FILTER_SCHEMA = (() => {
  const searchable = [];
  const exact = [];
  const range = { number: [], date: [] };
  const sortable = [];
  const auditFieldNames = ['created_at', 'updated_at', 'created_by', 'updated_by', 'created_by_name', 'updated_by_name'];

  const attributes = Feature.rawAttributes;

  // Define which fields should be searchable (only actual text fields)
  const searchableTextFields = [
    'feature_name',
    'description',
    'menu_label',
    'menu_icon',
    'router_link',
    'created_by_name',
    'updated_by_name',
  ];

  for (const [field, config] of Object.entries(attributes)) {
    sortable.push(field); // ✅ all fields sortable

    if (auditFieldNames.includes(field)) {
      if (field === 'created_at' || field === 'updated_at') {
        range.date.push(field);
      } else if (field === 'created_by' || field === 'updated_by') {
        range.number.push(field);
        exact.push(field);
      } else {
        exact.push(field);
      }
      continue;
    }

    let type;
    if (config.type.constructor.name === 'STRING') type = 'string';
    else if (config.type.constructor.name === 'INTEGER') type = 'number';
    else if (config.type.constructor.name === 'DATE') type = 'date';
    else if (config.type.constructor.name === 'BOOLEAN') type = 'boolean';
    else if (config.type.constructor.name === 'DECIMAL') type = 'number';
    else if (config.type.constructor.name === 'ENUM') type = 'enum';
    else if (config.type.constructor.name === 'JSONTYPE' || config.type.constructor.name === 'JSON') type = 'json';
    else if (config.type.constructor.name === 'TEXT') type = 'text';
    else type = 'unknown';

    switch (type) {
      case "string":
      case "text":
        // Only add to searchable if it's in our approved list
        if (searchableTextFields.includes(field)) {
          searchable.push(field);
        }
        exact.push(field);        // exact match for all text fields
        break;

      case "enum":
        // Enums can be exact matched but not searched with ILIKE
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
        // JSON, unknown - not filterable
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
