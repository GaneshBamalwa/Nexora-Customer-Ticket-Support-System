import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Mail, ShieldCheck, Zap } from "lucide-react";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsSent(true);
      setIsLoading(false);
      toast.success("Recovery link dispatched!", {
        description: "Check your inbox for password reset instructions."
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#020818] text-[#e0e0e0] overflow-hidden font-inter flex flex-col relative selection:bg-primary/30">
      <ImmersiveBackground variant="landing" intensity="heavy" />

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-[#020818]/80 backdrop-blur-2xl">
        <div className="container mx-auto px-4 py-8 flex items-center justify-between max-w-lg">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-1.5 rounded-lg border border-white/10 group-hover:border-primary/50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary neon-glow tracking-tighter">NEXORA</span>
          </div>
          <div className="w-12" />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 relative z-10">
        <div className="w-full max-w-lg space-y-8">
          
          <div className="text-center space-y-3 materialize">
             <h1 className="text-4xl font-extrabold tracking-tight">Recovery <span className="text-primary neon-glow">Protocol</span></h1>
             <p className="text-muted-foreground text-sm">Secure link will be sent to your verified identity</p>
          </div>

          <div className="glass-card-enhanced p-10 fade-slide-in relative overflow-hidden group border-white/10">
            {isSent ? (
              <div className="text-center space-y-8 materialize">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto border-2 border-primary/40 animate-bounce">
                  <ShieldCheck className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold">Encrypted Link Sent</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    A recovery sequence has been dispatched to <b>{email}</b>. 
                    The link will expire in 15 minutes.
                  </p>
                </div>
                <button 
                  onClick={() => setLocation("/")}
                  className="btn-primary w-full h-12 flex items-center justify-center gap-2"
                >
                  RETURN TO BASE
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] ml-1">Verified Email</label>
                  <div className={`relative group transition-all duration-300 ${focusedField === 'email' ? 'scale-[1.01]' : ''}`}>
                    <div className={`absolute inset-0 bg-primary/10 rounded-lg blur-md transition-opacity duration-300 ${focusedField === 'email' ? 'opacity-100' : 'opacity-0'}`} />
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        disabled={isLoading}
                        required
                        className="w-full h-14 px-5 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all outline-none"
                      />
                      <Mail className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground bg-white/5 p-4 rounded-lg border border-white/5">
                   <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
                   We'll scan our neural database for this identity and transmit a relay link.
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 rounded-lg bg-primary text-primary-foreground font-bold uppercase tracking-[0.2em] transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      RETRANSMITTING...
                    </>
                  ) : (
                    "DISPATCH RECOVERY LINK"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
