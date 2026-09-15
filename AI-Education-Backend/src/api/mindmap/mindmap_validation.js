import Joi from "joi";

const MIND_MAP_VARIANT_IDS = [
  "concept_overview",
  "problem_solving_path",
  "compare_contrast",
  "building_blocks",
  "real_world_applications",
];

export const generateMindMapSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  variant: Joi.string()
    .valid(...MIND_MAP_VARIANT_IDS)
    .optional(),
  // "Reopen exactly this past generation" instead of the shared-pool's
  // "give me an unseen one" — see generateMindMapService.
  generation_group_id: Joi.string().guid().optional(),
});

export const mindMapStatusSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  // Required now that several pool groups can coexist for the same
  // chapter+scope (see 20260910f_add_mind_map_slide_deck_pools.sql) — a
  // plain chapter_id lookup would be ambiguous. generateMindMapService's
  // response carries the exact id to poll with.
  generation_group_id: Joi.string().guid().required(),
});
