import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Ticket, ArrowLeft, Eye, EyeOff, Cpu, Zap, Lock } from "lucide-react";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";
import { login } from "@/api";

export default function StaffLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await login(email, password);
      if (data.needs_password_setup) {
        setLocation("/set-password");
      } else if (data.user?.Role === "Administrator" || data.user?.role === "Administrator") {
        setLocation("/admin-dashboard");
      } else {
        setLocation("/agent-dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples([...ripples, { id, x, y }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
  };

  return (
    <div className="min-h-screen bg-[#020818] text-[#e0e0e0] overflow-hidden font-inter flex flex-col relative">
      <ImmersiveBackground variant="login" intensity="medium" showOrb={false} />

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-[#020818]/80 backdrop-blur-2xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-1.5 rounded-lg border border-white/10 group-hover:border-primary/50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary neon-glow tracking-tighter">NEXORA</span>
          </div>
          <div className="w-24"></div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 relative z-10">
        <div className="w-full max-w-md space-y-6">
          {/* Login Card */}
          <div
            className="glass-card-enhanced p-10 fade-slide-in relative overflow-hidden group cursor-pointer"
            onClick={handleCardClick}
          >
            {ripples.map(ripple => (
              <div
                key={ripple.id}
                className="absolute pointer-events-none ripple-effect"
                style={{
                  left: ripple.x,
                  top: ripple.y,
                  width: 20,
                  height: 20,
                  border: '2px solid rgba(0, 229, 255, 0.5)',
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              />
            ))}

            <div className="space-y-2 text-center mb-8 materialize" style={{ animationDelay: '0.1s' }}>
              <h1 className="text-3xl font-bold">Staff Portal</h1>
              <p className="text-muted-foreground text-sm">Access your support dashboard</p>
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

              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">Email</label>
                <div className={`relative transition-all duration-300 ${focusedField === 'email' ? 'scale-[1.02]' : ''}`}>
                  <input
                    type="email"
                    placeholder="your.email@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading}
                    className="w-full h-12 px-4 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50"
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">Password</label>
                <div className={`relative transition-all duration-300 ${focusedField === 'password' ? 'scale-[1.02]' : ''}`}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    disabled={isLoading}
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 rounded-lg bg-primary text-primary-foreground font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 hover:shadow-[0_0_30px_rgba(0,229,255,0.4)] active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    AUTHENTICATING...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    LOGIN
                  </>
                )}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-[#020818] text-muted-foreground">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEmail("admin@support.com");
                setPassword("admin1234");
              }}
              className="w-full py-3 px-4 rounded-lg border border-white/10 text-foreground hover:bg-white/5 hover:border-primary/30 transition-all text-sm font-semibold uppercase tracking-widest"
            >
              Use Demo Credentials
            </button>

            <p className="text-center text-xs text-muted-foreground mt-8">
              Not a staff member?{" "}
              <Link href="/" className="text-primary hover:text-primary/80 transition-colors font-semibold">
                Create a ticket
              </Link>
            </p>
          </div>

          {/* Info Box */}
          <div className="glass-card-enhanced p-6 materialize" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-bold text-white">Demo Credentials</p>
                <p>Admin: <span className="text-primary font-mono">admin@support.com</span> / <span className="text-primary font-mono">admin1234</span></p>
                <p>Agent: <span className="text-primary font-mono">ganesh@support.com</span> / <span className="text-primary font-mono">ganesh123</span></p>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="glass-card-enhanced p-4 materialize" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">System Status</span>
              <span className="flex items-center gap-1.5 text-green-400 font-bold">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                OPERATIONAL
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
