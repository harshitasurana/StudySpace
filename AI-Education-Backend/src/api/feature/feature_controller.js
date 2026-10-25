import {
  getAllFeaturesService,
  getFeaturesList,
  getFeatureByIdService,
  createFeatureService,
  updateFeatureService,
  deleteFeatureService,
  bulkDeleteFeature,
  getFeaturesStatistics,
  getCategoriesList,
  activateFeatureService,
  deactivateFeatureService,
  filterFeaturesByOrg,
} from "./feature_service.js";
import Feature from "./feature_schema.js";
import { Category } from "../metadata/category/category_schema.js";
import AvailabilityType from "./feature_availability_schema.js";
import User from "../user/user_schema.js";
import { Op } from "sequelize";
import { buildWhere } from "../../common/utils/buildWhere.js";
import { FEATURE_FILTER_SCHEMA } from "./feature.filter.schema.js";
import {
  createFeatureSchema,
  updateFeatureSchema,
  featureIdSchema,
  categorySchema,
  bulkDeleteFeatureSchema,
} from "./feature_validation.js";
import HttpError from "../../common/exceptions/HttpError.js";
import { ERROR_MESSAGES } from "../../common/constants/errors.js";
import { CATEGORY_TYPES } from "../../common/constants/category_types.js";

const mapFeatureWriteError = (error) => {
  if (error.name === 'SequelizeUniqueConstraintError') {
    return new HttpError('Feature already exists', 409);
  }

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return new HttpError(error.message || 'Invalid related resource reference', 400);
  }

  if (error.name === 'SequelizeValidationError') {
    const details = error.errors?.map((item) => item.message).filter(Boolean).join(', ');
    return new HttpError(details || error.message || ERROR_MESSAGES.VALIDATION_FAILED, 400);
  }

  if (error.message.includes("already exists")) {
    return new HttpError(ERROR_MESSAGES.DUPLICATE_RESOURCE, 409);
  }

  if (error.message.includes("Invalid Feature Category")) {
    return new HttpError(error.message, 400);
  }

  return new HttpError(error.message, 500);
};

const getSubscriptionIdFromRequest = (req) => {
  const raw =
    req.query?.subscription_id ||
    req.query?.subscriptionId;

  if (raw === undefined || raw === null || raw === "") return null;

  const subscriptionId = Number(raw);
  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
    throw new HttpError("Invalid subscription scope", 400, "subscription_id must be a positive integer");
  }

  return subscriptionId;
};

const stripFeatureScopeFilters = (filters = {}) => {
  const {
    subscription_id,
    subscriptionId,
    ...featureFilters
  } = filters;

  return featureFilters;
};

const FEATURE_LIST_CONTROL_KEYS = [
  'page',
  'limit',
  'search',
  'sort',
  'sortBy',
  'sortOrder',
  'sort_by',
  'sort_order',
  'subscription_id',
  'subscriptionId',
];

