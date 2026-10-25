import Joi from "joi";

export const onboardingConfigQuerySchema = Joi.object({
  role_id: Joi.number().integer().required(),
  learning_mode: Joi.string().valid("self", "school").optional(),
});
