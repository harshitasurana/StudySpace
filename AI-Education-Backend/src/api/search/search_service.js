import { checkUserFeaturePermission } from "../feature/feature_permissions_model.js";
import Feature from "../feature/feature_schema.js";
import FeatureAvailability, { getLinksByFeatureId } from "../feature/feature_availability_model.js";
import AvailabilityType from "../feature/feature_availability_schema.js";
import sequelize from "../../config/database.js";
import { buildSearchEntities, buildSearchNeedles, normalizeText } from "./search_model_scanner.js";
import { resolveEntityPermission } from "./search_rbac_service.js";
import axios from "axios";

const { entities: SEARCH_ENTITIES, categoryOrder: SEARCH_CATEGORIES } = buildSearchEntities(sequelize);
export { SEARCH_ENTITIES, SEARCH_CATEGORIES };

const asPlain = (row) => (row?.get ? row.get({ plain: true }) : row);
const compact = (items) => items.filter(Boolean);

const levenshteinDistance = (left, right) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const matrix = Array.from({ length: right.length + 1 }, (_, index) => [index]);
  for (let column = 0; column <= left.length; column += 1) {
    matrix[0][column] = column;
  }
  for (let row = 1; row <= right.length; row += 1) {
    for (let column = 1; column <= left.length; column += 1) {
      const cost = left[column - 1] === right[row - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }
  return matrix[right.length][left.length];
};

const isSubsequence = (needle, haystack) => {
  if (!needle || !haystack) return false;
  let position = 0;
  for (const character of haystack) {
    if (character === needle[position]) {
      position += 1;
      if (position === needle.length) return true;
    }
  }
  return false;
};

const tokenizeText = (value) => normalizeText(value).split(" ").filter(Boolean);

const bestTokenScore = (candidateTokens, queryTokens) => {
  let score = 0;
  for (const queryToken of queryTokens) {
    let tokenScore = 0;
    for (const candidateToken of candidateTokens) {
      if (candidateToken === queryToken) {
        tokenScore = Math.max(tokenScore, 24);
        continue;
      }
      if (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)) {
        tokenScore = Math.max(tokenScore, 18);
        continue;
      }
      if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) {
        tokenScore = Math.max(tokenScore, 12);
      }
      const distance = levenshteinDistance(candidateToken, queryToken);
      if (distance === 1) {
        tokenScore = Math.max(tokenScore, 16);
      } else if (distance === 2) {
        tokenScore = Math.max(tokenScore, 10);
      }
    }
    score += tokenScore;
  }
  return score;
};

const buildScore = (result, query) => {
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenizeText(query);
  const title = normalizeText(result.title);
  const subtitle = normalizeText(result.subtitle);
  const description = normalizeText(result.description);
  const corpus = compact([title, subtitle, description]).join(" ");
  const corpusTokens = tokenizeText(corpus);
  let score = 0;
  if (title === normalizedQuery) score += 200;
  else if (title.startsWith(normalizedQuery)) score += 140;
  else if (title.includes(normalizedQuery)) score += 100;
  if (subtitle.includes(normalizedQuery)) score += 55;
  if (description.includes(normalizedQuery)) score += 30;
  if (isSubsequence(normalizedQuery, title)) score += 22;
  if (isSubsequence(normalizedQuery, corpus)) score += 10;
  score += bestTokenScore(corpusTokens, queryTokens);
  return score || 10;
};

const canReadFeature = async (user, featureName, permissionCache) => {
  if (!user) return true;
  if (user.role === "super_admin") return true;
  if (!user.user_id || !user.role_id || !featureName) return false;
  const cacheKey = `${user.user_id}:${user.role_id}:${featureName}`;
  if (permissionCache.has(cacheKey)) return permissionCache.get(cacheKey);
  try {
    const allowed = await checkUserFeaturePermission(user.user_id, user.role_id, featureName, "read");
    if (allowed === true) { permissionCache.set(cacheKey, true); return true; }
    const feature = await Feature.findOne({
      where: { feature_name: featureName, is_deleted: false },
      attributes: ["feature_id"],
    });
    const result = !feature;
    permissionCache.set(cacheKey, result);
    return result;
  } catch (error) {
    permissionCache.set(cacheKey, true);
    return true;
  }
};

