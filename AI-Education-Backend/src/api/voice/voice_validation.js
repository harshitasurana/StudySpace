import Joi from "joi";

// multer's .single('audio') puts the file on req.file, everything else
// (chapter_id/conversation_id) arrives as multipart text fields on
// req.body — Joi still validates them the same way it would a JSON body.
export const voiceTurnSchema = Joi.object({
  chapter_id: Joi.number().integer().required(),
  conversation_id: Joi.number().integer().allow(null, ""),
});
