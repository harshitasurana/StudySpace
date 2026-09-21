import Joi from "joi";
import { PROVIDER_CODES } from "./ai_provider_catalog.js";

// api_key is required unless the chosen provider is one of the local ones
// (ollama/lm_studio/vllm — see ai_provider_catalog.js's requiresApiKey) —
// Joi.when can only branch on the value of a sibling field, so the local
// provider codes are enumerated directly here rather than importing the
// helper (avoids importing PROVIDER_CATALOG's non-serializable shape into
// a validation `.valid(...)` list).
const LOCAL_PROVIDERS = ["ollama", "lm_studio", "vllm"];

export const createKeySchema = Joi.object({
  provider: Joi.string().valid(...PROVIDER_CODES).default("gemini"),
  label: Joi.string().max(150).required(),
  api_key: Joi.string().min(10).when("provider", {
    is: Joi.valid(...LOCAL_PROVIDERS),
    then: Joi.optional().allow("", null),
    otherwise: Joi.required(),
  }),
  model: Joi.string().max(150).allow("", null),
  base_url: Joi.string().uri().max(500).allow("", null),
  tier: Joi.string().valid("free", "pro").default("free"),
  priority: Joi.number().integer().min(0).default(100),
  is_active: Joi.boolean().default(true),
});

export const updateKeySchema = Joi.object({
  provider: Joi.string().valid(...PROVIDER_CODES),
  label: Joi.string().max(150),
  api_key: Joi.string().min(10).allow("", null),
  model: Joi.string().max(150).allow("", null),
  base_url: Joi.string().uri().max(500).allow("", null),
  tier: Joi.string().valid("free", "pro"),
  priority: Joi.number().integer().min(0),
  is_active: Joi.boolean(),
}).min(1);

export const setActiveProviderSchema = Joi.object({
  active_provider: Joi.string().valid(...PROVIDER_CODES).required(),
});
