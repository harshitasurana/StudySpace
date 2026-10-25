import Joi from "joi";

export const updateProfileSchema = Joi.object({
  first_name: Joi.string().max(100),
  last_name: Joi.string().max(100),
  title: Joi.string().max(100).allow(null, ""),
  email: Joi.string().email().max(255),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]*$/)
    .max(20)
    .allow(null, ""),
  department_id: Joi.number().integer().positive(),
  two_fa: Joi.boolean(),
  location: Joi.string().max(255).allow(null, ""),
}).min(1);

export const updateAvatarSchema = Joi.object({
  // Avatar validation will be handled by multer in controller
}).unknown(true);

export const updateSecuritySchema = Joi.object({
  currentPassword: Joi.string().required().min(1),
  newPassword: Joi.string().required().min(6),
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
    'any.only': 'Confirm New Password must match New Password'
  })
});
