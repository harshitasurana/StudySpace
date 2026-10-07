import { useEffect, useRef, useState } from "react";
import {
  getAllFeaturesForMenuEditing,
  getFeatureCategoryOptions,
  getMenuTree,
  updateMenuFeatureDetails,
  updateMenuOrder,
} from "../../services/menuService.js";
import { getApiErrorMessage } from "../../services/errorMessage.js";
import ToastMessage from "../../shared/component/ToastMessage.jsx";
import { useRBAC } from "../../shared/component/RBACProvider.jsx";
import IconRenderer from "../../shared/component/IconRenderer.jsx";
import { FaCodeBranch, FaArrowUp, FaArrowDown, FaSave, FaKeyboard, FaExpand, FaCompress, FaSync, FaUndo, FaDatabase, FaLayerGroup, FaBars } from "react-icons/fa";
import "./MenuOrderingPage.css";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";
const SURFACE = "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,250,253,0.98) 100%)";

const renumberTree = (items = [], parentId = null) =>
  items.map((item, index) => ({
    ...item,
    parent_feature_id: parentId,
    menu_order: index + 1,
    items: renumberTree(item.items || [], Number(item.feature_id)),
  }));

const deepEqualMenu = (left = [], right = []) => JSON.stringify(left) === JSON.stringify(right);

const normalizePermissionList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const flattenByFeatureId = (items = [], map = new Map()) => {
  items.forEach((item) => {
    map.set(Number(item.feature_id), item);
    flattenByFeatureId(item.items || [], map);
  });
  return map;
};

const collectFeaturePayloadUpdates = (currentMenu = [], originalMenu = []) => {
  const current = flattenByFeatureId(currentMenu);
  const original = flattenByFeatureId(originalMenu);
  const updates = [];

  current.forEach((item, featureId) => {
    const base = original.get(featureId);
    if (!base) return;

    const payload = {};
    const currentName = (item.feature_name ?? "").trim();
    const baseName = (base.feature_name ?? "").trim();
    const currentDescription = (item.description ?? "").trim();
    const baseDescription = (base.description ?? "").trim();
    const currentCategoryId =
      item.category_id === "" || item.category_id === undefined || item.category_id === null
        ? null
        : Number(item.category_id);
    const baseCategoryId =
      base.category_id === "" || base.category_id === undefined || base.category_id === null
        ? null
        : Number(base.category_id);
    const currentParentId =
      item.parent_feature_id === "" || item.parent_feature_id === undefined || item.parent_feature_id === null
        ? null
        : Number(item.parent_feature_id);
    const baseParentId =
      base.parent_feature_id === "" || base.parent_feature_id === undefined || base.parent_feature_id === null
        ? null
        : Number(base.parent_feature_id);
    const currentActive = Boolean(item.is_active);
    const baseActive = Boolean(base.is_active);
    const currentLabel = (item.menu_label ?? item.label ?? "").trim();
    const baseLabel = (base.menu_label ?? base.label ?? "").trim();
    const currentRoute = (item.router_link ?? "").trim();
    const baseRoute = (base.router_link ?? "").trim();
    const currentIcon = (item.menu_icon ?? item.icon ?? "").trim();
    const baseIcon = (base.menu_icon ?? base.icon ?? "").trim();
    const currentShow = Boolean(item.show_in_menu);
    const baseShow = Boolean(base.show_in_menu);
    const currentPermissions = normalizePermissionList(item.permissions);
    const basePermissions = normalizePermissionList(base.permissions);

    if (currentName !== baseName) payload.feature_name = currentName;
    if (currentDescription !== baseDescription) payload.description = currentDescription;
    if (currentCategoryId !== baseCategoryId) payload.category_id = currentCategoryId;
    if (currentParentId !== baseParentId) payload.parent_feature_id = currentParentId;
    if (currentActive !== baseActive) payload.is_active = currentActive;
    if (currentLabel !== baseLabel) payload.menu_label = currentLabel;
    if (currentRoute !== baseRoute) payload.router_link = currentRoute;
    if (currentIcon !== baseIcon) payload.menu_icon = currentIcon;
    if (currentShow !== baseShow) payload.show_in_menu = currentShow;
    if (JSON.stringify(currentPermissions) !== JSON.stringify(basePermissions)) payload.permissions = currentPermissions;

    if (Object.keys(payload).length > 0) {
      updates.push({ feature_id: featureId, payload });
    }
  });

  return updates;
};

