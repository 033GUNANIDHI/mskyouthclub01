export const API_URL = import.meta.env.VITE_API_URL || "https://mskyouthclub01-1.onrender.com";

export async function api(path, options = {}) {
  const token = localStorage.getItem("msk_token");

  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export function getToken() {
  return localStorage.getItem("msk_token");
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("msk_user") || "null");
  } catch {
    return null;
  }
}

export function setAuth(token, user) {
  localStorage.setItem("msk_token", token);
  localStorage.setItem("msk_user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("msk_token");
  localStorage.removeItem("msk_user");
}
