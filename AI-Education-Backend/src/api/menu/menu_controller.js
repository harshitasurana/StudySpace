import models from '../../models/model.js';
import { logInfo, logError } from '../../common/utils/logger.js';

/**
 * Recursively sort menu items by menu_order
 * @param {Array} items - Array of menu items to sort
 */
function sortMenuItems(items) {
  items.sort((a, b) => a.menu_order - b.menu_order);
  items.forEach(item => {
    if (item.items && item.items.length > 0) {
      sortMenuItems(item.items);
    }
  });
}

/**
 * Build menu directly from database features
 * @param {Array} features - Features from database with show_in_menu = true
 * @returns {Array} - Hierarchical menu structure
 */
function buildDynamicMenu(features) {
  const map = {};
  const roots = [];

  // NOTE: deliberately NOT named `featureIds` — that field name is
  // already established elsewhere (see 'Permitted feature IDs' below) as
  // a plain array of numbers, which Elasticsearch's dynamic mapping
  // locked in as type `long` for this log index. Reusing the same field
  // name here with formatted strings like "291(parent:289)" caused a
  // real crash: ES rejects the whole document with a
  // document_parsing_exception, which (with no error listener on the
  // winston logger — see logger.js) took the entire API down.
  logInfo('buildDynamicMenu: Processing features', {
    count: features.length,
    featureSummary: features.map(f => ({ featureId: f.feature_id, parentFeatureId: f.parent_feature_id }))
  });

  // Step 1: Create map with all features
  features.forEach(f => {
    map[f.feature_id] = {
      label: f.menu_label || f.feature_name,
      icon: f.menu_icon || 'pi pi-circle',
      routerLink: [f.router_link || `/${f.feature_name.toLowerCase().replace(/\s+/g, '-')}`],
      feature: f.feature_name,
      feature_id: f.feature_id,
      category: f.category?.name || 'Uncategorized',
      menu_order: f.menu_order !== undefined ? f.menu_order : 0,
      description: f.description || '',
      items: []
    };
  });

  // Step 2: Build hierarchy using parent_feature_id
  features.forEach(f => {
    if (f.parent_feature_id && map[f.parent_feature_id]) {
      // Has parent - add as child
      logInfo('Adding as child', { feature_id: f.feature_id, parent_feature_id: f.parent_feature_id });
      map[f.parent_feature_id].items.push(map[f.feature_id]);
    } else {
      // Root level item (no parent or parent doesn't exist in permitted features)
      logInfo('Adding as root', { feature_id: f.feature_id, parent_feature_id: f.parent_feature_id });
      roots.push(map[f.feature_id]);
    }
  });

  // 🔥 Important: recursively sort after building hierarchy
  sortMenuItems(roots);

  logInfo('buildDynamicMenu: Final root items', {
    count: roots.length,
    rootFeatureIds: roots.map(r => r.feature_id)
  });

  return roots;
}

/**
 * Fetch features from database that should be shown in menu
 * @param {Set} permittedFeatureIds - Set of feature_ids the user has permission to
 * @param {string|null} clientType - X-Client-Type header value (e.g. "REACT", "ANGULAR")
 * @returns {Array} - Features from database
 */
async function fetchFeaturesFromDatabase(permittedFeatureIds, clientType = null) {
  const whereClause = {
    is_active: true,
    is_deleted: false,
    show_in_menu: true
  };

  // If we have permitted features, filter by them
  if (permittedFeatureIds && permittedFeatureIds.size > 0) {
    whereClause.feature_id = Array.from(permittedFeatureIds);
  }

  const include = [
    {
      model: models.Category,
      as: 'category',
      attributes: ['name']
    }
  ];

  // Filter by client type if provided — only return features linked to that availability type
  if (clientType) {
    include.push({
      model: models.AvailabilityType,
      as: 'availabilityTypesList',
      attributes: [],
      through: { attributes: [] },
      required: true,
      where: { code: clientType.toUpperCase() }
    });
  }

  const features = await models.Feature.findAll({
    where: whereClause,
    attributes: [
      'feature_id',
      'feature_name',
      'parent_feature_id',
      'menu_label',
      'menu_icon',
      'router_link',     
      'category_id',
      'menu_order',
      'description'
    ],
    include,
    order: [
      ['menu_order', 'ASC'],
      ['feature_name', 'ASC']
    ]
  });

  const result = features.map(f => f.toJSON());
  logInfo('fetchFeaturesFromDatabase: Retrieved features', {
    count: result.length,
    clientType: clientType || 'none',
    features: result.map(f => ({
      id: f.feature_id,
      name: f.feature_name,
      parent: f.parent_feature_id,
      show_in_menu: f.show_in_menu
    }))
  });

  return result;
}

export const getMenu = async (req, res) => {
  try {
    const clientType = req.headers['x-client-type'] || null;

    // Get role_id from request
    let roleId = req.user?.role_id;
    if (!roleId && req.user?.role) {
      // If role_id not provided, fetch it from role name
      try {
        const role = await models.Role.findOne({ where: { role_name: req.user.role } });
        roleId = role?.role_id;
      } catch (err) {
        logError('Failed to fetch role_id from role_name', err);
      }
    }
    if (!roleId) roleId = 'unknown';

    // Fetch allowed feature_ids for the role
    let permittedFeatureIds = new Set();
    if (roleId && roleId !== 'unknown') {
      try {
        // Get feature_ids with read permissions (using the migrated permission_name schema)
        const perms = await models.FeaturePermission.findAll({
          where: { 
            role_id: Number(roleId), 
            permission_name: ['read', 'can_read'],
            is_enabled: true 
          },
          attributes: ['feature_id']
        });
        permittedFeatureIds = new Set(perms.map(p => p.feature_id));
        logInfo('Permitted feature IDs', { roleId, featureIds: Array.from(permittedFeatureIds) });
      } catch (dbErr) {
        logError('Failed to fetch feature permissions for menu', dbErr);
      }
    }

    // Fetch features from database that should be shown in menu, filtered by client type
    const features = await fetchFeaturesFromDatabase(permittedFeatureIds, clientType);

    // Build dynamic menu from database features
    const menu = buildDynamicMenu(features);

    logInfo('Dynamic menu built and served directly from database', { 
      roleId, 
      itemCount: menu.length 
    });
    
    return res.status(200).json(menu);
  } catch (err) {
    logError('Failed to build menu', err);
    return res.status(500).json({ error: 'Failed to build menu', details: err.message });
  }
};

