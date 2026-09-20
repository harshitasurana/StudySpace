import Joi from "joi";
import { SEARCH_CATEGORIES, SEARCH_ENTITIES } from "./search_service.js";

export const searchQuerySchema = Joi.object({
  q: Joi.string().trim().min(1).required(),
  entity: Joi.string().valid(...SEARCH_ENTITIES.map((item) => item.key)).optional(),
  category: Joi.string().valid(...SEARCH_CATEGORIES).optional(),
  limit: Joi.number().integer().min(1).max(500).default(20),
  per_entity_limit: Joi.number().integer().min(1).max(25).default(5),
  client_type: Joi.string().valid("REACT", "ANGULAR", "BOTH", "MOBILE", "DESKTOP", "API").optional(),
});
