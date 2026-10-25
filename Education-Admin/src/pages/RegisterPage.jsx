import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../services/authService.js";
import myntiqlogo from "../assets/images/myntiq-leaf.png";
import { FaCheckCircle, FaExclamationCircle } from "react-icons/fa";

const RegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    account_email: "",
    username: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!form.account_email || !form.password || !form.confirmPassword || !form.first_name || !form.last_name) {
      setError("Please complete all required fields.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Password and confirm password must match.");
      return;
    }

    setIsLoading(true);
    try {
      await register({
        account_email: form.account_email.trim(),
        username: form.username.trim() || undefined,
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || undefined,
      });
      setMessage("Registration successful. You can now log in.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
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
                Create an Account
              </h1>
              <p className="text-white-50 fs-6">Register to access the MyntiQ HealthCare admin portal.</p>
            </div>

            <div className="card border-0 rounded-4 shadow-lg hc-glass-card">
              <div className="card-header border-0 py-4 hc-card-header" style={{ borderRadius: "1rem 1rem 0 0" }}>
                <h3 className="text-white text-center mb-0 fw-bold">Register</h3>
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
                  <div className="row g-3">
                    <div className="col-12">
                      <label htmlFor="email" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                        Email Address <span className="text-danger">*</span>
                      </label>
                      <input
                        id="email"
                        type="email"
                        className="form-control hc-input"
                        style={{ height: "50px" }}
                        placeholder="Enter your email"
                        value={form.account_email}
                        onChange={(e) => handleChange("account_email", e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label htmlFor="username" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                        Username
                      </label>
                      <input
                        id="username"
                        type="text"
                        className="form-control hc-input"
                        style={{ height: "50px" }}
                        placeholder="Optional username"
                        value={form.username}
                        onChange={(e) => handleChange("username", e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label htmlFor="firstName" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                        First Name <span className="text-danger">*</span>
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        className="form-control hc-input"
                        style={{ height: "50px" }}
                        placeholder="First name"
                        value={form.first_name}
                        onChange={(e) => handleChange("first_name", e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label htmlFor="lastName" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                        Last Name <span className="text-danger">*</span>
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        className="form-control hc-input"
                        style={{ height: "50px" }}
                        placeholder="Last name"
                        value={form.last_name}
                        onChange={(e) => handleChange("last_name", e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label htmlFor="phone" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                        Phone
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        className="form-control hc-input"
                        style={{ height: "50px" }}
                        placeholder="Optional phone number"
                        value={form.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label htmlFor="password" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                        Password <span className="text-danger">*</span>
                      </label>
                      <input
                        id="password"
                        type="password"
                        className="form-control hc-input"
                        style={{ height: "50px" }}
                        placeholder="Enter password"
                        value={form.password}
                        onChange={(e) => handleChange("password", e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label htmlFor="confirmPassword" className="form-label fw-medium mb-2" style={{ color: "#495057" }}>
                        Confirm Password <span className="text-danger">*</span>
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        className="form-control hc-input"
                        style={{ height: "50px" }}
                        placeholder="Confirm password"
                        value={form.confirmPassword}
                        onChange={(e) => handleChange("confirmPassword", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="d-grid gap-3 mt-4">
                    <button type="submit" className="btn btn-lg rounded-3 fw-semibold hc-btn-primary" disabled={isLoading} style={{ height: "55px" }}>
                      {isLoading ? (
                        <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Registering...</>
                      ) : (
                        "Create Account"
                      )}
                    </button>
                    <button type="button" className="btn btn-lg rounded-3 fw-semibold hc-btn-outline" onClick={() => setForm({ account_email: "", username: "", password: "", confirmPassword: "", first_name: "", last_name: "", phone: "" })} disabled={isLoading} style={{ height: "55px" }}>
                      Clear
                    </button>
                  </div>
                </form>

                <div className="text-center mt-4">
                  <p className="mb-1 text-white-50">Already have an account?</p>
                  <Link to="/login" className="text-decoration-none fw-medium" style={{ color: "#1a709b" }}>
                    Sign in instead
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

export default RegisterPage;
