/**
 * organization_scope_guard.js
 *
 * Middleware that guards GLOBAL TABLE endpoints from accidentally receiving
 * organization_id filters. Global tables are system-wide and must never be
 * queried with org-scoping (countries, states, cities, features, medicines, etc.).
 *
 * Usage — mount on any router that serves a global table:
 *
 *   import { rejectOrgScope } from '../../common/middlewares/organization_scope_guard.js';
 *
 *   router.get('/countries', rejectOrgScope, getCountriesController);
 *   router.get('/features',  rejectOrgScope, getAllFeatures);
 *
 * Behavior:
 *   - If organization_id is present in req.query OR req.body → 400 Bad Request
 *   - Otherwise → passes through to next()
 *   - All violations are logged for audit purposes
 *
 * See docs/architecture.md § "Multi-Tenancy: Global vs Organization-Scoped Tables"
 */

import { logWarn } from '../utils/logger.js';

/**
 * Middleware: reject any request that carries an organization_id parameter
 * on a global (non-org-scoped) endpoint.
 */
export const rejectOrgScope = (req, res, next) => {
  const hasQueryOrgId = Object.prototype.hasOwnProperty.call(req.query || {}, 'organization_id');
  const hasBodyOrgId  = req.body && Object.prototype.hasOwnProperty.call(req.body, 'organization_id');

  if (hasQueryOrgId || hasBodyOrgId) {
    logWarn('organization_scope_guard: organization_id rejected on global endpoint', {
      path:   req.originalUrl,
      method: req.method,
      userId: req.user?.user_id ?? null,
      source: hasQueryOrgId ? 'query' : 'body',
    });

    return res.status(400).json({
      success: false,
      message:
        'organization_id is not supported on this endpoint. ' +
        'This resource is global and not organization-scoped.',
    });
  }

  next();
};

/**
 * Middleware: silently strip organization_id from query and body on global endpoints
 * instead of rejecting the request. Use this for backward-compatible endpoints where
 * clients may be sending organization_id inadvertently.
 */
export const stripOrgScope = (req, res, next) => {
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'organization_id')) {
    logWarn('organization_scope_guard: organization_id stripped from query on global endpoint', {
      path:   req.originalUrl,
      method: req.method,
      userId: req.user?.user_id ?? null,
    });
    const { organization_id: _removed, ...rest } = req.query;
    req.query = rest;
  }

  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'organization_id')) {
    logWarn('organization_scope_guard: organization_id stripped from body on global endpoint', {
      path:   req.originalUrl,
      method: req.method,
      userId: req.user?.user_id ?? null,
    });
    const { organization_id: _removed, ...rest } = req.body;
    req.body = rest;
  }

  next();
};

/**
 * List of table names that are globally scoped (no organization_id).
 * Used by tests and audit scripts to verify schema compliance.
 */
export const GLOBAL_TABLES = Object.freeze([
  'countries',
  'states',
  'cities',
  'postal_codes',
  'languages',
  'locales',
  'regions',
  'translations',
  'features',
  'feature_permissions',
  'medicines',
  'users',
]);
