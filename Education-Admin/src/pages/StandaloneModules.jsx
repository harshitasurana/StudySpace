import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import RoleList from "../components/roles/RoleList.jsx";
import FeatureList from "../components/features/FeatureList.jsx";
import AddFeaturePage from "../components/features/AddFeaturePage.jsx";
import FeaturePermissionsPage from "../components/feature-permissions/FeaturePermissionsPage.jsx";
import FeatureAvailabilityList from "../components/feature-availability/FeatureAvailabilityList.jsx";
import FeatureAvailabilityMapList from "../components/feature-availability-map/FeatureAvailabilityMapList.jsx";
import MenuOrderingPage from "../components/menu/MenuOrderingPage.jsx";
import CurriculumList from "../components/curriculum/CurriculumList.jsx";
import SamplePaperList from "../components/sample-papers/SamplePaperList.jsx";
import UserActivityList from "./UserActivity/UserActivityList.jsx";
import AiProviderKeysList from "../components/ai-provider-keys/AiProviderKeysList.jsx";
import "./StandaloneModules/StandaloneModules.css";
import "../components/layout/DashboardShell.css";
import AppNavbar from "../components/layout/AppNavbar.jsx";
import AppSideNavbar from "../components/layout/AppSideNavbar.jsx";
import AppFooter from "../components/layout/AppFooter.jsx";
import { verifyToken, logout, refreshAccessToken } from "../services/authService.js";
import { bootstrapRBAC, resolveSessionAdmin } from "../services/rbacService.js";
import { RBACProvider, useRBAC } from "../shared/component/RBACProvider.jsx";
import { useRealtimeRBAC } from "../shared/hooks/useRealtimeRBAC.js";
import { FaShieldAlt, FaPuzzlePiece, FaPlusSquare, FaThLarge, FaProjectDiagram, FaSlidersH, FaListOl, FaBook, FaFileAlt, FaKey, FaUserClock } from "react-icons/fa";

const MODULE_CONFIG = {
  "/roles": {
    title: "Roles",
    Icon: FaShieldAlt,
    Component: RoleList,
  },
  "/features": {
    title: "Features",
    Icon: FaPuzzlePiece,
    Component: FeatureList,
  },
  "/features/add": {
    title: "Add Feature",
    Icon: FaPlusSquare,
    Component: AddFeaturePage,
  },
  "/feature-availability-types": {
    title: "Availability Types",
    Icon: FaThLarge,
    Component: FeatureAvailabilityList,
  },
  "/feature-availability-map": {
    title: "Feature — Availability Map",
    Icon: FaProjectDiagram,
    Component: FeatureAvailabilityMapList,
  },
  "/feature-permissions": {
    title: "Feature Permissions",
    Icon: FaSlidersH,
    Component: FeaturePermissionsPage,
  },
  "/menu-ordering": {
    title: "Menu Ordering",
    Icon: FaListOl,
    Component: MenuOrderingPage,
  },
  "/curriculum": {
    title: "Curriculum Management",
    Icon: FaBook,
    Component: CurriculumList,
  },
  "/sample-papers": {
    title: "Sample Papers",
    Icon: FaFileAlt,
    Component: SamplePaperList,
  },
  "/user-activity": {
    title: "User Activity",
    Icon: FaUserClock,
    Component: UserActivityList,
  },
  "/ai-provider-keys": {
    title: "AI Provider Keys",
    Icon: FaKey,
    Component: AiProviderKeysList,
  },
};

const ModuleBody = ({ path, adminData, onLogout, isSidebarCollapsed, isSidebarMobileOpen, onToggleSidebar }) => {
  const { loading, canRoute } = useRBAC();
  const config = MODULE_CONFIG[path] || null;

  if (!config) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "70vh" }}>
        <div className="spinner-border" style={{ color: "#1a709b" }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!canRoute(path)) {
    return (
      <div className="container py-4">
        <div className="card border-0" style={{ borderRadius: 16, boxShadow: "0 12px 28px rgba(15,23,42,0.08)", border: "1px solid #e6edf5" }}>
          <div className="card-body text-center py-5">
            <div className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle" style={{ width: 64, height: 64, background: "rgba(220,38,38,0.1)" }}>
              <FaShieldAlt style={{ fontSize: "1.4rem", color: "#dc2626" }} />
            </div>
            <h5 className="fw-bold mb-2" style={{ color: "#0d3a5c" }}>Access Denied</h5>
            <p className="text-muted mb-0">You do not have permission to access {config.title}.</p>
          </div>
        </div>
      </div>
    );
  }

  const ActiveComponent = config.Component;

  return (
    <div className={`sb-nav-fixed hc-dashboard-shell${isSidebarCollapsed ? " hc-shell--collapsed" : ""}${isSidebarMobileOpen ? " hc-shell--mobile-open" : ""}`}>
      <AppNavbar
        onLogout={onLogout}
        adminData={adminData}
        onToggleSidebar={onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
      />
      <div id="layoutSidenav">
        <div id="layoutSidenav_nav">
          <AppSideNavbar adminData={adminData} isCollapsed={isSidebarCollapsed} />
        </div>
        <div id="layoutSidenav_content">
          <main>
            <div className="container-fluid py-3 px-3 px-md-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                {config.Icon && <config.Icon style={{ color: "#1a709b" }} />}
                <h5 className="fw-bold mb-0" style={{ color: "#0d3a5c" }}>{config.title}</h5>
              </div>
              <ActiveComponent />
            </div>
          </main>
          <AppFooter isSidebarCollapsed={isSidebarCollapsed} />
        </div>
      </div>
    </div>
  );
};

