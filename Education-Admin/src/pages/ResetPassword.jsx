import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../services/authService.js";
import myntiqlogo from "../assets/images/myntiq-leaf.png";
import { FaCheckCircle, FaExclamationCircle } from "react-icons/fa";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token") || "";
    setToken(tokenFromUrl);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Reset token is missing. Please use the link from your email.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword({ token, newPassword: password, confirmPassword });
      setMessage("Password reset successfully. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1400);
    } catch (err) {
      setError(err.message || "Unable to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="hc-auth-layout">
      <div className="container hc-auth-content">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="text-center mb-5">
              <img
                src={myntiqlogo}
                alt="MyntiQ Logo"
                style={{ width: "130px", height: "130px", objectFit: "contain", borderRadius: "50%" }}
              />
              <h1 className="text-white fw-bold mt-3 mb-2" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.2)", fontSize: "2.2rem" }}>
                Reset Password
              </h1>
              <p className="text-white-50 fs-6">Enter a new password for your account.</p>
            </div>

            <div className="card border-0 rounded-4 shadow-lg hc-glass-card">
              <div className="card-header border-0 py-4 hc-card-header" style={{ borderRadius: "1rem 1rem 0 0" }}>
                <h3 className="text-white text-center mb-0 fw-bold">Password Reset</h3>
              </div>

              <div className="card-body p-4 p-md-5">
                {message && (
                  <div className="alert alert-success rounded-3 mb-4">
                    <FaCheckCircle className="me-2" />
                    {message}
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger rounded-3 mb-4">
                    <FaExclamationCircle className="me-2" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="mb-4">
                    <label htmlFor="newPassword" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                      New Password <span className="text-danger">*</span>
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      className="form-control hc-input"
                      style={{ height: "50px" }}
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="confirmPassword" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                      Confirm Password <span className="text-danger">*</span>
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      className="form-control hc-input"
                      style={{ height: "50px" }}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="d-grid gap-3">
                    <button type="submit" className="btn btn-lg rounded-3 fw-semibold hc-btn-primary" disabled={isLoading} style={{ height: "55px" }}>
                      {isLoading ? (
                        <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Resetting...</>
                      ) : (
                        "Reset Password"
                      )}
                    </button>
                  </div>
                </form>

                <div className="text-center mt-4">
                  <Link to="/login" className="text-decoration-none fw-medium" style={{ color: "#1a709b" }}>
                    Back to Login
                  </Link>
                </div>
              </div>
            </div>

            <div className="text-center mt-4">
              <p className="text-white-50 mb-1">&copy; {new Date().getFullYear()} HealthCare Admin Portal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
