const API_URL = import.meta.env.VITE_API_URL;

fetch(`${API_URL}/api/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ email, password })
});