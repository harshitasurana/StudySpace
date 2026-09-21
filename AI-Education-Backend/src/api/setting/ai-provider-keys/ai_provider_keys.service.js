import AiProviderKey from "./ai_provider_key_schema.js";
import AiProviderSettings from "./ai_provider_settings_schema.js";

const maskKey = (rawKey) =>
  rawKey && rawKey.length >= 4 ? `••••${rawKey.slice(-4)}` : rawKey ? "••••" : null;

// Admin-facing DTO — api_key is NEVER included, only a derived masked_key.
const toDTO = (row) => ({
  id: row.id,
  provider: row.provider,
  label: row.label,
  masked_key: maskKey(row.api_key),
  model: row.model,
  base_url: row.base_url,
  tier: row.tier,
  is_active: row.is_active,
  priority: row.priority,
  last_used_at: row.last_used_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const listKeys = async (provider) => {
  const rows = await AiProviderKey.findAll({
    where: provider ? { provider } : {},
    order: [["priority", "ASC"], ["created_at", "ASC"]],
  });
  return rows.map(toDTO);
};

export const getKeyById = async (id) => {
  const row = await AiProviderKey.findByPk(id);
  if (!row) throw new Error("AI provider key not found");
  return toDTO(row);
};

export const createKey = async (data, userId) => {
  const row = await AiProviderKey.create({
    ...data,
    created_by: userId,
    updated_by: userId,
  });
  return toDTO(row);
};

export const updateKey = async (id, data, userId) => {
  const row = await AiProviderKey.findByPk(id);
  if (!row) throw new Error("AI provider key not found");
  await row.update({ ...data, updated_by: userId });
  return toDTO(row);
};

export const deleteKey = async (id) => {
  const row = await AiProviderKey.findByPk(id);
  if (!row) throw new Error("AI provider key not found");
  await row.destroy();
};

export const toggleKey = async (id, userId) => {
  const row = await AiProviderKey.findByPk(id);
  if (!row) throw new Error("AI provider key not found");
  await row.update({ is_active: !row.is_active, updated_by: userId });
  return toDTO(row);
};

// Internal — called only from the verifyServiceKey-protected route.
// Returns RAW api_key values, ordered for priority fallback. Never
// exposed through any admin-authenticated path.
export const getActiveKeysRaw = async (provider = "gemini") => {
  const rows = await AiProviderKey.findAll({
    where: { provider, is_active: true },
    order: [["priority", "ASC"], ["created_at", "ASC"]],
    attributes: ["id", "api_key", "model", "base_url", "tier", "label"],
  });

  if (rows.length) {
    // Best-effort usage tracking for the admin list view — not on the
    // critical path, a failure here must never block the actual response.
    AiProviderKey.update(
      { last_used_at: new Date() },
      { where: { id: rows.map((r) => r.id) } }
    ).catch(() => {});
  }

  return rows.map((r) => ({
    id: r.id,
    api_key: r.api_key,
    model: r.model,
    base_url: r.base_url,
    tier: r.tier,
    label: r.label,
  }));
};

// Single-row settings table — see ai_provider_settings_schema.js.
export const getActiveProvider = async () => {
  const row = await AiProviderSettings.findByPk(1);
  return row?.active_provider || "gemini";
};

export const setActiveProvider = async (provider, userId) => {
  const [row] = await AiProviderSettings.findOrCreate({
    where: { id: 1 },
    defaults: { active_provider: provider, updated_by: userId },
  });
  await row.update({ active_provider: provider, updated_by: userId });
  return row.active_provider;
};
