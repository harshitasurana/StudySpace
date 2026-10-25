import { useNavigate } from "react-router-dom";
import { useRBAC } from "../../shared/component/RBACProvider.jsx";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";
const ACCENT = "#1a709b";

const HomeModuleCard = ({ icon: Icon, title, description, route }) => {
  const navigate = useNavigate();
  const { canRoute } = useRBAC();
  const hasAccess = canRoute(route);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
        border: "1px solid #e6edf5",
        padding: "1.5rem",
        transition: "all 0.18s",
        opacity: hasAccess ? 1 : 0.5,
        cursor: hasAccess ? "pointer" : "not-allowed",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      onMouseEnter={(e) => {
        if (hasAccess) {
          e.currentTarget.style.boxShadow = "0 20px 40px rgba(15,23,42,0.12)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 12px 28px rgba(15,23,42,0.08)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div className="d-flex align-items-center gap-3 mb-3">
        <div
          style={{
            width: "44px", height: "44px", borderRadius: "12px",
            background: hasAccess ? "rgba(26,112,155,0.1)" : "rgba(100,116,139,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {Icon && <Icon style={{ fontSize: "1.2rem", color: hasAccess ? ACCENT : "#94a3b8" }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h6 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: hasAccess ? "#0d3a5c" : "#94a3b8" }}>
            {title}
          </h6>
        </div>
      </div>

      <p style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.5, marginBottom: "1rem", flex: 1 }}>
        {description}
      </p>

      <button
        type="button"
        disabled={!hasAccess}
        onClick={() => hasAccess && navigate(route)}
        style={{
          alignSelf: "flex-start",
          padding: "0.45rem 1.1rem",
          borderRadius: "10px",
          border: "none",
          background: hasAccess ? BRAND : "#e2e8f0",
          color: hasAccess ? "#fff" : "#94a3b8",
          fontWeight: 600,
          fontSize: "0.78rem",
          cursor: hasAccess ? "pointer" : "not-allowed",
          transition: "all 0.18s",
          display: "flex", alignItems: "center", gap: "6px",
        }}
      >
        <i className="bi bi-arrow-right-circle" style={{ fontSize: "0.85rem" }} />
        {hasAccess ? "Quick Access" : "No Access"}
      </button>
    </div>
  );
};

export default HomeModuleCard;
