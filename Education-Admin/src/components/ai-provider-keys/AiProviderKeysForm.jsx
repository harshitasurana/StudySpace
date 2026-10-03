import React, { useEffect, useMemo, useState } from "react";

const emptyForm = {
  provider: "gemini",
  label: "",
  api_key: "",
  model: "",
  base_url: "",
  tier: "free",
  priority: 100,
  is_active: true,
};

const CATEGORY_LABELS = {
  cloud: "Cloud Providers",
  fast_inference: "Fast Inference (OpenAI-compatible)",
  local: "Local / On-Premise",
};

const MODEL_PLACEHOLDER = {
  gemini: "e.g. gemini-1.5-pro",
  openai: "e.g. gpt-4o",
  anthropic: "e.g. claude-3-5-sonnet-20240620",
  mistral: "e.g. mistral-large-latest",
  groq: "e.g. llama3-70b-8192",
  together: "e.g. meta-llama/Meta-Llama-3.1-8B-Instruct",
  deepseek: "e.g. deepseek-chat",
  openrouter: "e.g. openai/gpt-4o",
  ollama: "e.g. llama3.1",
  lm_studio: "e.g. the model loaded in LM Studio",
  vllm: "e.g. the model vLLM was started with",
};

/**
 * Create / Edit modal for an AI provider key. `mode` is 'create' or
 * 'edit'. When editing, `initialData` is the row from the list (already
 * carries `masked_key` instead of the raw key — the raw key is never
 * sent to the browser). `catalog` is the provider metadata from
 * GET /admin/ai-provider-keys/catalog (category, requiresApiKey,
 * defaultBaseUrl per provider code) — drives which fields this form
 * shows/requires for the currently selected provider.
 */
