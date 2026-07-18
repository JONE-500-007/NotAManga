import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (identifier, password) => {
    const loggedInUser = await api.post("/auth/login", { identifier, password });
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const registeredUser = await api.post("/auth/register", { username, email, password });
    setUser(registeredUser);
    return registeredUser;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  // Re-fetches the full profile from the server, for cases where it may
  // have changed outside this tab's own state updates (e.g. verifying an
  // email via a link opened elsewhere while still logged in here).
  const refreshUser = useCallback(async () => {
    try {
      const fresh = await api.get("/auth/me");
      setUser(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
