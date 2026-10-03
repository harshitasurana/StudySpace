import React, { useCallback, useEffect, useState } from "react";
import * as aiProviderKeysService from "../../services/aiProviderKeysService.js";
import AiProviderKeysForm from "./AiProviderKeysForm.jsx";
import "../categories/categories.css";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AiProviderKeysList = () => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [catalog, setCatalog] = useState({});
  const [activeProvider, setActiveProviderState] = useState(null);
  const [savingActiveProvider, setSavingActiveProvider] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create"); // 'create' | 'edit'
  const [formInitialData, setFormInitialData] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiProviderKeysService.getAiProviderKeys();
      setKeys(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load AI provider keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
    aiProviderKeysService.getProviderCatalog().then(setCatalog).catch(() => setCatalog({}));
    aiProviderKeysService.getActiveProvider().then(setActiveProviderState).catch(() => {});
  }, [loadKeys]);

  const handleActiveProviderChange = async (provider) => {
    const previous = activeProvider;
    setActiveProviderState(provider);
    setSavingActiveProvider(true);
    try {
      await aiProviderKeysService.setActiveProvider(provider);
      showToast("success", `${catalog[provider]?.label || provider} is now the active AI provider`);
    } catch (err) {
      setActiveProviderState(previous);
      showToast("error", err?.response?.data?.error || "Failed to change active provider");
    } finally {
      setSavingActiveProvider(false);
    }
  };

  /* ------------------------------- Create ------------------------------- */

  const openCreate = () => {
    setFormMode("create");
    setFormInitialData(null);
    setFormOpen(true);
  };

  /* -------------------------------- Edit --------------------------------- */

  const openEdit = (key) => {
    setFormMode("edit");
    setFormInitialData(key);
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload) => {
    setFormSaving(true);
    try {
      if (formMode === "create") {
        await aiProviderKeysService.createAiProviderKey(payload);
        showToast("success", "AI provider key created");
      } else {
        await aiProviderKeysService.updateAiProviderKey(formInitialData.id, payload);
        showToast("success", "AI provider key updated");
      }
      setFormOpen(false);
      await loadKeys();
    } catch (err) {
      showToast("error", err?.response?.data?.error || "Failed to save AI provider key");
    } finally {
      setFormSaving(false);
    }
  };

  /* -------------------------------- Toggle -------------------------------- */

  const handleToggleStatus = async (key) => {
    try {
      await aiProviderKeysService.toggleAiProviderKey(key.id);
      showToast("success", `${key.label} ${key.is_active ? "deactivated" : "activated"}`);
      await loadKeys();
    } catch (err) {
      showToast("error", err?.response?.data?.error || "Failed to update key status");
    }
  };

  /* -------------------------------- Delete --------------------------------- */

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await aiProviderKeysService.deleteAiProviderKey(deleteTarget.id);
      showToast("success", "AI provider key deleted");
      setDeleteTarget(null);
      await loadKeys();
    } catch (err) {
      showToast("error", err?.response?.data?.error || "Failed to delete AI provider key");
    } finally {
      setDeleting(false);
    }
  };

  /* -------------------------------- Render -------------------------------- */

  return (
    <div>
      <div className="cat-header">
        <div>
          <h2 className="cat-header-title">AI Provider Keys</h2>
          <p className="cat-header-subtitle">
            Configure any cloud or local AI provider for the AI Tutor. Falls back to the local
            model automatically when the active provider has no working key.
          </p>
        </div>
        <button type="button" className="cat-btn cat-btn-primary" onClick={openCreate}>
          <i className="bi bi-plus-lg" />
          New Key
        </button>
      </div>

      <div className="cat-form-group" style={{ maxWidth: 420, marginBottom: "1.25rem" }}>
        <label htmlFor="active-provider-select">Active Provider</label>
        <select
          id="active-provider-select"
          value={activeProvider || ""}
          onChange={(e) => handleActiveProviderChange(e.target.value)}
          disabled={savingActiveProvider || Object.keys(catalog).length === 0}
        >
          {Object.entries(catalog).map(([code, meta]) => (
            <option key={code} value={code}>
              {meta.label}
            </option>
          ))}
        </select>
        <p className="cat-form-hint">
          The AI Tutor calls this provider's active key(s) first, falling back to the local model
          if none work.
        </p>
      </div>

      {loading && (
        <div className="cat-state">
          <div className="cat-spinner" />
          <p>Loading AI provider keys…</p>
        </div>
      )}

      {!loading && error && (
        <div className="cat-state error">
          <i className="bi bi-exclamation-triangle" />
          <p>{error}</p>
          <button type="button" className="cat-btn cat-btn-secondary" onClick={loadKeys}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && keys.length === 0 && (
        <div className="cat-state">
          <i className="bi bi-key" />
          <p>No AI provider keys configured yet. All AI responses currently use the local model.</p>
        </div>
      )}

      {!loading && !error && keys.length > 0 && (
        <div className="cat-table-wrap">
          <table className="cat-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Tier</th>
                <th>Priority</th>
                <th>Key</th>
                <th>Status</th>
                <th>Last Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.label}</td>
                  <td>{catalog[key.provider]?.label || key.provider}</td>
                  <td>{key.model || "—"}</td>
                  <td>
                    <span className={`cat-badge ${key.tier === "pro" ? "active" : "inactive"}`}>
                      {key.tier === "pro" ? "Pro" : "Free"}
                    </span>
                  </td>
                  <td>{key.priority}</td>
                  <td>
                    <code>{key.masked_key || "—"}</code>
                  </td>
                  <td>
                    <span className={`cat-badge ${key.is_active ? "active" : "inactive"}`}>
                      {key.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{formatDate(key.last_used_at)}</td>
                  <td>
                    <div className="cat-table-actions">
                      <button
                        type="button"
                        className="cat-icon-btn"
                        title={key.is_active ? "Deactivate" : "Activate"}
                        onClick={() => handleToggleStatus(key)}
                      >
                        <i className={key.is_active ? "bi bi-pause-circle" : "bi bi-play-circle"} />
                      </button>
                      <button
                        type="button"
                        className="cat-icon-btn"
                        title="Edit"
                        onClick={() => openEdit(key)}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className="cat-icon-btn danger"
                        title="Delete"
                        onClick={() => setDeleteTarget(key)}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <AiProviderKeysForm
          mode={formMode}
          initialData={formInitialData}
          catalog={catalog}
          saving={formSaving}
          onSubmit={handleFormSubmit}
          onClose={() => setFormOpen(false)}
        />
      )}

      {deleteTarget && (
        <div className="cat-modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="cat-modal cat-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="cat-modal-header">
              <h3>Delete AI Provider Key?</h3>
              <button
                type="button"
                className="cat-modal-close"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="cat-modal-body">
              <p style={{ margin: 0, color: "#374151" }}>
                Are you sure you want to delete <strong>{deleteTarget.label}</strong>? This action
                cannot be undone.
              </p>
            </div>
            <div className="cat-modal-footer">
              <button
                type="button"
                className="cat-btn cat-btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cat-btn cat-btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`cat-toast ${toast.type}`}>
          <i className={toast.type === "success" ? "bi bi-check-circle" : "bi bi-x-circle"} />
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default AiProviderKeysList;
