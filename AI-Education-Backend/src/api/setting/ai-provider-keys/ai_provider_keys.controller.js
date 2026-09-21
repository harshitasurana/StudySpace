import * as aiProviderKeysService from "./ai_provider_keys.service.js";
import { createKeySchema, updateKeySchema, setActiveProviderSchema } from "./ai_provider_keys.validation.js";
import { PROVIDER_CATALOG } from "./ai_provider_catalog.js";

export const listKeysController = async (req, res) => {
  try {
    const keys = await aiProviderKeysService.listKeys(req.query.provider);
    res.json({ success: true, data: keys });
  } catch (error) {
    console.error("List AI provider keys error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch AI provider keys" });
  }
};


export const getKeyController = async (req, res) => {
  try {
    const key = await aiProviderKeysService.getKeyById(req.params.id);
    res.json({ success: true, data: key });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: "Failed to fetch AI provider key" });
  }
};

export const createKeyController = async (req, res) => {
  try {
    const { error, value } = createKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const key = await aiProviderKeysService.createKey(value, req.user.user_id);
    res.status(201).json({ success: true, message: "AI provider key created", data: key });
  } catch (error) {
    console.error("Create AI provider key error:", error);
    res.status(500).json({ success: false, error: "Failed to create AI provider key" });
  }
};

export const updateKeyController = async (req, res) => {
  try {
    const body = { ...req.body };
    // The Admin UI's masked-secret field sends back the placeholder
    // ("••••1234") unchanged when the user didn't type a new key — strip
    // it BEFORE validation, since the placeholder is shorter than a real
    // key and would otherwise fail api_key's min-length check.
    if (typeof body.api_key === "string" && body.api_key.startsWith("••••")) {
      delete body.api_key;
    }
    const { error, value } = updateKeySchema.validate(body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const key = await aiProviderKeysService.updateKey(req.params.id, value, req.user.user_id);
    res.json({ success: true, message: "AI provider key updated", data: key });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: "Failed to update AI provider key" });
  }
};

export const deleteKeyController = async (req, res) => {
  try {
    await aiProviderKeysService.deleteKey(req.params.id);
    res.json({ success: true, message: "AI provider key deleted" });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: "Failed to delete AI provider key" });
  }
};

export const toggleKeyController = async (req, res) => {
  try {
    const key = await aiProviderKeysService.toggleKey(req.params.id, req.user.user_id);
    res.json({
      success: true,
      message: `AI provider key ${key.is_active ? "activated" : "deactivated"}`,
      data: key,
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: "Failed to toggle AI provider key" });
  }
};

// Internal — RAGProductionApp's llm_provider.py polls this (service-key
// protected, see ai_provider_keys.routes.js). Returns raw keys, never
// reachable via any admin-authenticated path.
export const getActiveKeysInternalController = async (req, res) => {
  try {
    const provider = req.query.provider || "gemini";
    const keys = await aiProviderKeysService.getActiveKeysRaw(provider);
    res.json({ success: true, data: keys });
  } catch (error) {
    console.error("Get active AI provider keys error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch active AI provider keys" });
  }
};

export const getProviderCatalogController = async (_req, res) => {
  res.json({ success: true, data: PROVIDER_CATALOG });
};

export const getActiveProviderController = async (req, res) => {
  try {
    const active_provider = await aiProviderKeysService.getActiveProvider();
    res.json({ success: true, data: { active_provider } });
  } catch (error) {
    console.error("Get active AI provider error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch active AI provider" });
  }
};

export const setActiveProviderController = async (req, res) => {
  try {
    const { error, value } = setActiveProviderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    const active_provider = await aiProviderKeysService.setActiveProvider(value.active_provider, req.user.user_id);
    res.json({ success: true, message: "Active AI provider updated", data: { active_provider } });
  } catch (error) {
    console.error("Set active AI provider error:", error);
    res.status(500).json({ success: false, error: "Failed to set active AI provider" });
  }
};

// Internal — RAGProductionApp polls this alongside /internal/active to
// know WHICH provider's keys to fetch. Same service-key protection.
export const getActiveProviderInternalController = async (req, res) => {
  try {
    const active_provider = await aiProviderKeysService.getActiveProvider();
    res.json({ success: true, data: { active_provider } });
  } catch (error) {
    console.error("Get active AI provider (internal) error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch active AI provider" });
  }
};
