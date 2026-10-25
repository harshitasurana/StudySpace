const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export const login = async (credentials) => {
  const response = await fetch(`${API_BASE_URL}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.message || "Login failed");
    err.code = data.code;
    err.locked_until = data.locked_until;
    err.statusCode = response.status;
    throw err;
  }

  return data;
};

export const verifyToken = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/verify`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error('Token invalid');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Token validation error:", error);
    throw error;
  }
};

export const refreshAccessToken = async () => {
  const response = await fetch(`${API_BASE_URL}/users/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    credentials: "include",
  });

  const data = await response.json();
  return data;
};

export const logout = async () => {
  try {
    await fetch(`${API_BASE_URL}/users/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout API error:", error);
  }

  localStorage.removeItem("hc_selected_org_id");
  localStorage.removeItem("hc_org_selection_mode");
};

export const forgotPassword = async (email) => {
  const response = await fetch(`${API_BASE_URL}/users/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.message || "Unable to send password reset email.");
    err.statusCode = response.status;
    throw err;
  }
  return data;
};

export const resetPassword = async ({ token, newPassword, confirmPassword }) => {
  const response = await fetch(`${API_BASE_URL}/users/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword, confirmPassword }),
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.message || "Password reset failed.");
    err.statusCode = response.status;
    throw err;
  }
  return data;
};

export const register = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.message || "Registration failed.");
    err.statusCode = response.status;
    throw err;
  }
  return data;
};

export const fetchWithAuth = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401) {
    await refreshAccessToken();
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
      },
    });
  }

  return response;
};