/**
 * Get all features.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getAllFeatures = async (req, res, next) => {
  try {
    // If no pagination or sorting params provided, return full list (backwards-compatible)
    const rawQuery = req.query || {};
    const hasQueryParams = Object.keys(rawQuery).some(k => FEATURE_LIST_CONTROL_KEYS.includes(k) && !['subscription_id', 'subscriptionId'].includes(k));
    const hasFilters = Object.keys(rawQuery).some(k => !FEATURE_LIST_CONTROL_KEYS.includes(k));

    const clientType = req.headers['x-client-type'];
    const subscriptionId = getSubscriptionIdFromRequest(req);

    if (!hasQueryParams) {
      if (!hasFilters) {
        const features = await getAllFeaturesService(clientType);

        return res.status(200).json({
          success: true,
          message: "Features retrieved successfully",
          data: features,
        });
      } else {
        // Apply filters without pagination
        const filters = stripFeatureScopeFilters(req.queryOptions?.filters || {});
        const where = buildWhere({
          baseWhere: filters.is_active !== undefined ? {} : { is_deleted: false },
          search: null,
          filters,
          schema: FEATURE_FILTER_SCHEMA,
        });

        const availabilityInclude = {
          model: AvailabilityType,
          as: 'availabilityTypesList',
          attributes: ['availability_type_id', 'code', 'name'],
          through: { attributes: [] },
          required: false,
        };

        const creatorInclude = {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'first_name', 'last_name'],
          required: false,
        };

        const features = await Feature.findAll({
          where,
          attributes: [
            "feature_id",
            "feature_name",
            "description",
            "category_id",
            "is_active",
            "parent_feature_id",
            "show_in_menu",
            "menu_label",
            "menu_icon",
            "router_link",
            "menu_order",
            "permissions",
            "created_at",
            "updated_at",
          ],
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['name']
            },
            availabilityInclude,
            creatorInclude,
          ],
          order: [["feature_name", "ASC"]],
        });

        // Map to include category_name and availability_types (array)
        const mappedFeatures = features.map(f => {
          const { category, availabilityTypesList, creator, ...rest } = f.toJSON();
          return {
            ...rest,
            category_name: category?.name || null,
            availability_types: Array.isArray(availabilityTypesList) ? availabilityTypesList : [],
            created_by_name: creator ? `${creator.first_name} ${creator.last_name}`.trim() : null,
          };
        });

        const filteredFeatures = await filterFeaturesByOrg(mappedFeatures);

        return res.status(200).json({
          success: true,
          message: "Features retrieved successfully",
          data: filteredFeatures,
        });
      }
    }

    // Validate filters
    const filters = stripFeatureScopeFilters(req.queryOptions?.filters || {});
    // No Joi validation needed - FEATURE_FILTER_SCHEMA handles it via buildWhere
    const value = filters;

    // Validate pagination params
    let limit = req.queryOptions?.limit;
    let offset = req.queryOptions?.offset;
    if (limit === undefined) {
      limit = 10;
    }
    if (offset === undefined) {
      offset = 0;
    }
    if (isNaN(limit) || limit < 1 || limit > 500) {
      return next(new HttpError(ERROR_MESSAGES.VALIDATION_FAILED, 400, "limit must be a number between 1 and 500"));
    }
    if (isNaN(offset) || offset < 0) {
      return next(new HttpError(ERROR_MESSAGES.VALIDATION_FAILED, 400, "page must be a valid number"));
    }

    const options = {
      ...req.queryOptions,
      limit,
      offset,
      filters: value,
    };

    const result = await getFeaturesList(options, clientType);

    res.status(200).json({
      success: true,
      message: "Features retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(error.message, 500));
  }
};

/**
 * Get a feature by ID.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getFeatureById = async (req, res, next) => {
  try {
    const { error, value } = featureIdSchema.validate(req.params);
    if (error) {
      return next(new HttpError(ERROR_MESSAGES.VALIDATION_FAILED, 400, error.details[0].message));
    }

    const { id } = value;
    const feature = await getFeatureByIdService(id);

    res.status(200).json({
      success: true,
      message: "Feature retrieved successfully",
      data: feature,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Create a new feature.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getFeatureCategoryById = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    if (!categoryId || isNaN(categoryId) || parseInt(categoryId) <= 0) {
      return next(new HttpError("Valid category ID is required", 400));
    }

    const { getValidCategories } = await import("./feature_category_validator.js");
    const categories = await getValidCategories();
    const category = categories.find(cat => cat.category_code === categoryId || cat.category_id === parseInt(categoryId));

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Feature category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Feature category retrieved successfully",
      data: category
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

export const createFeature = async (req, res, next) => {
  try {
    const { error, value } = createFeatureSchema.validate(req.body);
    if (error) {
      return next(new HttpError(error.details[0].message, 400));
    }

    const userId = req.user?.user_id || null;
    const feature = await createFeatureService(value, userId);

    res.status(201).json({
      success: true,
      message: "Feature created successfully",
      data: feature,
    });
  } catch (error) {
    next(mapFeatureWriteError(error));
  }
};

/**
 * Update an existing feature.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateFeature = async (req, res, next) => {
  try {
    const paramsValidation = featureIdSchema.validate(req.params);
    const bodyValidation = updateFeatureSchema.validate(req.body);

    if (paramsValidation.error) {
      return next(new HttpError(paramsValidation.error.details[0].message, 400));
    }

    if (bodyValidation.error) {
      return next(new HttpError(bodyValidation.error.details[0].message, 400));
    }

    const { id } = paramsValidation.value;
    const updateData = bodyValidation.value;
    const userId = req.user?.user_id || null;
    const feature = await updateFeatureService(id, updateData, userId);

    res.status(200).json({
      success: true,
      message: "Feature updated successfully",
      data: feature,
    });
  } catch (error) {
    next(mapFeatureWriteError(error));
  }
};

/**
 * Delete a feature by ID.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteFeature = async (req, res, next) => {
  try {
    const { error, value } = featureIdSchema.validate(req.params);
    if (error) {
      return next(new HttpError(ERROR_MESSAGES.VALIDATION_FAILED, 400, error.details[0].message));
    }

    const { id } = value;
    const userRole = req.user?.role_name || null;
    const userId = req.user?.user_id || null;
    await deleteFeatureService(id, { userRole, userId });

    res.status(200).json({
      success: true,
      message: "Feature deleted successfully",
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

/**
 * Get features by category.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getFeaturesByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    if (!categoryId || isNaN(categoryId)) {
      return next(new HttpError('Valid category ID is required', 400));
    }

    const features = await Feature.findAll({
      where: {
        category_id: parseInt(categoryId, 10),
        is_deleted: false,
        is_active: true
      },
      attributes: [
        'feature_id',
        'feature_name',
        'description',
        'category_id',
        'is_active',
        'permissions',
        'created_at',
        'updated_at'
      ],
      order: [['feature_name', 'ASC']]
    });

    res.status(200).json({
      success: true,
      message: 'Features retrieved successfully',
      data: features
    });

  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

// getFeaturesByCategory removed - direct DB query or metadata join
// Route will be handled by feature.filter.schema.js filtering

export const bulkDeleteFeatureController = async (req, res, next) => {
  try {
    const { error, value } = bulkDeleteFeatureSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const featureIds = value.feature_ids;
    const userRole = req.user?.role_name || null;
    const userId = req.user?.user_id || null;
    const deletedCount = await bulkDeleteFeature(featureIds, { userRole, userId });

    res.json({
      success: true,
      message: "Features deleted successfully",
      data: {
        total_requested: featureIds.length,
        total_deleted: deletedCount,
      },
    });
  } catch (error) {
    console.error("Bulk delete feature error:", error);
    if (error.message === "No features found to delete") {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete features",
    });
  }
};

export const getFeaturesStatsController = async (req, res) => {
  try {
    const stats = await getFeaturesStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve feature statistics",
      message: error.message,
    });
  }
};

export const getCategoriesListController = async (req, res) => {
  try {
    const { Category, CategoryType } = await import('../metadata/category/category_schema.js');

    // 1. Properly extract page and limit from query parameters
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);

    // 2. Setup your query options
    const queryOptions = {
      where: { is_active: true }, // Default to only active categories
      include: [{
        model: CategoryType,
        where: { 
          code: CATEGORY_TYPES.FEATURE, // Filter only "feature" category types
          is_active: true 
        },
        attributes: [] // We don't need to return the nested Type object in the response
      }],
      order: [['display_order', 'ASC'], ['name', 'ASC']]
    };

    // Optional: Apply search filter if provided
    if (req.query.search) {
      queryOptions.where.name = { [Op.iLike]: `%${req.query.search}%` };
    }

    // Optional: Apply explicit is_active override if provided
    if (req.query.is_active !== undefined) {
      queryOptions.where.is_active = req.query.is_active === 'true';
    }

    // 3. Only apply pagination if they are actually provided
    if (!isNaN(page) && !isNaN(limit)) {
      queryOptions.limit = limit;
      queryOptions.offset = (page - 1) * limit;
    }

    // 4. Execute the database query
    const { count, rows } = await Category.findAndCountAll(queryOptions);

    // 5. Build dynamic pagination data for the response
    const responseData = {
      success: true,
      message: "Feature categories retrieved successfully",
      data: rows
    };

    if (!isNaN(page) && !isNaN(limit)) {
      responseData.pagination = {
        page: page,
        limit: limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      };
    }

    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve categories list",
      message: error.message,
    });
  }
};


/**
 * Activate a feature.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const activateFeature = async (req, res, next) => {
  try {
    const { error, value } = featureIdSchema.validate(req.params);
    if (error) {
      return next(new HttpError(ERROR_MESSAGES.VALIDATION_FAILED, 400, error.details[0].message));
    }

    const { id } = value;
    const userId = req.user?.user_id || null;
    const feature = await activateFeatureService(id, userId);

    res.status(200).json({
      success: true,
      message: "Feature activated successfully",
      data: feature,
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message.includes("already active")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(new HttpError(error.message, 500));
  }
};

/**
 * Deactivate a feature.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deactivateFeature = async (req, res, next) => {
  try {
    const { error, value } = featureIdSchema.validate(req.params);
    if (error) {
      return next(new HttpError(ERROR_MESSAGES.VALIDATION_FAILED, 400, error.details[0].message));
    }

    const { id } = value;
    const userId = req.user?.user_id || null;
    const feature = await deactivateFeatureService(id, userId);

    res.status(200).json({
      success: true,
      message: "Feature deactivated successfully",
      data: feature,
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message.includes("already inactive")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(new HttpError(error.message, 500));
  }
};
