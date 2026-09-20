import { Op, cast, col, where as seqWhere } from "sequelize";
import { resolveEntityPermission } from "./search_rbac_service.js";

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenizeText = (value) => normalizeText(value).split(" ").filter(Boolean);

const singularizeToken = (token) => {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("s") && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
};

const buildSearchNeedles = (query) => {
  const normalized = normalizeText(query);
  const tokens = tokenizeText(query);
  const needles = new Set();
  if (normalized) needles.add(normalized);
  for (const token of tokens) {
    needles.add(token);
    needles.add(singularizeToken(token));
    if (token.length >= 4) needles.add(token.slice(0, 4));
    if (token.length >= 6) needles.add(token.slice(0, 5));
  }
  return [...needles].filter(Boolean);
};

const buildTextSearchWhere = (fields, query, tableName) => {
  const needles = buildSearchNeedles(query);
  if (needles.length === 0) return {};
  return {
    [Op.or]: needles.flatMap((needle) =>
      fields.map((field) => {
        if (field.startsWith("$")) {
          return { [field]: { [Op.iLike]: `%${needle}%` } };
        }
        if (tableName) {
          return seqWhere(cast(col(`${tableName}.${field}`), "text"), Op.iLike, `%${needle}%`);
        }
        return { [field]: { [Op.iLike]: `%${needle}%` } };
      })
    ),
  };
};

const applyScopeFilters = (baseWhere = {}, user, scope = {}) => {
  const where = { ...baseWhere };
  if (!user || user.role === "super_admin") return where;
  const permission = resolveEntityPermission(user, { scope, roleAccess: null });
  if (permission.level === "none") return { ...where, [Op.and]: [{ [Op.literal]: "1 = 0" }] };
  Object.assign(where, permission.filters);
  return where;
};

const autoDetectTextColumns = (model) =>
  Object.entries(model.rawAttributes)
    .filter(([, attr]) => {
      const typeStr = attr.type?.toString() || "";
      return typeStr.startsWith("STRING") || typeStr.startsWith("TEXT") || typeStr.startsWith("CHAR");
    })
    .map(([name]) => name);

const getPreferredTextFields = (model, fallbackFields = []) => {
  const candidateFields = [
    ...fallbackFields,
    ...autoDetectTextColumns(model),
    "name",
    "title",
    "subject",
    "label",
    "display_name",
    "full_name",
    "description",
    "notes",
    "code",
    "slug",
  ];
  const existing = new Set(Object.keys(model.rawAttributes));
  const selected = candidateFields.filter((field) => existing.has(field));
  return selected.length > 0 ? selected : [detectPrimaryKey(model) || "id"].filter(Boolean);
};

const resolveDisplay = (fieldOrFn, row) => {
  if (typeof fieldOrFn === "function") return fieldOrFn(row);
  if (!fieldOrFn) return null;
  return row[fieldOrFn] ?? null;
};

const getFallbackDisplayValue = (row, model, preferredFields = []) => {
  const candidates = [...preferredFields, ...getPreferredTextFields(model)];
  for (const field of candidates) {
    const value = row?.[field];
    if (value === null || value === undefined || value === "") continue;
    return value;
  }
  return null;
};

const detectTableName = (model, fields) => {
  const hasEnum = fields.some((f) => {
    if (f.startsWith("$")) return false;
    const attr = model.rawAttributes[f];
    return attr?.type?.toString().startsWith("ENUM");
  });
  return hasEnum ? model.name : null;
};

const detectPrimaryKey = (model) => {
  const entry = Object.entries(model.rawAttributes).find(([, attr]) => attr.primaryKey);
  return entry ? entry[0] : null;
};

const genericSearch = (model, config) => {
  const { fields, activeFilter, display, route, meta: metaFn, scope, include, order, roleAccess } = config;
  const tableName = detectTableName(model, fields);
  const primaryKey = detectPrimaryKey(model);
  const safeFields = Array.isArray(fields) && fields.length > 0 ? fields : getPreferredTextFields(model);

  return async (query, perEntityLimit, context = {}) => {
    const where = { ...(activeFilter || {}) };

    const textWhere = buildTextSearchWhere(safeFields, query, tableName);
    Object.assign(where, textWhere);

    const entityConfig = { ...config, scope, roleAccess };
    const permission = resolveEntityPermission(context.user, entityConfig);
    if (permission.level === "none") return [];
    Object.assign(where, permission.filters);

    const queryOpts = { where, limit: perEntityLimit };
    if (include && include.length > 0) {
      queryOpts.include = include;
      queryOpts.subQuery = false;
    }
    if (order && order.length > 0) {
      queryOpts.order = order;
    }

    const rows = await model.findAll(queryOpts);
    return rows.map((row) => {
      const item = row.get ? row.get({ plain: true }) : row;
      const titleField = typeof display?.title === "string" && item?.[display.title] === undefined ? null : display?.title;
      const subtitleField = typeof display?.subtitle === "string" && item?.[display.subtitle] === undefined ? null : display?.subtitle;
      const descriptionField = typeof display?.description === "string" && item?.[display.description] === undefined ? null : display?.description;
      return {
        entity: config.key,
        category: config.category,
        id: primaryKey ? item[primaryKey] : null,
        title: resolveDisplay(titleField, item) ?? getFallbackDisplayValue(item, model, safeFields),
        subtitle: resolveDisplay(subtitleField, item) ?? getFallbackDisplayValue(item, model, ["description", "notes", "label"]),
        description: resolveDisplay(descriptionField, item) ?? getFallbackDisplayValue(item, model, ["description", "notes"]),
        route: typeof route === "function" ? route(item) : null,
        meta: metaFn ? metaFn(item) : {},
      };
    });
  };
};

export function buildSearchEntities(sequelize) {
  const entities = [];
  const seenCategories = [];
  const categorySet = new Set();

  for (const [, model] of Object.entries(sequelize.models)) {
    const config = model.searchConfig;
    if (!config) continue;

    const { key, label, category, permissionFeatures = [], fields: configFields, activeFilter, display, route, meta, scope, include, order, roleAccess } = config;
    const fields = configFields || getPreferredTextFields(model);

    if (!categorySet.has(category)) {
      categorySet.add(category);
      seenCategories.push(category);
    }

    entities.push({
      key,
      label,
      category,
      permissionFeatures,
      roleAccess,
      search: genericSearch(model, { key, category, fields, activeFilter, display, route, meta, scope, include, order, roleAccess }),
    });
  }

  return { entities, categoryOrder: seenCategories };
}

export { buildTextSearchWhere, buildSearchNeedles, normalizeText, applyScopeFilters };
