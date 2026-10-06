import HomeModuleCard from "./HomeModuleCard.jsx";
import {
  FaShieldAlt, FaPuzzlePiece, FaPlusSquare, FaSlidersH,
  FaThLarge, FaCodeBranch, FaListOl,
  FaUserMd, FaCalendarCheck, FaUsers, FaCog, FaHome,
} from "react-icons/fa";

const BRAND = "linear-gradient(135deg, #1a709b 0%, #0d3a5c 100%)";
const ACCENT = "#1a709b";

const SectionLabel = ({ icon: Icon, children }) => (
  <div className="d-flex align-items-center gap-2 mb-3" style={{ borderBottom: "1px solid #f0f4f8", paddingBottom: "0.5rem" }}>
    {Icon && <Icon style={{ color: ACCENT, fontSize: "0.95rem" }} />}
    <span className="fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.08em", color: "#64748b" }}>
      {children}
    </span>
  </div>
);

const ComingSoonCard = ({ icon: Icon, title }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: "16px",
      boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
      border: "1px solid #e6edf5",
      padding: "1.5rem",
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      opacity: 0.6,
      height: "100%",
    }}
  >
    <div
      style={{
        width: "44px", height: "44px", borderRadius: "12px",
        background: "rgba(100,116,139,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: "0.75rem",
      }}
    >
      {Icon && <Icon style={{ fontSize: "1.2rem", color: "#94a3b8" }} />}
    </div>
    <h6 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>{title}</h6>
    <span
      style={{
        marginTop: "0.5rem",
        fontSize: "0.7rem",
        fontWeight: 500,
        color: "#94a3b8",
        background: "rgba(100,116,139,0.12)",
        padding: "0.2rem 0.6rem",
        borderRadius: "30px",
      }}
    >
      Coming Soon
    </span>
  </div>
);

const HomeDashboard = ({ adminData }) => {
  const displayName = adminData?.full_name || adminData?.name || adminData?.username || adminData?.email || "Admin";

  return (
    <div className="container-fluid py-3 px-3 px-md-4">

      {/* ── Welcome Banner ───────────────────────────────────── */}
      <div
        style={{
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.15)",
          display: "flex",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            width: "260px", flexShrink: 0,
            background: BRAND,
            padding: "2rem 1.75rem",
            display: "flex", flexDirection: "column",
            justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "150px", height: "150px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
          <div style={{ position: "absolute", bottom: "-30px", left: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                width: "52px", height: "52px", borderRadius: "14px",
                background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "1rem",
                backdropFilter: "blur(4px)",
              }}
            >
              <FaHome className="text-white" style={{ fontSize: "1.5rem" }} />
            </div>
            <h5 className="text-white fw-bold mb-1" style={{ fontSize: "1.05rem", lineHeight: 1.3 }}>
              Welcome back, {displayName}
            </h5>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>
              Here&apos;s an overview of the admin portal. Use the cards below to quickly access any module.
            </p>
          </div>
        </div>

        <div style={{ flex: 1, background: "#fff", padding: "1.5rem 1.75rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p className="mb-0 text-muted small">
            Use the sections below to jump into role, feature, and content management tools.
          </p>
        </div>
      </div>

      {/* ── Access Control & RBAC ────────────────────────────── */}
      <SectionLabel icon={FaShieldAlt}>Access Control &amp; RBAC</SectionLabel>
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <HomeModuleCard icon={FaShieldAlt} title="Roles" description="Define roles with granular feature-level permissions" route="/admin/roles" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <HomeModuleCard icon={FaPuzzlePiece} title="Features" description="Manage system features, categories &amp; availability" route="/admin/features" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <HomeModuleCard icon={FaPlusSquare} title="Add Feature" description="Create a new feature with permissions &amp; menu configuration" route="/admin/features/add" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <HomeModuleCard icon={FaSlidersH} title="Feature Permissions" description="Configure granular Create/Read/Update/Delete permissions per role" route="/admin/feature-permissions" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <HomeModuleCard icon={FaThLarge} title="Availability Types" description="Define supported platforms (Web, Mobile, etc.)" route="/admin/feature-availability-types" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <HomeModuleCard icon={FaCodeBranch} title="Availability Map" description="Map features to their supported platform availability" route="/admin/feature-availability-map" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <HomeModuleCard icon={FaListOl} title="Menu Ordering" description="Arrange &amp; customize the sidebar navigation tree" route="/admin/menu-ordering" />
        </div>
      </div>

      {/* ── Coming Soon ────────────────────────────────────── */}
      <SectionLabel>Coming Soon</SectionLabel>
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <ComingSoonCard icon={FaUserMd} title="Doctors" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <ComingSoonCard icon={FaCalendarCheck} title="Appointments" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <ComingSoonCard icon={FaUsers} title="Users" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <ComingSoonCard icon={FaCog} title="Settings" />
        </div>
      </div>

    </div>
  );
};

export default HomeDashboard;
