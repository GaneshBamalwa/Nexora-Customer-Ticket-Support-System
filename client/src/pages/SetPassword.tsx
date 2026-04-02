import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Lock, Eye, EyeOff, Zap, ShieldCheck } from "lucide-react";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";
import { getPasswordStatus, setPassword } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function SetPassword() {
  const { user, authenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [password, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) {
      setLocation("/");
      return;
    }
    // Check password status — if no action needed, redirect away
    getPasswordStatus()
      .then((status: any) => {
        if (status.has_password && !status.change_approved) {
          const role = (user?.Role || user?.role || "").toLowerCase();
          setLocation(role === "administrator" ? "/admin-dashboard" : "/agent-dashboard");
        }
      })
      .catch(() => {
        // If status check fails just let the user proceed
      })
      .finally(() => setIsChecking(false));
  }, [authenticated, user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await setPassword(password, confirm);
      toast.success("Password set successfully!");
      const role = (user?.Role || user?.role || "").toLowerCase();
      setLocation(role === "administrator" ? "/admin-dashboard" : "/agent-dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to set password.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#020818] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020818] text-[#e0e0e0] overflow-hidden font-inter flex flex-col relative">
      <ImmersiveBackground variant="login" intensity="medium" showOrb={false} />

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-[#020818]/80 backdrop-blur-2xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          <span className="text-xl font-bold text-primary neon-glow tracking-tighter">NEXORA</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 relative z-10">
        <div className="w-full max-w-md space-y-6">
          {/* Card */}
          <div className="glass-card-enhanced p-10 fade-slide-in relative overflow-hidden">

            <div className="space-y-2 text-center mb-8 materialize" style={{ animationDelay: '0.1s' }}>
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-full bg-primary/10 border border-primary/30">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h1 className="text-3xl font-bold">Set Your Password</h1>
              <p className="text-muted-foreground text-sm">
                You logged in with a temporary password. Create your permanent password below.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 materialize" style={{ animationDelay: '0.2s' }}>
              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-pulse">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    {error}
                  </div>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  New Password
                </label>
                <div className={`relative transition-all duration-300 ${focusedField === 'password' ? 'scale-[1.02]' : ''}`}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 chars, upper, lower, digit"
                    value={password}
                    onChange={(e) => setPass(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading}
                    required
                    className="w-full h-12 px-4 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Confirm Password
                </label>
                <div className={`relative transition-all duration-300 ${focusedField === 'confirm' ? 'scale-[1.02]' : ''}`}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading}
                    required
                    className="w-full h-12 px-4 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 rounded-lg bg-primary text-primary-foreground font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 hover:shadow-[0_0_30px_rgba(0,229,255,0.4)] active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    SAVING...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    SET PASSWORD
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Password requirements hint */}
          <div className="glass-card-enhanced p-4 materialize" style={{ animationDelay: '0.4s' }}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Password Requirements</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Minimum 8 characters</li>
              <li>• At least one uppercase letter</li>
              <li>• At least one lowercase letter</li>
              <li>• At least one digit</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
