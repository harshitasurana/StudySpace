import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { searchService } from "../../services/searchService.js";
import "./GlobalSearchModal.css";

const ENTITY_CONFIG = {
  organizations: { icon: "bi-building", color: "#0ea5e9", route: (id) => `/admin/organizations` },
  departments: { icon: "bi-diagram-3", color: "#f59e0b", route: () => `/admin/organizations` },
  services: { icon: "bi-gear", color: "#8b5cf6", route: () => `/admin/organizations` },
  doctors: { icon: "bi-person-badge", color: "#10b981", route: (id) => `/dashboard/doctors` },
  patients: { icon: "bi-people", color: "#06b6d4", route: () => `/dashboard/patients` },
  staff: { icon: "bi-person-lines-fill", color: "#3b82f6", route: () => `/admin/users` },
  appointments: { icon: "bi-calendar-check", color: "#ec4899", route: () => `/dashboard/appointments` },
  contacts: { icon: "bi-book", color: "#14b8a6", route: () => `/admin/organizations` },
  tasks: { icon: "bi-list-task", color: "#a855f7", route: () => `/admin/organizations` },
  rooms: { icon: "bi-door-open", color: "#f97316", route: () => `/admin/organizations` },
  ambulances: { icon: "bi-truck", color: "#ef4444", route: () => `/admin/organizations` },
  support: { icon: "bi-headset", color: "#64748b", route: () => `/admin/organizations` },
  "inventory-items": { icon: "bi-box-seam", color: "#22c55e", route: () => `/admin/organizations` },
  "inventory-suppliers": { icon: "bi-truck", color: "#78716c", route: () => `/admin/organizations` },
};

const ENTITY_RBAC_LABELS = {
  read_all: "Full Access",
  read_org: "Organization",
  read_assigned: "Assigned",
  read_own: "My Records",
  none: "No Access",
};

const ENTITY_RBAC_COLORS = {
  read_all: "#22c55e",
  read_org: "#3b82f6",
  read_assigned: "#f59e0b",
  read_own: "#8b5cf6",
  none: "#ef4444",
};

const defaultConfig = { icon: "bi-search", color: "#64748b", route: () => `/admin/organizations` };