const StandaloneModules = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const logoutTimerRef = useRef(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("hc_sidebar_collapsed") === "1";
  });
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rbac, setRbac] = useState({
    loading: true,
    ready: false,
    roleId: null,
    features: [],
    featuresByKey: {},
    generatedAt: null,
    isSuperAdmin: false,
    menu: [],
    allowedRoutePaths: [],
  });

  const canonicalPath = useMemo(() => {
    const map = {
      "/dashboard/organizations": "/organizations",
      "/dashboard/roles": "/roles",
      "/dashboard/features": "/features",
      "/dashboard/features/add": "/features/add",
      "/dashboard/feature-permissions": "/feature-permissions",
      "/admin/roles": "/roles",
      "/admin/features": "/features",
      "/admin/features/add": "/features/add",
      "/admin/feature-permissions": "/feature-permissions",
      "/admin/feature-availability-types": "/feature-availability-types",
      "/admin/feature-availability-map": "/feature-availability-map",
      "/admin/menu-ordering": "/menu-ordering",
      "/admin/categories": "/categories",
      "/admin/category-list": "/categories",
      "/admin/categories-list": "/categories",
      "/admin/category-type": "/categories-type",
      "/admin/categories-type": "/categories-type",
      "/admin/curriculum": "/curriculum",
      "/admin/sample-papers": "/sample-papers",
      "/admin/user-activity": "/user-activity",
      "/admin/ai-provider-keys": "/ai-provider-keys",
    };

    if (map[location.pathname]) return map[location.pathname];

    return location.pathname;
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("hc_selected_org_id");
      if (logoutTimerRef.current) clearInterval(logoutTimerRef.current);
      navigate("/login");
    }
  };

  const handleSidebarToggle = () => {
    if (window.matchMedia("(max-width: 991.98px)").matches) {
      setIsSidebarMobileOpen((prev) => !prev);
      return;
    }

    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("hc_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  };

  const handleRefreshRBAC = useCallback(async () => {
    if (!adminData) return;
    try {
      const rbacSnapshot = await bootstrapRBAC(adminData);
      setRbac({ ...rbacSnapshot, loading: false, ready: true });
    } catch (error) {
      console.error("Failed to refresh RBAC:", error);
    }
  }, [adminData]);

  useRealtimeRBAC(handleRefreshRBAC);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 992px)");
    const handleMediaChange = (event) => {
      if (event.matches) {
        setIsSidebarMobileOpen(false);
      }
    };

    if (media.addEventListener) {
      media.addEventListener("change", handleMediaChange);
      return () => media.removeEventListener("change", handleMediaChange);
    }

    media.addListener(handleMediaChange);
    return () => media.removeListener(handleMediaChange);
  }, []);

  useEffect(() => {
    const startAutoLogoutTimer = () => {
      if (logoutTimerRef.current) clearInterval(logoutTimerRef.current);
      logoutTimerRef.current = setInterval(async () => {
        try {
          let result;
          try { result = await verifyToken(); }
          catch {
            const refreshResult = await refreshAccessToken();
            if (refreshResult?.success) {
              result = await verifyToken();
            } else { result = { success: false }; }
          }
          if (!result?.success) await handleLogout();
        } catch (err) {
          console.error("Token validation error:", err);
          await handleLogout();
        }
      }, 60000);
    };

    const init = async () => {
      try {
        let tokenResult;
        try { tokenResult = await verifyToken(); }
        catch {
          const refreshResult = await refreshAccessToken();
          if (!refreshResult?.success) { await handleLogout(); return; }
          tokenResult = await verifyToken();
        }
        if (!tokenResult?.success) { await handleLogout(); return; }

        const admin = resolveSessionAdmin(tokenResult);
        const rbacSnapshot = await bootstrapRBAC(admin);

        setAdminData(rbacSnapshot.sessionUser || admin);
        setRbac({ ...rbacSnapshot, loading: false, ready: true });
        setLoading(false);
        startAutoLogoutTimer();
      } catch (err) {
        console.error("Authentication check error:", err);
        setError("Authentication failed");
        setRbac((prev) => ({ ...prev, loading: false, ready: false }));
        setLoading(false);
        navigate("/login");
      }
    };

    init();
    return () => {
      if (logoutTimerRef.current) clearInterval(logoutTimerRef.current);
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 hc-auth-layout">
        <div className="spinner-border text-white" role="status" style={{ width: "3rem", height: "3rem" }}>
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 hc-auth-layout">
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <RBACProvider rbac={rbac} onRefreshRBAC={handleRefreshRBAC}>
      <ModuleBody
        path={canonicalPath}
        adminData={adminData}
        onLogout={handleLogout}
        isSidebarCollapsed={isSidebarCollapsed}
        isSidebarMobileOpen={isSidebarMobileOpen}
        onToggleSidebar={handleSidebarToggle}
      />
    </RBACProvider>
  );
};

export default StandaloneModules;
