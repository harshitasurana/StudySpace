import {
  getAvailabilityTypes,
  getAvailabilityTypeById,
  getAvailabilityTypeByCode,
  createAvailabilityType,
  updateAvailabilityType,
  deleteAvailabilityType,
  seedDefaultAvailabilityTypes,
} from "./feature_availability_service.js";
import HttpError from "../../common/exceptions/HttpError.js";
import {
  createAvailabilityTypeSchema,
  updateAvailabilityTypeSchema,
} from "./feature_availability_validation.js";

export const getAvailabilityTypesController = async (req, res, next) => {
  try {
    const types = await getAvailabilityTypes();
    res.json({
      success: true,
      message: "Availability types retrieved successfully",
      data: types,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

export const getAvailabilityTypeByIdController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const type = await getAvailabilityTypeById(id);

    if (!type) {
      return next(new HttpError("Availability type not found", 404));
    }

    res.json({
      success: true,
      message: "Availability type retrieved successfully",
      data: type,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

export const createAvailabilityTypeController = async (req, res, next) => {
  try {
    const { error, value } = createAvailabilityTypeSchema.validate(req.body);
    if (error) {
      return next(new HttpError(error.details[0].message, 400));
    }

    const userId = req.user?.user_id || null;

    const existing = await getAvailabilityTypeByCode(value.code);
    if (existing) {
      return next(
        new HttpError(
          `Availability type with code '${value.code.toUpperCase()}' already exists`,
          409
        )
      );
    }

    const type = await createAvailabilityType(value, userId);

    res.status(201).json({
      success: true,
      message: "Availability type created successfully",
      data: type,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

export const updateAvailabilityTypeController = async (req, res, next) => {
  try {
    const { error, value } = updateAvailabilityTypeSchema.validate(req.body);
    if (error) {
      return next(new HttpError(error.details[0].message, 400));
    }

    const { id } = req.params;
    const userId = req.user?.user_id || null;

    const updated = await updateAvailabilityType(id, value, userId);

    if (!updated) {
      return next(new HttpError("Availability type not found", 404));
    }

    res.json({
      success: true,
      message: "Availability type updated successfully",
      data: updated,
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};

export const deleteAvailabilityTypeController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.user_id || null;
    await deleteAvailabilityType(id, userId);

    res.json({
      success: true,
      message: "Availability type deleted successfully",
    });
  } catch (error) {
    if (error.message.includes("Cannot delete")) {
      return next(new HttpError(error.message, 400));
    }
    next(new HttpError(error.message, 500));
  }
};

export const seedAvailabilityTypesController = async (req, res, next) => {
  try {
    const userId = req.user?.user_id || null;
    const results = await seedDefaultAvailabilityTypes(userId);

    const created = results.filter((r) => r.isNew).length;
    const existing = results.filter((r) => !r.isNew).length;

    res.json({
      success: true,
      message: `Seeded ${created} new availability type(s), ${existing} already existed`,
      data: results.map((r) => r.type),
    });
  } catch (error) {
    next(new HttpError(error.message, 500));
  }
};