const GlobalSearchModal = ({ show, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [entityCounts, setEntityCounts] = useState({});
  const [permissionLevels, setPermissionLevels] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [categories, setCategories] = useState([]);
  const [entityList, setEntityList] = useState([]);
  const [entityRbacMap, setEntityRbacMap] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeEntity, setActiveEntity] = useState(null);

  useEffect(() => {
    if (show) {
      setQuery("");
      setResults([]);
      setEntityCounts({});
      setPermissionLevels({});
      setSelectedIndex(-1);
      setActiveCategory(null);
      setActiveEntity(null);
      searchService.getFilters().then((data) => {
        setCategories(data.categories || []);
        setEntityList(data.entities || []);
        const rbacMap = {};
        (data.entities || []).forEach((e) => { if (e.roleAccess) rbacMap[e.key] = e.roleAccess; });
        setEntityRbacMap(rbacMap);
      }).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [show]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setEntityCounts({});
      setSelectedIndex(-1);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      setSelectedIndex(-1);
      try {
        const params = { q: query, limit: 20, per_entity_limit: 5 };
        if (activeEntity) params.entity = activeEntity;
        if (activeCategory) params.category = activeCategory;
        const data = await searchService.search(params);
        setResults(data.results || []);
        setEntityCounts(data.entity_counts || {});
        setPermissionLevels(data.permission_levels || {});
      } catch {
        setResults([]);
        setEntityCounts({});
        setPermissionLevels({});
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, activeCategory, activeEntity]);

  const handleSelect = useCallback((item) => {
    const config = ENTITY_CONFIG[item.entity] || defaultConfig;
    const path = config.route(item.id);
    onClose();
    navigate(path);
  }, [navigate, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [results, selectedIndex, handleSelect, onClose]);

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const item = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!show) onClose(); // will be toggled by parent
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show, onClose]);

  if (!show) return null;

  const groupedResults = results.reduce((acc, item) => {
    const group = item.category || "other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const categoryLabels = {
    organization: "Organization",
    people: "People",
    operations: "Operations",
    scheduling: "Scheduling",
    directory: "Directory",
    productivity: "Productivity",
    support: "Support",
    other: "Other",
  };

  const hasActiveFilters = activeCategory || activeEntity;

  return (
    <div className="hc-search-overlay" onClick={onClose}>
      <div className="hc-search-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Global search">
        <div className="hc-search-header">
          <i className="bi bi-search hc-search-input-icon" />
          <input
            ref={inputRef}
            type="text"
            className="hc-search-input"
            placeholder="Search for anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button className="hc-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <i className="bi bi-x-lg" />
            </button>
          )}
          <kbd className="hc-search-esc">ESC</kbd>
        </div>

        {categories.length > 0 && (
          <div className="hc-search-filters">
            <div className="hc-search-categories">
              <button
                className={`hc-search-pill${!activeCategory && !activeEntity ? " hc-search-pill--active" : ""}`}
                onClick={() => { setActiveCategory(null); setActiveEntity(null); }}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  className={`hc-search-pill${activeCategory === cat.key && !activeEntity ? " hc-search-pill--active" : ""}`}
                  onClick={() => { setActiveCategory(cat.key); setActiveEntity(null); }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {entityList.length > 0 && (
              <div className="hc-search-entities">
                {entityList.map((ent) => {
                  const permLevel = permissionLevels[ent.key];
                  const rbacColor = permLevel ? ENTITY_RBAC_COLORS[permLevel] : null;
                  return (
                    <button
                      key={ent.key}
                      className={`hc-search-badge${activeEntity === ent.key ? " hc-search-badge--active" : ""}`}
                      onClick={() => { setActiveEntity(ent.key); setActiveCategory(null); }}
                      title={permLevel ? `Access: ${ENTITY_RBAC_LABELS[permLevel] || permLevel}` : ""}
                    >
                      <i className={`bi ${(ENTITY_CONFIG[ent.key] || defaultConfig).icon} hc-search-badge-icon`} />
                      {ent.label}
                      {permLevel && permLevel !== "read_all" && (
                        <span
                          className="hc-search-badge-rbac"
                          style={{ backgroundColor: rbacColor }}
                        >
                          {ENTITY_RBAC_LABELS[permLevel]?.[0] || "?"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="hc-search-body" ref={listRef}>
          {loading && (
            <div className="hc-search-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="hc-search-skeleton">
                  <div className="hc-search-skeleton-icon" />
                  <div className="hc-search-skeleton-lines">
                    <div className="hc-search-skeleton-line hc-search-skeleton-line--title" />
                    <div className="hc-search-skeleton-line hc-search-skeleton-line--sub" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && query && results.length === 0 && !hasActiveFilters && (
            <div className="hc-search-empty">
              <i className="bi bi-search hc-search-empty-icon" />
              <p className="hc-search-empty-title">No results found</p>
              <p className="hc-search-empty-sub">Try different keywords or browse the sidebar</p>
            </div>
          )}

          {!loading && query && results.length === 0 && hasActiveFilters && (
            <div className="hc-search-empty">
              <i className="bi bi-funnel hc-search-empty-icon" />
              <p className="hc-search-empty-title">No results in this filter</p>
              <p className="hc-search-empty-sub">Try clearing filters or searching more broadly</p>
            </div>
          )}

          {!loading && query && results.length > 0 && (
            <div className="hc-search-results">
              {Object.entries(groupedResults).map(([category, items]) => (
                <div key={category} className="hc-search-group">
                  <div className="hc-search-group-header">
                    <span className="hc-search-group-label">{categoryLabels[category] || category}</span>
                    <span className="hc-search-group-count">{items.length}</span>
                  </div>
                  {items.map((item, idx) => {
                    const globalIdx = results.indexOf(item);
                    const config = ENTITY_CONFIG[item.entity] || defaultConfig;
                    return (
                      <div
                        key={`${item.entity}-${item.id}`}
                        className={`hc-search-item${selectedIndex === globalIdx ? " hc-search-item--active" : ""}`}
                        data-index={globalIdx}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        role="option"
                        aria-selected={selectedIndex === globalIdx}
                      >
                        <span className="hc-search-item-icon" style={{ background: config.color }}>
                          <i className={`bi ${config.icon}`} />
                        </span>
                        <div className="hc-search-item-content">
                          <span className="hc-search-item-title">{item.title}</span>
                          {item.subtitle && <span className="hc-search-item-subtitle">{item.subtitle}</span>}
                          {item.description && <span className="hc-search-item-desc">{item.description}</span>}
                        </div>
                        <span className="hc-search-item-entity">{item.entity}</span>
                        {permissionLevels[item.entity] && permissionLevels[item.entity] !== "read_all" && (
                          <span
                            className="hc-search-item-rbac"
                            style={{ backgroundColor: ENTITY_RBAC_COLORS[permissionLevels[item.entity]] || "#64748b" }}
                            title={`Access: ${ENTITY_RBAC_LABELS[permissionLevels[item.entity]] || permissionLevels[item.entity]}`}
                          >
                            {(ENTITY_RBAC_LABELS[permissionLevels[item.entity]] || "?")[0]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {!loading && !query && (
            <div className="hc-search-empty">
              <i className="bi bi-lightning-charge hc-search-empty-icon" />
              <p className="hc-search-empty-title">Start typing to search</p>
              <p className="hc-search-empty-sub">Search across all modules and entities</p>
            </div>
          )}
        </div>

        <div className="hc-search-footer">
          <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span>
          <span><kbd>&crarr;</kbd> select</span>
          <span><kbd>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