const moveNode = (items = [], path = [], direction = -1) => {
  if (path.length === 0) return items;

  const [index, ...rest] = path;
  const next = items.map((item) => ({ ...item, items: [...(item.items || [])] }));

  if (rest.length === 0) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= next.length) return items;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return renumberTree(next, next[0]?.parent_feature_id ?? null);
  }

  next[index] = {
    ...next[index],
    items: moveNode(next[index].items || [], rest, direction),
  };

  return renumberTree(next, next[0]?.parent_feature_id ?? null);
};

const flattenCount = (items = []) =>
  items.reduce((count, item) => count + 1 + flattenCount(item.items || []), 0);

const updateNodeAtPath = (items = [], path = [], updater) => {
  if (!Array.isArray(items) || path.length === 0) return items;

  const [index, ...rest] = path;
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    if (rest.length === 0) return updater(item);
    return {
      ...item,
      items: updateNodeAtPath(item.items || [], rest, updater),
    };
  });
};

const getNodeAtPath = (items = [], path = []) => {
  if (!Array.isArray(items) || path.length === 0) return null;

  let current = null;
  let level = items;
  for (const index of path) {
    current = level?.[index] || null;
    if (!current) return null;
    level = current.items || [];
  }

  return current;
};

const enrichMenuWithFeatureDetails = (items = [], detailsMap = new Map(), parentId = null) =>
  items.map((item) => {
    const featureId = Number(item.feature_id);
    const details = detailsMap.get(featureId) || {};

    return {
      ...item,
      feature_name: details.feature_name || item.feature_name || item.label || "",
      description: details.description || item.description || "",
      category_id:
        details.category_id === undefined
          ? item.category_id ?? null
          : details.category_id,
      parent_feature_id: parentId,
      is_active: details.is_active === undefined ? item.is_active ?? true : Boolean(details.is_active),
      show_in_menu: details.show_in_menu === undefined ? item.show_in_menu ?? true : Boolean(details.show_in_menu),
      menu_label: details.menu_label || item.menu_label || item.label || "",
      menu_icon: details.menu_icon || item.menu_icon || item.icon || "",
      router_link: details.router_link || item.router_link || "",
      permissions: Array.isArray(details.permissions)
        ? details.permissions
        : Array.isArray(item.permissions)
          ? item.permissions
          : [],
      items: enrichMenuWithFeatureDetails(item.items || [], detailsMap, featureId),
    };
  });

const collectKeys = (items = [], prefix = [], result = {}, expanded = true) => {
  items.forEach((item, index) => {
    const path = [...prefix, index];
    result[path.join("-")] = expanded;
    if (item.items?.length) collectKeys(item.items, path, result, expanded);
  });
  return result;
};

const humanizeLabel = (value) => {
  if (!value) return "Untitled";

  const raw = String(value).trim();
  const stripped = raw.includes(".") ? raw.split(".").pop() : raw;

  return stripped
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
};

const normalizeRoute = (route) => {
  if (!route) return "No route";
  const value = String(route).trim();
  if (!value) return "No route";
  return value.startsWith("/") ? value : `/${value}`;
};


