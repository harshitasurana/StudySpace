// src/components/ForgetPassword.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/authService.js";
import myntiqlogo from "../assets/images/myntiq-leaf.png";
import "./ForgetPassword/ForgetPassword.css";
import { FaCheckCircle, FaExclamationCircle, FaArrowLeft } from "react-icons/fa";
const ForgetPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await forgotPassword(email.trim());
      setMessage(response.message || "Password reset instructions have been sent to your email.");
      setEmail("");
    } catch (err) {
      setError(err.message || "Unable to send password reset instructions.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setEmail("");
    setMessage("");
    setError("");
  };

  return (
    <div className="hc-auth-layout">
      <div className="container hc-auth-content">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            {/* Branding Header */}
            <div className="text-center mb-5">
              <div
                className="d-inline-block"
                style={{
                  width: "200px",
                  height: "200px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={myntiqlogo}
                  alt="MyntiQ Logo"
                  style={{
                    width: "90%",
                    height: "90%",
                    objectFit: "contain",
                    borderRadius: "50%",
                  }}
                />
              </div>
              <h1
                className="text-white fw-bold mb-3"
                style={{
                  textShadow: "0 2px 10px rgba(0,0,0,0.2)",
                  fontSize: "2.5rem",
                }}
              >
                Reset Your Password
              </h1>
              <p
                className="text-white-50 fs-5"
                style={{ maxWidth: "500px", margin: "0 auto" }}
              >
                Enter your email to receive password reset instructions
              </p>
            </div>

            {/* Forgot Password Card */}
            <div className="card border-0 rounded-4 shadow-lg overflow-hidden hc-glass-card">
              <div
                className="card-header border-0 py-4 hc-card-header"
              >
                <h3 className="text-white text-center mb-0 fw-bold">
                  Password Recovery
                </h3>
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

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label
                      htmlFor="email"
                      className="form-label fw-medium mb-2"
                      style={{ color: "#495057" }}
                    >
                      Email Address <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      className="form-control hc-input"
                      style={{
                        height: "50px",
                      }}
                      id="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="d-grid gap-3">
                    <button
                      type="submit"
                      className="btn btn-lg rounded-3 fw-semibold py-3 hc-btn-primary"
                      disabled={isLoading}
                      style={{
                        fontWeight: "500",
                        transition: "all 0.3s ease",
                        height: "55px",
                      }}
                    >
                      {isLoading ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          ></span>
                          Sending...
                        </>
                      ) : (
                        "Reset Password"
                      )}
                    </button>

                    <button
                      type="button"
                      className="btn btn-lg rounded-3 fw-semibold py-3 hc-btn-outline"
                      onClick={handleReset}
                      style={{
                        fontWeight: "500",
                        transition: "all 0.3s ease",
                        height: "55px",
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </form>

                <div className="text-center mt-4">
                  <Link
                    to="/login"
                    className="text-decoration-none fw-medium"
                    style={{ color: "#1a709b" }}
                  >
                    <FaArrowLeft className="me-1" />Back to Login
                  </Link>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-4">
              <p className="text-white-50 mb-1">
                &copy; {new Date().getFullYear()} HealthCare Admin Portal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;