const AiProviderKeysForm = ({ mode, initialData, catalog, saving, onSubmit, onClose }) => {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setForm({
        provider: initialData.provider || "gemini",
        label: initialData.label || "",
        api_key: "",
        model: initialData.model || "",
        base_url: initialData.base_url || "",
        tier: initialData.tier || "free",
        priority: initialData.priority ?? 100,
        is_active: initialData.is_active ?? true,
      });
    } else if (mode === "create") {
      setForm(emptyForm);
    }
  }, [mode, initialData]);

  const providerMeta = catalog?.[form.provider];
  const requiresApiKey = providerMeta?.requiresApiKey ?? true;
  // A provider that isn't purely "cloud" needs a base URL either to reach
  // a custom OpenAI-compatible endpoint (fast inference) or because it has
  // no fixed one at all (local).
  const showsBaseUrl = providerMeta?.category === "fast_inference" || providerMeta?.category === "local";

  const groupedProviders = useMemo(() => {
    const groups = { cloud: [], fast_inference: [], local: [] };
    for (const [code, meta] of Object.entries(catalog || {})) {
      (groups[meta.category] ||= []).push({ code, ...meta });
    }
    return groups;
  }, [catalog]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleProviderChange = (code) => {
    const meta = catalog?.[code];
    setForm((prev) => ({
      ...prev,
      provider: code,
      // Pre-fill the well-known default endpoint when the admin hasn't
      // typed their own — never overwrites a value they already entered.
      base_url: prev.base_url || meta?.defaultBaseUrl || "",
    }));
    setErrors((prev) => ({ ...prev, provider: undefined, api_key: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.label || !form.label.trim()) next.label = "Label is required";
    if (mode === "create" && requiresApiKey && !form.api_key.trim()) {
      next.api_key = "API key is required for this provider";
    }
    if (showsBaseUrl && !form.base_url.trim()) {
      next.base_url = "Base URL is required for this provider";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      provider: form.provider,
      label: form.label.trim(),
      model: form.model.trim() || null,
      base_url: showsBaseUrl ? form.base_url.trim() || null : null,
      tier: form.tier,
      priority: Number(form.priority) || 0,
    };

    // Only send api_key if the user actually typed a new one — leaving it
    // blank in edit mode keeps the currently stored key unchanged.
    if (form.api_key.trim()) {
      payload.api_key = form.api_key.trim();
    }

    if (mode === "edit") {
      payload.is_active = !!form.is_active;
    }

    onSubmit(payload);
  };

  const title = mode === "create" ? "New AI Provider Key" : "Edit AI Provider Key";

  return (
    <div className="cat-modal-overlay" onClick={() => !saving && onClose()}>
      <div className="cat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cat-modal-header">
          <h3>{title}</h3>
          <button type="button" className="cat-modal-close" onClick={onClose} disabled={saving}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cat-modal-body">
            <div className="cat-form-group">
              <label htmlFor="key-provider">
                Provider <span className="req">*</span>
              </label>
              <select
                id="key-provider"
                value={form.provider}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                {Object.entries(groupedProviders).map(([category, providers]) =>
                  providers.length === 0 ? null : (
                    <optgroup key={category} label={CATEGORY_LABELS[category] || category}>
                      {providers.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  )
                )}
              </select>
            </div>

            <div className="cat-form-group">
              <label htmlFor="key-label">
                Label <span className="req">*</span>
              </label>
              <input
                id="key-label"
                type="text"
                value={form.label}
                onChange={(e) => setField("label", e.target.value)}
                placeholder="e.g. Primary Production Key"
              />
              {errors.label && <p className="cat-form-error">{errors.label}</p>}
            </div>

            {requiresApiKey && (
              <div className="cat-form-group">
                <label htmlFor="key-api-key">
                  API Key {mode === "create" && <span className="req">*</span>}
                </label>
                <input
                  id="key-api-key"
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setField("api_key", e.target.value)}
                  placeholder={
                    mode === "edit" ? initialData?.masked_key || "••••" : "Paste the provider's secret API key"
                  }
                />
                {mode === "edit" && (
                  <p className="cat-form-hint">Leave blank to keep the current key</p>
                )}
                {errors.api_key && <p className="cat-form-error">{errors.api_key}</p>}
              </div>
            )}

            <div className="cat-form-group">
              <label htmlFor="key-model">Model</label>
              <input
                id="key-model"
                type="text"
                value={form.model}
                onChange={(e) => setField("model", e.target.value)}
                placeholder={MODEL_PLACEHOLDER[form.provider] || "Model identifier"}
              />
            </div>

            {showsBaseUrl && (
              <div className="cat-form-group">
                <label htmlFor="key-base-url">
                  Base URL <span className="req">*</span>
                </label>
                <input
                  id="key-base-url"
                  type="text"
                  value={form.base_url}
                  onChange={(e) => setField("base_url", e.target.value)}
                  placeholder="e.g. http://localhost:11434/v1"
                />
                {errors.base_url && <p className="cat-form-error">{errors.base_url}</p>}
              </div>
            )}

            <div className="cat-form-group">
              <label htmlFor="key-tier">Tier</label>
              <select
                id="key-tier"
                value={form.tier}
                onChange={(e) => setField("tier", e.target.value)}
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            <div className="cat-form-group">
              <label htmlFor="key-priority">Priority</label>
              <input
                id="key-priority"
                type="number"
                value={form.priority}
                onChange={(e) => setField("priority", e.target.value)}
              />
              <p className="cat-form-hint">Lower numbers are tried first, within this provider</p>
            </div>

            {mode === "edit" && (
              <div className="cat-form-group">
                <label>Status</label>
                <div className="cat-form-row">
                  <label className="cat-switch">
                    <input
                      type="checkbox"
                      checked={!!form.is_active}
                      onChange={(e) => setField("is_active", e.target.checked)}
                    />
                    <span className="cat-switch-track" />
                  </label>
                  <span>{form.is_active ? "Active" : "Inactive"}</span>
                </div>
              </div>
            )}
          </div>

          <div className="cat-modal-footer">
            <button
              type="button"
              className="cat-btn cat-btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="cat-btn cat-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AiProviderKeysForm;