const checkFeatureAvailability = async (featureName, clientType, cache = new Map()) => {
  if (!clientType || !featureName) return true;
  const cacheKey = `${clientType}:${featureName}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    const feature = await Feature.findOne({
      where: { feature_name: featureName, is_deleted: false },
      attributes: ["feature_id"],
    });
    if (!feature) { cache.set(cacheKey, true); return true; }
    const allLinks = await FeatureAvailability.findAll({
      where: { feature_id: feature.feature_id },
      attributes: ["availability_type_id"],
    });
    if (allLinks.length === 0) { cache.set(cacheKey, true); return true; }
    const clientTypes = await AvailabilityType.findAll({
      where: { code: [clientType, "BOTH"], is_active: true },
      attributes: ["availability_type_id"],
    });
    if (clientTypes.length === 0) { cache.set(cacheKey, true); return true; }
    const clientTypeIds = new Set(clientTypes.map((t) => t.availability_type_id));
    const hasMatch = allLinks.some((link) => clientTypeIds.has(link.availability_type_id));
    cache.set(cacheKey, hasMatch);
    return hasMatch;
  } catch {
    cache.set(cacheKey, true);
    return true;
  }
};

const filterResultByScope = (item, user) => {
  if (!user || user.role === "super_admin") return true;
  return true;
};

// This search framework spans the platform's whole shared model registry
// (buildSearchEntities scans every Sequelize model with a .searchConfig),
// which is overwhelmingly healthcare (patients, doctors, appointments,
// billing, pharmacy, rooms, ...). Those ~70 models were built long before
// Education existed and were never given per-clientType
// FeatureAvailability links, so checkFeatureAvailability below treats
// them as globally available (see its "no links -> allowed everywhere"
// fallback) - meaning every one of them was leaking into Education's
// search results too. Retrofitting FeatureAvailability onto ~70 unrelated
// healthcare schemas is well outside a search-scoping fix and risks that
// product's own search behavior, so Education instead gets an explicit
// allowlist of the real searchable entities it actually owns.
//
// help_articles/help_faqs are deliberately excluded from this global
// search (Topbar/Dashboard), even though they're real, working search
// entities elsewhere in this framework: the Help Center page already has
// its own dedicated search (HelpCenterService.search -> a separate
// endpoint), and Help's corpus is large enough that for any common query
// term it was scoring highly across many FAQs/Articles and crowding the
// shared top-N result list, so a student's actual Subjects/Chapters/
// Notes/Bookmarks matches rarely surfaced in practice even though the
// backend was technically returning them too (verified directly against
// searchAllEntities()).
const EDUCATION_ENTITY_KEYS = new Set(["subjects", "chapters", "notes", "bookmarks"]);

const applyClientTypeAllowlist = (entities, clientType) => {
  if (clientType !== "REACT_EDUCATION") return entities;
  return entities.filter((entity) => EDUCATION_ENTITY_KEYS.has(entity.key));
};

const getAccessibleEntities = async (user, entities = SEARCH_ENTITIES, clientType = null) => {
  entities = applyClientTypeAllowlist(entities, clientType);
  if (!user) return entities;
  if (user.role === "super_admin") return entities;
  const permissionCache = new Map();
  const availabilityCache = new Map();
    const accessibility = await Promise.all(
    entities.map(async (entity) => {
      if (entity.permissionFeatures.length === 0) {
        const permission = resolveEntityPermission(user, entity);
        return { entity, allowed: permission.level !== "none" };
      }
      const hasPermission = (await Promise.all(
        entity.permissionFeatures.map((featureName) => canReadFeature(user, featureName, permissionCache))
      )).some(Boolean);
      if (!hasPermission) return { entity, allowed: false };
      const hasAvailability = clientType
        ? (await Promise.all(
            entity.permissionFeatures.map((featureName) => checkFeatureAvailability(featureName, clientType, availabilityCache))
          )).some(Boolean)
        : true;
      if (!hasAvailability) return { entity, allowed: false };
      const permission = resolveEntityPermission(user, entity);
      return { entity, allowed: permission.level !== "none" };
    })
  );
  return accessibility.filter((item) => item.allowed).map((item) => item.entity);
};

export const getSearchFilters = async (userOrOptions = null, clientType = null) => {
  const resolvedOptions = userOrOptions && typeof userOrOptions === "object" && !Array.isArray(userOrOptions) && ("user" in userOrOptions || "clientType" in userOrOptions)
    ? userOrOptions
    : { user: userOrOptions, clientType };
  const user = resolvedOptions?.user || null;
  const resolvedClientType = resolvedOptions?.clientType || clientType || null;
  const entities = await getAccessibleEntities(user, SEARCH_ENTITIES, resolvedClientType);
  const categoryKeys = [...new Set(entities.map((item) => item.category))];
  
  if (!categoryKeys.includes('productivity')) {
    categoryKeys.push('productivity');
  }

  const categories = SEARCH_CATEGORIES.filter((key) => categoryKeys.includes(key)).map((key) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
  }));

  if (!categories.some(c => c.key === 'productivity')) {
    categories.push({ key: 'productivity', label: 'Productivity' });
  }

  const mappedEntities = entities.map(({ key, label, category, roleAccess }) => ({ key, label, category, roleAccess: roleAccess || null }));
  // Emails/messages come from the separate healthcare comms MCP service
  // (see searchAllEntities's mcpItems) - Education has no such feature at
  // all, so it shouldn't advertise or attempt to query it.
  if (mappedEntities.length > 0 && resolvedClientType !== "mobile" && resolvedClientType !== "REACT_EDUCATION") {
    mappedEntities.push(
      { key: 'emails', label: 'Emails', category: 'productivity', roleAccess: null },
      { key: 'messages', label: 'Messages', category: 'directory', roleAccess: null }
    );
  }

  return {
    categories,
    entities: mappedEntities,
  };
};

export const searchAllEntities = async (options = {}) => {
  const normalizedQuery = String(options.q || "").trim();
  const entityFilter = options.entity || null;
  const categoryFilter = options.category || null;
  const limit = Number(options.limit || 20);
  const perEntityLimit = Number(options.per_entity_limit || 5);
  const user = options.user || null;
  const clientType = options.clientType || null;
  const accessibleEntities = await getAccessibleEntities(user, SEARCH_ENTITIES, clientType);

  const selectedEntities = accessibleEntities.filter((entity) => {
    if (entityFilter && entity.key !== entityFilter) return false;
    if (categoryFilter && entity.category !== categoryFilter) return false;
    return true;
  });

  const entityMatchQuery = (() => {
    if (!normalizedQuery) return null;
    const matched = selectedEntities.find((entity) => {
      const entityTerms = [entity.key, normalizeText(entity.label), ...entity.permissionFeatures.map((f) => normalizeText(f))];
      return buildSearchNeedles(normalizedQuery).some((needle) =>
        entityTerms.some((term) => term && (term.includes(needle) || needle.includes(term)))
      );
    });
    return matched ? matched.key : null;
  })();

  const resultGroups = await Promise.all(
    selectedEntities.map(async (entity) => {
      try {
        const permission = resolveEntityPermission(user, entity);
        if (permission.level === "none") {
          return { entity: entity.key, items: [] };
        }
        const useEmptyQuery = entityMatchQuery === entity.key;
        const items = await entity.search(useEmptyQuery ? "" : normalizedQuery, perEntityLimit, { user });
        return { entity: entity.key, items };
      } catch (err) {
        console.error(`[Search] Error in ${entity.key}:`, err.message);
        return { entity: entity.key, items: [] };
      }
    })
  );

  let mcpItems = [];
  if (options.authHeader && normalizedQuery && clientType !== "REACT_EDUCATION") {
    try {
      const mcpResponse = await axios.get(`${process.env.MCP_SEARCH_URL || "http://localhost:4001"}/api/search`, {
        params: { q: normalizedQuery },
        headers: { Authorization: options.authHeader },
        timeout: 2000,
      });
      const data = mcpResponse.data;
      if (data) {
        if (Array.isArray(data.emails)) {
          mcpItems.push(...data.emails.map(e => ({
            id: e.id,
            title: e.subject || '(No Subject)',
            subtitle: `From: ${e.from}`,
            description: e.body ? e.body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 150) : '',
            category: 'productivity',
            entity: 'emails',
            route: '/communication/email',
            meta: { receivedAt: e.receivedAt },
          })));
        }
        if (Array.isArray(data.messages)) {
          mcpItems.push(...data.messages.map(m => ({
            id: m.id,
            title: 'Chat Message',
            subtitle: m.content,
            description: m.content,
            category: 'directory',
            entity: 'messages',
            route: '/communication/chat',
            meta: { createdAt: m.createdAt, channelId: m.channelId },
          })));
        }
        if (Array.isArray(data.contacts)) {
          mcpItems.push(...data.contacts.map(c => ({
            id: c.id,
            title: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Contact',
            subtitle: c.email || c.phone || '',
            description: `Type: ${c.type}`,
            category: 'directory',
            entity: 'contacts',
            route: '/communication/contacts',
            meta: { type: c.type },
          })));
        }
      }
    } catch (err) {
      console.warn(`[Search] MCP backend search query failed: ${err.message}`);
    }
  }

  const scored = [
    ...resultGroups.flatMap((group) => group.items),
    ...mcpItems
  ]
    .map((item) => ({ ...item, score: buildScore(item, normalizedQuery) }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return String(left.title).localeCompare(String(right.title));
    })
    .slice(0, limit);

  const entityCounts = resultGroups.reduce((accumulator, group) => {
    accumulator[group.entity] = group.items.length;
    return accumulator;
  }, {});

  if (mcpItems.length > 0) {
    entityCounts['emails'] = mcpItems.filter(i => i.entity === 'emails').length;
    entityCounts['messages'] = mcpItems.filter(i => i.entity === 'messages').length;
    entityCounts['contacts'] = (entityCounts['contacts'] || 0) + mcpItems.filter(i => i.entity === 'contacts').length;
  }

  const categoryCounts = scored.reduce((accumulator, item) => {
    accumulator[item.category] = (accumulator[item.category] || 0) + 1;
    return accumulator;
  }, {});

  const permissionLevels = selectedEntities.reduce((acc, entity) => {
    const permission = resolveEntityPermission(user, entity);
    acc[entity.key] = permission.level;
    return acc;
  }, {});

  return {
    query: normalizedQuery,
    total: scored.length,
    results: scored,
    entity_counts: entityCounts,
    category_counts: categoryCounts,
    permission_levels: permissionLevels,
    applied_filters: { entity: entityFilter, category: categoryFilter, limit, per_entity_limit: perEntityLimit },
    available_filters: await getSearchFilters(user, clientType),
  };
};
