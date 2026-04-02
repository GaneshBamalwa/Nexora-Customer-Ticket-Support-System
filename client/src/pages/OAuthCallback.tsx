import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { loginWithToken } from "@/api";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";

/**
 * OAuthCallback
 * ─────────────
 * Handles the redirect from the backend after Google OAuth.
 * Reads ?token= from the URL, calls /api/auth/me to validate,
 * stores user + JWT, then redirects to the correct dashboard by role.
 */
export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleOAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const error = params.get("error");

      if (error) {
        setErrorMsg(
          error === "google_auth_failed"
            ? "Google authentication failed. Please try again."
            : "Authentication error. Please try again."
        );
        setStatus("error");
        setTimeout(() => setLocation("/"), 3000);
        return;
      }

      if (!token) {
        setErrorMsg("No authentication token received.");
        setStatus("error");
        setTimeout(() => setLocation("/"), 3000);
        return;
      }

      try {
        const user = await loginWithToken(token);
        // Clean the token from the URL bar
        window.history.replaceState({}, document.title, "/");

        const role = (user?.Role || user?.role || "").toLowerCase();
        if (role === "administrator") {
          setLocation("/admin-dashboard");
        } else if (role === "agent") {
          setLocation("/agent-dashboard");
        } else {
          setLocation("/portal");
        }
      } catch {
        setErrorMsg("Failed to validate your session. Please log in again.");
        setStatus("error");
        setTimeout(() => setLocation("/"), 3000);
      }
    };

    handleOAuth();
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-[#020818] text-white flex items-center justify-center relative">
      <ImmersiveBackground variant="landing" intensity="light" orbOpacity={0.1} />
      <div className="relative z-10 text-center space-y-4">
        {status === "loading" ? (
          <>
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground text-sm uppercase tracking-widest">
              Authenticating with Google...
            </p>
          </>
        ) : (
          <>
            <div className="text-red-400 text-4xl">✕</div>
            <p className="text-red-400 font-semibold">{errorMsg}</p>
            <p className="text-muted-foreground text-xs">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
}
