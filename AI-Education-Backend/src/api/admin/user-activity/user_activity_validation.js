import Joi from "joi";

export const listUserActivityQuerySchema = Joi.object({
  search: Joi.string().trim().max(100).optional().allow(""),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid("name", "last_active_at", "active_seconds", "sessions_count", "action_count").default("last_active_at"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  // Lookback window for the session/time aggregation — kept small by
  // default since the underlying query scans audit_logs directly (no
  // pre-aggregated rollup table); 90 days caps it well short of anything
  // that would meaningfully slow the admin list down.
  days: Joi.number().integer().min(1).max(90).default(7),
});

export const userActivityDetailQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(90).default(30),
});
