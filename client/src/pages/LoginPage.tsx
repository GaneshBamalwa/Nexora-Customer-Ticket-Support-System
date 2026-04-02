import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { 
  ArrowRight, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Shield, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft,
  Zap
} from "lucide-react";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, authenticated, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  // Handle URL errors (like Google auth failure)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError === "google_auth_failed") {
      setError("Google authentication was cancelled or failed. Please try again.");
    } else if (urlError === "google_no_email") {
      setError("Your Google account doesn't have an email associated with it.");
    } else if (urlError === "staff_must_use_manual") {
      setError("Staff accounts must use the official identity provider. Please log in with your email and password.");
    } else if (urlError) {
      setError(`Authentication error: ${urlError}`);
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (authenticated && user) {
      const role = (user?.Role || user?.role || "").toLowerCase();
      if (role === "administrator") {
        setLocation("/admin-dashboard");
      } else if (role === "agent") {
        setLocation("/agent-dashboard");
      } else {
        setLocation("/portal");
      }
    }
  }, [authenticated, user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await login(email, password);
      toast.success(`Welcome back, ${data.user?.Name || 'User'}!`);
      
      const role = (data.user?.Role || data.user?.role || "").toLowerCase();
      if (data.needs_password_setup) {
        setLocation("/set-password");
      } else if (role === "administrator") {
        setLocation("/admin-dashboard");
      } else if (role === "agent") {
        setLocation("/agent-dashboard");
      } else {
        // Default to portal (customer)
        setLocation("/portal");
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please try again.");
      toast.error(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
  };

  const handleSSOLogin = (provider: string) => {
    toast.info(`Connecting to ${provider}...`, {
      description: "Redirecting to identity provider."
    });
    // Redirect to backend OAuth initiator
    window.location.href = `/api/auth/${provider.toLowerCase()}`;
  };

  return (
    <div className="min-h-screen bg-[#020818] text-[#e0e0e0] overflow-hidden font-inter flex flex-col relative selection:bg-primary/30">
      <ImmersiveBackground variant="landing" intensity="heavy" orbOpacity={0.15} />

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-[#020818]/80 backdrop-blur-2xl">
        <div className="container mx-auto px-4 py-6 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-primary neon-glow tracking-[0.2em]" style={{ fontFamily: "'Sora', sans-serif" }}>NEXORA</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 relative z-10">
        <div className="w-full max-w-lg space-y-8">
          
          {/* Header */}
          <div className="text-center mb-10 materialize">
            <div className="inline-block p-4 rounded-2xl bg-primary/10 border border-primary/20 mb-6 node-float">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-3">
              Staff <span className="neon-glow text-primary">Command Center</span>
            </h1>
            <p className="text-muted-foreground text-sm uppercase tracking-[0.3em]">
              Authorized Personnel Only
            </p>
          </div>

          {/* Login Card */}
          <div
            className="glass-card-enhanced p-10 fade-slide-in relative overflow-hidden group border-white/10"
            onClick={handleCardClick}
          >
            {ripples.map(ripple => (
              <div
                key={ripple.id}
                className="absolute pointer-events-none ripple-effect bg-primary/20"
                style={{
                  left: ripple.x,
                  top: ripple.y,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              />
            ))}

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3 animate-shake">
                  <Zap className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2 ml-1">Email ID</label>
                <div className={`relative group transition-all duration-300 ${focusedField === 'email' ? 'scale-[1.01]' : ''}`}>
                  <div className={`absolute inset-0 bg-primary/10 rounded-lg blur-md transition-opacity duration-300 ${focusedField === 'email' ? 'opacity-100' : 'opacity-0'}`} />
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      disabled={isLoading}
                      required
                      className="w-full h-14 px-5 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50 outline-none"
                    />
                    <Mail className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] ml-1">Password</label>
                  <button type="button" onClick={() => setLocation("/forgot-password")} className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-[0.2em] border-b border-transparent hover:border-primary/40 pb-0.5">Forgot Password?</button>
                </div>
                <div className={`relative group transition-all duration-300 ${focusedField === 'password' ? 'scale-[1.01]' : ''}`}>
                  <div className={`absolute inset-0 bg-primary/10 rounded-lg blur-md transition-opacity duration-300 ${focusedField === 'password' ? 'opacity-100' : 'opacity-0'}`} />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      disabled={isLoading}
                      required
                      className="w-full h-14 px-5 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50 pr-12 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 rounded-lg bg-primary text-primary-foreground font-bold uppercase tracking-[0.2em] transition-all duration-300 disabled:opacity-50 hover:shadow-[0_0_40px_rgba(0,229,255,0.4)] active:scale-[0.98] flex items-center justify-center gap-3 group overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 slant-glow" />
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    SECURE AUTH...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    LOGIN TO CENTER
                  </>
                )}
              </button>

            </form>
          </div>


        </div>
      </div>
    </div>
  );
}
