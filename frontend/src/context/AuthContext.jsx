import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("zera_token"));
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("zera_user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    async function loadProfile() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/profile");
        setUser(response.data.user);
        localStorage.setItem("zera_user", JSON.stringify(response.data.user));
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [token]);

  async function login(email, password) {
    const response = await api.post("/auth/login", { email, password });
    persistSession(response.data);
    return response.data.user;
  }

  async function register(payload) {
    const response = await api.post("/auth/register", payload);
    persistSession(response.data);
    return response.data.user;
  }

  function persistSession(data) {
    localStorage.setItem("zera_token", data.token);
    localStorage.setItem("zera_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("zera_token");
    localStorage.removeItem("zera_user");
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
