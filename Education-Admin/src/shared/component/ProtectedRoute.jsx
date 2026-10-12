import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { verifyToken } from "../../services/authService";

const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await verifyToken();
      } catch (err) {
        navigate("/login");
      }
    };

    checkAuth();
  }, [navigate]);

  return children;
};

export default ProtectedRoute;