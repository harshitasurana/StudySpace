import Joi from "joi";

export const generateSlideDeckSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  // "Reopen exactly this past deck" instead of the shared-pool's "give
  // me an unseen one" — see generateSlideDeckService.
  slide_deck_id: Joi.number().integer().optional(),
});

export const slideDeckStatusSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  // Required now that several decks can coexist for the same
  // chapter+scope (see 20260910f_add_mind_map_slide_deck_pools.sql) — a
  // plain chapter_id lookup would be ambiguous. generateSlideDeckService's
  // response carries the exact id to poll with.
  slide_deck_id: Joi.number().integer().required(),
});
