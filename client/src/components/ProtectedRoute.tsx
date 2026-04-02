import React, { ReactNode } from "react";
import { Redirect, Route } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
  roles?: string[];
}

export function ProtectedRoute({ children, roles }: { children: ReactNode, roles?: string[] }) {
  const { authenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return <Redirect to="/" />;
  }

  if (roles && user && !roles.includes(user.Role || "")) {
    const role = user.Role?.toLowerCase() || "";
    if (role === "administrator") return <Redirect to="/admin-dashboard" />;
    if (role === "agent") return <Redirect to="/agent-dashboard" />;
    return <Redirect to="/portal" />;
  }

  return <>{children}</>;
}
