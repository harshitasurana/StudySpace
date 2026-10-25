import { useLocation } from "react-router-dom";
import { useRBAC } from "../../shared/component/RBACProvider.jsx";
import { FaHourglassHalf, FaProjectDiagram, FaShieldAlt, FaStar } from "react-icons/fa";

const PanelMessage = ({ icon: Icon, title, message, tone = "primary" }) => (
  <div className="container py-4">
    <div
      className="card border-0"
      style={{
        borderRadius: "16px",
        boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
        border: "1px solid #e6edf5",
      }}
    >
      <div className="card-body text-center py-5">
        <div
          className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
          style={{ width: 64, height: 64, background: `rgba(${tone === "danger" ? "220,38,38" : "26,112,155"},0.1)` }}
        >
          {Icon && <Icon style={{ fontSize: "1.4rem", color: tone === "danger" ? "#dc2626" : "#1a709b" }} />}
        </div>
        <h5 className="fw-bold mb-2" style={{ color: "#0d3a5c" }}>{title}</h5>
        <p className="text-muted mb-0">{message}</p>
      </div>
    </div>
  </div>
);

const DashboardContent = () => {
  const location = useLocation();
  const path = location.pathname;
  const { loading, canRoute } = useRBAC();

  const routes = {
    "/dashboard": {
      component: null,
      title: "Dashboard",
      description: "Welcome to the admin portal. Choose any module from the sidebar.",
    },
    "/dashboard/doctors": {
      component: null,
      title: "Doctors",
      description: "Doctor management is coming next in the RBAC rollout.",
    },
    "/dashboard/appointments": {
      component: null,
      title: "Appointments",
      description: "Appointment management is coming next in the RBAC rollout.",
    },
    "/dashboard/users": {
      component: null,
      title: "Users & Roles",
      description: "RBAC user and role management UI is under implementation.",
    },
  };

  if (loading) {
    return <PanelMessage icon={FaHourglassHalf} title="Loading Permissions" message="Please wait while your access policies are being applied." />;
  }

  const current = routes[path];
  if (!current) {
    return <PanelMessage icon={FaProjectDiagram} title="Page Not Found" message="The requested dashboard section does not exist." tone="danger" />;
  }

  if (!canRoute(path)) {
    return (
      <PanelMessage
        icon={FaShieldAlt}
        title="Access Denied"
        message={`You do not have permission to access ${current.title}.`}
        tone="danger"
      />
    );
  }

  if (!current.component) {
    return <PanelMessage icon={FaStar} title={current.title} message={current.description} />;
  }

  return current.component;
}

export default DashboardContent;
