import Joi from 'joi';

const targetTypes = ['page', 'feature'];

const emptyToNull = (value, helpers) => {
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  return value;
};

export const addFavoriteSchema = Joi.object({
  target_type: Joi.string().valid(...targetTypes).required(),
  target_key: Joi.string().trim().max(150).required(),
  title: Joi.string().trim().max(200).required(),
  route: Joi.string().trim().max(255).allow('', null).custom(emptyToNull).optional(),
  icon: Joi.string().trim().max(120).allow('', null).custom(emptyToNull).optional(),
  page_key: Joi.string().trim().max(150).allow('', null).custom(emptyToNull).optional(),
  feature_id: Joi.number().integer().positive().allow(null).optional(),
  feature_name: Joi.string().trim().max(150).allow('', null).custom(emptyToNull).optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
});

export const removeFavoriteSchema = Joi.object({
  target_type: Joi.string().valid(...targetTypes).required(),
  target_key: Joi.string().trim().max(150).required(),
});

export { targetTypes };
