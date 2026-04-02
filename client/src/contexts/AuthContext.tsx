import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCurrentUser, isAuthenticated, login as apiLogin, logout as apiLogout, loginWithToken } from "@/api";

interface User {
  ID: number;
  Name: string;
  Email: string;
  email?: string;
  Email_ID?: string;
  Role: string;
  role?: string;
  agent_id?: number;
  Agent_ID?: number;
}

interface AuthContextType {
  user: User | null;
  authenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const bootstrap = async () => {
      // 1. Check for ?token= in URL (Google OAuth callback)
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");

      try {
        if (urlToken) {
          try {
            const resolvedUser = await loginWithToken(urlToken);
            setUser(resolvedUser);
            setAuthenticated(true);
            // Clean the token from the URL bar
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Automatic role-based redirection for SSO users
            const role = resolvedUser.role || resolvedUser.Role;
            if (role === "administrator") window.location.href = "/admin-dashboard";
            else if (role === "agent") window.location.href = "/agent-dashboard";
            else window.location.href = "/portal";
          } catch (err) {
            console.error("Token login failed:", err);
          }
        } else {
          const storedUser = getCurrentUser();
          const isAuth = isAuthenticated();
          setUser(storedUser);
          setAuthenticated(isAuth);
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setUser(data.user);
    setAuthenticated(true);
    return data;
  };

  const logout = () => {
    apiLogout();
    // Clear all persistent user-related data from storage
    localStorage.clear();
    sessionStorage.clear();
    setUser(null);
    setAuthenticated(false);
    
    // Perform a full page reset to clear any in-memory React state
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, authenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
