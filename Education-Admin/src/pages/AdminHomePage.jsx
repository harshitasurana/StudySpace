import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../components/layout/DashboardShell.css";
import AppNavbar from "../components/layout/AppNavbar.jsx";
import AppFooter from "../components/layout/AppFooter.jsx";
import AppSideNavbar from "../components/layout/AppSideNavbar.jsx";
import HomeDashboard from "../components/home/HomeDashboard.jsx";
import { verifyToken, logout, refreshAccessToken } from "../services/authService.js";
import { bootstrapRBAC, resolveSessionAdmin } from "../services/rbacService.js";
import { RBACProvider } from "../shared/component/RBACProvider.jsx";
import { useRealtimeRBAC } from "../shared/hooks/useRealtimeRBAC.js";

const AdminHomePage = () => {
  const navigate = useNavigate();
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
  });
  const logoutTimerRef = useRef(null);

  const handleAutoLogout = async () => {
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

  const startAutoLogoutTimer = () => {
    if (logoutTimerRef.current) clearInterval(logoutTimerRef.current);
    logoutTimerRef.current = setInterval(async () => {
      try {
        let isValid;
        try { isValid = await verifyToken(); }
        catch {
          const refreshResult = await refreshAccessToken();
          if (refreshResult?.success) {
            isValid = await verifyToken();
          } else { isValid = { success: false }; }
        }
        if (!isValid?.success) await handleAutoLogout();
      } catch (err) {
        console.error("Token validation error:", err);
        await handleAutoLogout();
      }
    }, 60000);
  };

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        let tokenResult;
        try { tokenResult = await verifyToken(); }
        catch {
          const refreshResult = await refreshAccessToken();
          if (!refreshResult?.success) { await handleAutoLogout(); return; }
          tokenResult = await verifyToken();
        }
        if (!tokenResult?.success) { await handleAutoLogout(); return; }
        const admin = resolveSessionAdmin(tokenResult);
        const rbacSnapshot = await bootstrapRBAC(admin);
        startAutoLogoutTimer();
        setAdminData(rbacSnapshot.sessionUser || admin);
        setRbac({ ...rbacSnapshot, loading: false, ready: true });
        setLoading(false);
      } catch (err) {
        console.error("Authentication check error:", err);
        setError("Authentication failed");
        setRbac((prev) => ({ ...prev, loading: false, ready: false }));
        setLoading(false);
        navigate("/login");
      }
    };
    checkAuthAndLoadData();
    return () => { if (logoutTimerRef.current) clearInterval(logoutTimerRef.current); };
  }, [navigate]);

  const handleLogout = async () => {
    try { await logout(); }
    catch (err) { console.error("Logout error:", err); }
    finally {
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

  useEffect(() => {
    const media = window.matchMedia("(min-width: 992px)");
    const handleMediaChange = (event) => {
      if (event.matches) setIsSidebarMobileOpen(false);
    };
    if (media.addEventListener) {
      media.addEventListener("change", handleMediaChange);
      return () => media.removeEventListener("change", handleMediaChange);
    }
    media.addListener(handleMediaChange);
    return () => media.removeListener(handleMediaChange);
  }, []);

  const handleRefreshRBAC = useCallback(async () => {
    if (!adminData) return;
    try {
      const rbacSnapshot = await bootstrapRBAC(adminData);
      setRbac({ ...rbacSnapshot, loading: false, ready: true });
    } catch (err) {
      console.error("Failed to refresh RBAC:", err);
    }
  }, [adminData]);

  useRealtimeRBAC(handleRefreshRBAC);

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
      <div className={`sb-nav-fixed hc-dashboard-shell${isSidebarCollapsed ? " hc-shell--collapsed" : ""}${isSidebarMobileOpen ? " hc-shell--mobile-open" : ""}`}>
        <AppNavbar
          onLogout={handleLogout}
          adminData={adminData}
          onToggleSidebar={handleSidebarToggle}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        <div id="layoutSidenav">
          <div id="layoutSidenav_nav">
            <AppSideNavbar adminData={adminData} isCollapsed={isSidebarCollapsed} />
          </div>
          <div id="layoutSidenav_content">
            <main>
              <HomeDashboard adminData={adminData} />
            </main>
            <AppFooter isSidebarCollapsed={isSidebarCollapsed} />
          </div>
        </div>
      </div>
    </RBACProvider>
  );
};

export default AdminHomePage;