export const reorderMenu = async (req, res) => {
  try {
    const body = req.body;
    let itemsToUpdate = [];

    // ========================================
    // 1. PARSE REQUEST - Support multiple formats
    // ========================================

    // Format 1: { items: [...] } - Standard array format
    if (body.items && Array.isArray(body.items)) {
      itemsToUpdate = body.items;
    }
    // Format 2: { orders: {...} } - Map format (feature_id => menu_order)
    else if (body.orders && typeof body.orders === 'object') {
      itemsToUpdate = Object.entries(body.orders).map(([featureId, menuOrder]) => ({
        feature_id: parseInt(featureId, 10),
        menu_order: menuOrder
      }));
    }
    // Format 3: Direct array in body
    else if (Array.isArray(body)) {
      itemsToUpdate = body;
    }
    // Format 4: Hierarchical { menu: [...] }
    else if (body.menu && Array.isArray(body.menu)) {
      // Flatten hierarchical structure
      const flattenMenu = (items, parentId = null) => {
        const result = [];
        items.forEach((item, index) => {
          result.push({
            feature_id: item.feature_id,
            menu_order: item.menu_order !== undefined ? item.menu_order : index,
            parent_feature_id: parentId
          });
          if (item.items && Array.isArray(item.items)) {
            result.push(...flattenMenu(item.items, item.feature_id));
          }
        });
        return result;
      };
      itemsToUpdate = flattenMenu(body.menu);
    }

    // ========================================
    // 2. VALIDATE INPUT
    // ========================================

    if (!itemsToUpdate || itemsToUpdate.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No items to reorder',
        hint: 'Provide items in one of these formats: { items: [...] }, { orders: {...} }, { menu: [...] }, or [...]'
      });
    }

    // Validate each item
    const validationErrors = [];
    itemsToUpdate.forEach((item, index) => {
      if (item.feature_id === undefined || item.feature_id === null) {
        validationErrors.push(`Item ${index}: missing feature_id`);
      }
      if (item.menu_order === undefined || item.menu_order === null) {
        validationErrors.push(`Item ${index}: missing menu_order`);
      }
      if (isNaN(item.feature_id) || isNaN(item.menu_order)) {
        validationErrors.push(`Item ${index}: feature_id and menu_order must be numbers`);
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // ========================================
    // 3. UPDATE DATABASE
    // ========================================

    const updatedFeatures = [];
    const errors = [];
    const notFound = [];

    logInfo('Reordering menu items', {
      itemCount: itemsToUpdate.length,
      items: itemsToUpdate.map(i => `${i.feature_id}→${i.menu_order}`)
    });

    for (const item of itemsToUpdate) {
      try {
        const feature = await models.Feature.findOne({
          where: { feature_id: item.feature_id, is_deleted: false },
          attributes: ['feature_id', 'feature_name', 'menu_order', 'parent_feature_id']
        });

        if (!feature) {
          notFound.push({
            feature_id: item.feature_id,
            error: 'Feature not found or deleted'
          });
          continue;
        }

        const updateData = { menu_order: item.menu_order };
        if (item.parent_feature_id !== undefined) {
          updateData.parent_feature_id = item.parent_feature_id;
        }

        // Skip if no change needed
        if (feature.menu_order === item.menu_order && 
           (item.parent_feature_id === undefined || feature.parent_feature_id === item.parent_feature_id)) {
          logInfo('Menu order unchanged', {
            feature_id: item.feature_id,
            menu_order: item.menu_order,
            parent_feature_id: item.parent_feature_id
          });
          continue;
        }

        const oldOrder = feature.menu_order;
        await feature.update(updateData);

        updatedFeatures.push({
          feature_id: item.feature_id,
          feature_name: feature.feature_name,
          old_menu_order: oldOrder,
          new_menu_order: item.menu_order
        });

        logInfo('Menu order updated', {
          feature_id: item.feature_id,
          feature_name: feature.feature_name,
          old_menu_order: oldOrder,
          new_menu_order: item.menu_order
        });
      } catch (updateErr) {
        errors.push({
          feature_id: item.feature_id,
          error: updateErr.message
        });
        logError('Failed to update menu order', updateErr, { feature_id: item.feature_id });
      }
    }

    logInfo('Menu reorder completed directly in database', {
      updated: updatedFeatures.length,
      notFound: notFound.length,
      errors: errors.length
    });

    return res.status(200).json({
      success: true,
      message: `Menu reordered successfully (${updatedFeatures.length} items updated)`,
      data: {
        updated: updatedFeatures,
        notFound: notFound,
        errors: errors
      },
      summary: {
        total_requested: itemsToUpdate.length,
        updated_count: updatedFeatures.length,
        not_found_count: notFound.length,
        error_count: errors.length
      }
    });
  } catch (err) {
    logError('Failed to reorder menu', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to reorder menu',
      details: err.message
    });
  }
};