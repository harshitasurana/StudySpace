// src/pages/AdminLoginPage.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, verifyToken } from "../services/authService.js";
import myntiqlogo from "../assets/images/myntiq-leaf.png";
import "./AdminLoginPage/AdminLoginPage.css";
import { FaExclamationCircle, FaLock, FaHospital, FaShieldAlt, FaEye, FaEyeSlash } from "react-icons/fa";

const AdminLoginPage = () => {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(null);

  useEffect(() => {
    verifyToken()
      .then((data) => {
        if (data?.success) navigate("/home");
      })
      .catch(() => {});
  }, [navigate]);

  const formatLockedUntil = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLockedUntil(null);

    if (!identifier.trim() || !password) {
      setError("Please enter your email/username and password.");
      return;
    }

    setIsLoading(true);

    const isEmail = identifier.includes("@");
    const credentials = isEmail
      ? { email: identifier.trim(), password }
      : { username: identifier.trim(), password };

    try {
      await login(credentials);
      navigate("/home");
    } catch (err) {
      if (err.code === "ACCOUNT_LOCKED" && err.locked_until) {
        setLockedUntil(err.locked_until);
        setError(
          `Account locked due to multiple failed attempts. Try again after ${formatLockedUntil(err.locked_until)}.`
        );
      } else {
        setError(err.message || "Invalid credentials. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hc-auth-layout">
      <div className="container hc-auth-content">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            {/* Branding */}
            <div className="text-center mb-5">
              <img
                src={myntiqlogo}
                alt="MyntiQ Logo"
                style={{ width: "130px", height: "130px", objectFit: "contain", borderRadius: "50%" }}
              />
              <h1
                className="text-white fw-bold mt-3 mb-2"
                style={{ textShadow: "0 2px 10px rgba(0,0,0,0.2)", fontSize: "2.2rem" }}
              >
                MyntiQ HealthCare
              </h1>
              <p className="text-white-50 fs-6">
                Admin Portal — Manage healthcare facilities
              </p>
            </div>

            {/* Card */}
            <div className="card border-0 rounded-4 shadow-lg hc-glass-card">
              <div
                className="card-header border-0 py-4 hc-card-header"
                style={{ borderRadius: "1rem 1rem 0 0" }}
              >
                <h3 className="text-white text-center mb-0 fw-bold">
                  Sign In
                </h3>
              </div>

              <div className="card-body p-4 p-md-5">
                {/* Error */}
                {error && (
                  <div className={`alert rounded-3 mb-4 ${lockedUntil ? "alert-warning" : "alert-danger"}`}>
                    {lockedUntil ? <FaLock className="me-2" /> : <FaExclamationCircle className="me-2" />}
                    {error}
                  </div>
                )}

                <form onSubmit={handleCredentialsSubmit} noValidate>
                  <div className="mb-4">
                    <label htmlFor="identifier" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                      Email or Username <span className="text-danger">*</span>
                    </label>
                    <input
                      id="identifier"
                      type="text"
                      className="form-control hc-input"
                      style={{ height: "50px" }}
                      placeholder="Enter your email or username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="password" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                      Password <span className="text-danger">*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className="form-control hc-input"
                        style={{ height: "50px", paddingRight: "45px" }}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() => setShowPassword((prev) => !prev)}
                        disabled={isLoading}
                        tabIndex={-1}
                        style={{
                          position: "absolute",
                          right: "2px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "42px",
                          height: "42px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          border: 0,
                          background: "none",
                          color: "#6c757d",
                          zIndex: 5,
                        }}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="d-flex justify-content-end align-items-center mb-4">
                    <Link to="/forgot-password" className="text-decoration-none" style={{ color: "#1a709b", fontWeight: "500" }}>
                      Forgot Password?
                    </Link>
                  </div>

                  <div className="d-grid gap-2">
                    <button
                      type="submit"
                      className="btn btn-lg rounded-3 fw-semibold hc-btn-primary"
                      disabled={isLoading || Boolean(lockedUntil && new Date(lockedUntil) > new Date())}
                      style={{ height: "55px" }}
                    >
                      {isLoading ? (
                        <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Signing In...</>
                      ) : "Sign In"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-lg rounded-3 fw-semibold hc-btn-outline"
                      onClick={() => { setIdentifier(""); setPassword(""); setShowPassword(false); setError(""); setLockedUntil(null); }}
                      disabled={isLoading}
                      style={{ height: "55px" }}
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>

              <div className="card-footer bg-transparent border-0 py-3 text-center">
                <p className="text-muted mb-0 small">
                  Need access?{" "}
                  <Link to="#" className="text-decoration-none fw-semibold" style={{ color: "#1a709b" }}>
                    Contact your administrator
                  </Link>
                </p>
              </div>
            </div>

            {/* Page footer */}
            <div className="text-center mt-4">
              <p className="text-white-50 small mb-1">
                &copy; {new Date().getFullYear()} HealthCare Admin Portal. All rights reserved.
              </p>
              <div className="d-flex justify-content-center gap-3">
                <a href="#" className="text-white-50 text-decoration-none small">Privacy Policy</a>
                <a href="#" className="text-white-50 text-decoration-none small">Terms of Service</a>
                <a href="#" className="text-white-50 text-decoration-none small">Support</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative icons */}
      <div className="position-absolute" style={{ top: "10%", left: "5%", opacity: 0.08 }}>
        <FaHospital className="fs-1 text-white" />
      </div>
      <div className="position-absolute" style={{ bottom: "15%", right: "7%", opacity: 0.08 }}>
        <FaShieldAlt className="fs-1 text-white" />
      </div>
    </div>
  );
};

export default AdminLoginPage;