const TreeNode = ({
  item,
  path,
  onMove,
  isExpanded,
  expandedKeys,
  onToggle,
  editingKey,
  onEditStart,
  onEditCancel,
  onFieldChange,
  onUpdateFeature,
  updatingFeatureId,
  notice,
  categoryOptions,
  featureOptions,
}) => {
  const hasChildren = Array.isArray(item.items) && item.items.length > 0;
  const depth = path.length - 1;
  const key = path.join("-");
  const label = humanizeLabel(item.menu_label || item.label);
  const route = normalizeRoute(item.router_link);
  const isEditing = editingKey === key;
  const iconClass = item.menu_icon || item.icon || (depth === 0 ? "bi bi-grid" : "bi bi-dot");
  const isUpdating = Number(updatingFeatureId) === Number(item.feature_id);

  return (
    <div className="hc-menu-tree-node" style={{ marginTop: depth === 0 ? 0 : 14 }}>
      <div
        className="hc-menu-node-card"
        style={{
          marginLeft: depth * 18,
          background:
            depth === 0
              ? SURFACE
              : "linear-gradient(180deg, rgba(247,250,252,0.96) 0%, rgba(239,246,251,0.98) 100%)",
        }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 p-3 p-md-4">
          <div className="d-flex align-items-start gap-3 flex-grow-1">
            <div
              className="hc-menu-node-icon d-flex align-items-center justify-content-center"
              style={{
                background: depth === 0 ? BRAND : "rgba(26,112,155,0.12)",
                color: depth === 0 ? "#fff" : "#1a709b",
                flexShrink: 0,
              }}
            >
              <IconRenderer icon={iconClass} />
            </div>

            <div className="flex-grow-1">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span className="hc-menu-order-badge">#{item.menu_order}</span>
                <h6 className="mb-0 fw-bold" style={{ color: "#0d3a5c", fontSize: "1rem" }}>
                  {label}
                </h6>
                {hasChildren && (
                  <span className="hc-menu-soft-chip">
                    {item.items.length} sub item{item.items.length > 1 ? "s" : ""}
                  </span>
                )}
                {depth > 0 && <span className="hc-menu-soft-chip hc-menu-soft-chip-accent">Nested</span>}
                {!item.show_in_menu && <span className="hc-menu-soft-chip hc-menu-soft-chip-warn">Hidden in menu</span>}
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2 gap-md-3">
                <span className="hc-menu-route-pill">
                  <FaCodeBranch className="me-2" />
                  {route}
                </span>
                <span className="hc-menu-meta-inline">Feature #{item.feature_id}</span>
                <span className="hc-menu-meta-inline">Name: {item.feature_name || "N/A"}</span>
                <span className="hc-menu-meta-inline">Level {depth + 1}</span>
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            {hasChildren && (
              <button type="button" className="hc-menu-action-btn" onClick={() => onToggle(key)}>
                <i className={`bi ${isExpanded ? "bi-chevron-up" : "bi-chevron-down"} me-1`}></i>
                {isExpanded ? "Collapse" : "Expand"}
              </button>
            )}
            <div className="hc-menu-move-cluster">
              <button
                type="button"
                className="hc-menu-move-btn"
                onClick={() => (isEditing ? onEditCancel() : onEditStart(key))}
                aria-label={`Edit ${label}`}
                title="Edit details"
              >
                <i className={`bi ${isEditing ? "bi-x-lg" : "bi-pencil"}`}></i>
              </button>
              <button
                type="button"
                className="hc-menu-move-btn"
                onClick={() => onMove(path, -1)}
                aria-label={`Move ${label} up`}
              >
                <FaArrowUp />
              </button>
              <button
                type="button"
                className="hc-menu-move-btn"
                onClick={() => onMove(path, 1)}
                aria-label={`Move ${label} down`}
              >
                <FaArrowDown />
              </button>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="hc-menu-edit-panel p-3 p-md-4 pt-0">
            <div className="row g-3">
              {notice && notice.feature_id && Number(notice.feature_id) === Number(item.feature_id) && (
                <div className="col-12">
                  <ToastMessage toast={notice} inline={true} />
                </div>
              )}
              <div className="col-12 col-md-4">
                <label className="hc-menu-edit-label">Feature Name</label>
                <input
                  type="text"
                  className="hc-menu-edit-input"
                  value={item.feature_name || ""}
                  onChange={(event) => onFieldChange(path, "feature_name", event.target.value)}
                  placeholder="e.g. Doctor List"
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="hc-menu-edit-label">Menu Label</label>
                <input
                  type="text"
                  className="hc-menu-edit-input"
                  value={item.menu_label || item.label || ""}
                  onChange={(event) => onFieldChange(path, "menu_label", event.target.value)}
                  placeholder="e.g. Doctor Dashboard"
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="hc-menu-edit-label">Router Link</label>
                <input
                  type="text"
                  className="hc-menu-edit-input"
                  value={item.router_link || ""}
                  onChange={(event) => onFieldChange(path, "router_link", event.target.value)}
                  placeholder="e.g. /dashboard/doctors"
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="hc-menu-edit-label">Icon Class</label>
                <input
                  type="text"
                  className="hc-menu-edit-input"
                  value={item.menu_icon || item.icon || ""}
                  onChange={(event) => onFieldChange(path, "menu_icon", event.target.value)}
                  placeholder="e.g. bi bi-people or fa6/FaDiceD6"
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="hc-menu-edit-label">Category</label>
                <select
                  className="hc-menu-edit-input"
                  value={item.category_id ?? ""}
                  onChange={(event) => onFieldChange(path, "category_id", event.target.value === "" ? null : Number(event.target.value))}
                >
                  <option value="">No category</option>
                  {categoryOptions.map((option) => (
                    <option key={option.category_id} value={option.category_id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="hc-menu-edit-label">Parent Feature</label>
                <select
                  className="hc-menu-edit-input"
                  value={item.parent_feature_id ?? ""}
                  onChange={(event) => {
                    const value = event.target.value === "" ? null : Number(event.target.value);
                    onFieldChange(path, "parent_feature_id", value);
                  }}
                >
                  <option value="">Root Level</option>
                  {(featureOptions || [])
                    .filter((option) => Number(option.feature_id) !== Number(item.feature_id))
                    .map((option) => (
                      <option key={option.feature_id} value={option.feature_id}>
                        {option.feature_name || `Feature #${option.feature_id}`}
                      </option>
                    ))}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="hc-menu-edit-label">Menu Order</label>
                <input type="text" className="hc-menu-edit-input" value={item.menu_order ?? ""} readOnly title="Order is controlled by up/down reorder actions" />
              </div>
              <div className="col-12">
                <label className="hc-menu-edit-label">Description</label>
                <textarea
                  className="hc-menu-edit-input hc-menu-edit-textarea"
                  value={item.description || ""}
                  onChange={(event) => onFieldChange(path, "description", event.target.value)}
                  placeholder="Describe this feature"
                />
              </div>
              <div className="col-12">
                <label className="hc-menu-edit-label">Permissions (comma separated)</label>
                <input
                  type="text"
                  className="hc-menu-edit-input"
                  value={normalizePermissionList(item.permissions).join(", ")}
                  onChange={(event) => onFieldChange(path, "permissions", normalizePermissionList(event.target.value))}
                  placeholder="CREATE, READ, UPDATE, DELETE"
                />
              </div>
              <div className="col-12">
                <div className="d-flex flex-wrap gap-3">
                  <label className="hc-menu-edit-check">
                    <input
                      type="checkbox"
                      checked={Boolean(item.show_in_menu)}
                      onChange={(event) => onFieldChange(path, "show_in_menu", event.target.checked)}
                    />
                    <span>Show this feature in menu</span>
                  </label>
                  <label className="hc-menu-edit-check">
                    <input
                      type="checkbox"
                      checked={Boolean(item.is_active)}
                      onChange={(event) => onFieldChange(path, "is_active", event.target.checked)}
                    />
                    <span>Feature is active</span>
                  </label>
                </div>
              </div>
              <div className="col-12 d-flex justify-content-end">
                <button
                  type="button"
                  className="hc-menu-primary-btn"
                  onClick={() => onUpdateFeature(path)}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Updating...
                    </>
                  ) : (
                    <>
                      <FaSave className="me-2" />
                      Update feature
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div style={{ marginTop: 10 }}>
          {item.items.map((child, index) => (
            <TreeNode
              key={child.feature_id}
              item={child}
              path={[...path, index]}
              onMove={onMove}
              isExpanded={expandedKeys[[...path, index].join("-")] ?? true}
              expandedKeys={expandedKeys}
              onToggle={onToggle}
              editingKey={editingKey}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onFieldChange={onFieldChange}
              onUpdateFeature={onUpdateFeature}
              updatingFeatureId={updatingFeatureId}
              notice={notice}
              categoryOptions={categoryOptions}
              featureOptions={featureOptions}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MenuOrderingPage = () => {
  const { refreshRBAC } = useRBAC();
  const [menu, setMenu] = useState([]);
  const [initialMenu, setInitialMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [updatingFeatureId, setUpdatingFeatureId] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [featureOptions, setFeatureOptions] = useState([]);
  const noticeTimeoutRef = useRef(null);

  const showNotice = (payload) => {
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }

    setNotice(payload);
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, 4500);
  };

  const loadMenu = async () => {
    setLoading(true);
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
    setNotice(null);

    try {
      const [rows, allFeatures, categories] = await Promise.all([
        getMenuTree(),
        getAllFeaturesForMenuEditing(),
        getFeatureCategoryOptions(),
      ]);

      const detailsMap = new Map(allFeatures.map((item) => [Number(item.feature_id), item]));
      const enriched = enrichMenuWithFeatureDetails(rows, detailsMap);
      const normalized = renumberTree(enriched);
      setMenu(normalized);
      setInitialMenu(normalized);
      setExpandedKeys(collectKeys(normalized));
      setCategoryOptions(categories);
      setFeatureOptions(allFeatures);
      setEditingKey(null);
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Failed to load menu tree."),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const handleMove = (path, direction) => {
    setMenu((current) => renumberTree(moveNode(current, path, direction)));
  };

  const handleToggle = (key) => {
    setExpandedKeys((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleReset = () => {
    setMenu(initialMenu);
    setExpandedKeys(collectKeys(initialMenu));
    setEditingKey(null);
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
    setNotice(null);
  };

  const handleFieldChange = (path, field, value) => {
    setMenu((current) =>
      updateNodeAtPath(current, path, (node) => {
        const next = { ...node, [field]: value };

        if (field === "menu_label") {
          next.label = value;
        }

        if (field === "menu_icon") {
          next.icon = value;
        }

        return next;
      })
    );
  };

  const syncInitialFeatureNode = (featureId, payload) => {
    const updateNode = (items = []) =>
      items.map((item) => {
        if (Number(item.feature_id) === Number(featureId)) {
          const next = { ...item, ...payload };
          if (Object.prototype.hasOwnProperty.call(payload, "menu_label")) next.label = payload.menu_label;
          if (Object.prototype.hasOwnProperty.call(payload, "menu_icon")) next.icon = payload.menu_icon;
          return next;
        }
        if (!Array.isArray(item.items) || item.items.length === 0) return item;
        return { ...item, items: updateNode(item.items) };
      });

    setInitialMenu((prev) => updateNode(prev));
  };

  const handleUpdateFeature = async (path) => {
    const node = getNodeAtPath(menu, path);
    if (!node?.feature_id) return;

    const payload = {
      feature_name: (node.feature_name || "").trim(),
      description: (node.description || "").trim(),
      category_id: node.category_id === "" || node.category_id === undefined ? null : node.category_id,
      parent_feature_id:
        node.parent_feature_id === "" || node.parent_feature_id === undefined
          ? null
          : node.parent_feature_id,
      is_active: Boolean(node.is_active),
      show_in_menu: Boolean(node.show_in_menu),
      menu_label: (node.menu_label || node.label || "").trim(),
      menu_icon: (node.menu_icon || node.icon || "").trim(),
      router_link: (node.router_link || "").trim(),
      permissions: normalizePermissionList(node.permissions),
    };

    setUpdatingFeatureId(node.feature_id);
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }

    try {
      await updateMenuFeatureDetails(node.feature_id, payload);
      syncInitialFeatureNode(node.feature_id, payload);
      showNotice({ type: "success", message: `Feature #${node.feature_id} updated successfully.`, feature_id: node.feature_id });
    } catch (error) {
      showNotice({
        type: "error",
        message: getApiErrorMessage(error, "Failed to update feature."),
        feature_id: node.feature_id,
      });
    } finally {
      setUpdatingFeatureId(null);
    }
  };

  const handleExpandAll = () => {
    setExpandedKeys(collectKeys(menu, [], {}, true));
  };

  const handleCollapseAll = () => {
    setExpandedKeys(collectKeys(menu, [], {}, false));
  };

  const handleSave = async () => {
    setSaving(true);
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
    setNotice(null);

    try {
      const normalized = renumberTree(menu);
      const featureUpdates = collectFeaturePayloadUpdates(normalized, initialMenu);

      for (const update of featureUpdates) {
        await updateMenuFeatureDetails(update.feature_id, update.payload);
      }

      await updateMenuOrder(normalized);
      setMenu(normalized);
      setInitialMenu(normalized);
      setEditingKey(null);
      showNotice({
        type: "success",
        message:
          featureUpdates.length > 0
            ? `Menu order and ${featureUpdates.length} feature setting(s) updated successfully.`
            : "Menu order updated successfully.",
      });
      refreshRBAC();
    } catch (error) {
      showNotice({
        type: "error",
        message: getApiErrorMessage(error, "Failed to save menu order."),
      });
    } finally {
      setSaving(false);
    }
  };

  const dirty = !deepEqualMenu(menu, initialMenu);
  const totalItems = flattenCount(menu);

  return (
    <div className="container-fluid px-0">
      <div
        className="border-0 shadow-sm mb-4 hc-menu-shell"
        style={{
          borderRadius: 24,
          overflow: "hidden",
          background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,251,253,0.98) 100%)",
          border: "1px solid rgba(13,58,92,0.08)",
        }}
      >
        <div className="p-4 p-md-5 hc-menu-hero" style={{ background: BRAND, color: "#fff" }}>
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-4">
            <div>
              <div className="text-uppercase small fw-semibold mb-2" style={{ letterSpacing: "0.12em", opacity: 0.8 }}>
                Menu Management
              </div>
              <h3 className="mb-2 fw-bold">Menu Ordering</h3>
              <p className="mb-0" style={{ maxWidth: 720, opacity: 0.92 }}>
                Shape the application navigation with a cleaner control surface. Collapse groups, move items level by level, and save only when the final structure feels right.
              </p>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <span className="hc-menu-hero-pill">{totalItems} visible items</span>
              <span
                className="hc-menu-hero-pill"
                style={{ background: dirty ? "rgba(249, 115, 22, 0.24)" : "rgba(34,197,94,0.22)" }}
              >
                {dirty ? "Unsaved changes" : "Synced"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 p-md-5">
          <ToastMessage toast={notice} />

          <div className="row g-4 mb-4 align-items-stretch">
            <div className="col-12 col-xl-8">
              <div className="hc-menu-toolbar-panel h-100">
                <div className="d-flex align-items-start gap-3">
                  <div className="hc-menu-toolbar-orb">
                    <FaKeyboard />
                  </div>
                  <div>
                    <div className="text-uppercase small fw-semibold mb-2" style={{ letterSpacing: "0.12em", color: "#1a709b" }}>
                      Workflow
                    </div>
                    <h5 className="fw-bold mb-2" style={{ color: "#0d3a5c" }}>Fast ordering, less clutter</h5>
                    <p className="text-muted mb-0">
                      Use the arrow cluster on each card to reorder siblings. Expand groups only when you need to refine nested navigation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-xl-4">
              <div className="hc-menu-toolbar-panel h-100 d-flex flex-column justify-content-between gap-3">
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="hc-menu-ghost-btn" onClick={handleExpandAll} disabled={loading || saving}>
                    <FaExpand className="me-2" />
                    Expand all
                  </button>
                  <button type="button" className="hc-menu-ghost-btn" onClick={handleCollapseAll} disabled={loading || saving}>
                    <FaCompress className="me-2" />
                    Collapse all
                  </button>
                </div>

                <div className="d-flex flex-wrap gap-2 justify-content-xl-end">
                  <button type="button" className="hc-menu-ghost-btn" onClick={loadMenu} disabled={loading || saving}>
                    <FaSync className="me-2" />
                    Reload
                  </button>
                  <button type="button" className="hc-menu-ghost-btn" onClick={handleReset} disabled={!dirty || saving}>
                    <FaUndo className="me-2" />
                    Reset
                  </button>
                  <button type="button" className="hc-menu-primary-btn" onClick={handleSave} disabled={!dirty || loading || saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaSave className="me-2" />
                        Save changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
            <div className="hc-menu-source-note">
              <FaDatabase className="me-2" />
              Live sync with GET /menu, PUT /menu/reorder and PUT /features/:id
            </div>
            <div className="hc-menu-source-note">
              <FaLayerGroup className="me-2" />
              Order updates stay inside each hierarchy level
            </div>
          </div>

          {loading ? (
            <div className="py-5 text-center">
              <div className="spinner-border" style={{ color: "#1a709b" }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : menu.length === 0 ? (
            <div className="text-center py-5">
              <div
                className="mx-auto mb-3 d-flex align-items-center justify-content-center"
                style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(148,163,184,0.12)", color: "#64748b" }}
              >
                <FaBars className="fs-3" />
              </div>
              <h5 className="fw-bold mb-2" style={{ color: "#0d3a5c" }}>No menu items available</h5>
              <p className="text-muted mb-0">The backend returned an empty menu tree for the current user.</p>
            </div>
          ) : (
            <div className="hc-menu-tree-wrap">
              {menu.map((item, index) => (
                <TreeNode
                  key={item.feature_id}
                  item={item}
                  path={[index]}
                  onMove={handleMove}
                  isExpanded={expandedKeys[String(index)] ?? true}
                  expandedKeys={expandedKeys}
                  onToggle={handleToggle}
                  editingKey={editingKey}
                  onEditStart={setEditingKey}
                  onEditCancel={() => setEditingKey(null)}
                  onFieldChange={handleFieldChange}
                  onUpdateFeature={handleUpdateFeature}
                  updatingFeatureId={updatingFeatureId}
                  notice={notice}
                  categoryOptions={categoryOptions}
                  featureOptions={featureOptions}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuOrderingPage;
