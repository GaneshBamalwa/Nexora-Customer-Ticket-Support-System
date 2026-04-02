import { useState } from "react";
import { useLocation } from "wouter";
import { initializeDemo } from "@/api";
import { toast } from "sonner";
import { Rocket, ShieldCheck, Database, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useDemoMission } from "@/hooks/useDemoMission";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";

export default function DemoStart() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const { resetMission } = useDemoMission();

  const handleStart = async () => {
    setLoading(true);
    try {
      // 1. Reset localStorage Mission Progress
      resetMission();
      
      // 2. Initialize Backend Session (clears isolation DB, seeds starter ticket)
      await initializeDemo();
      
      toast.success("Demo Sandbox Initialized! Redirecting...", {
        description: "You are now entering an isolated, mission-guided environment."
      });
      
      // 3. Redirect to restricted dashboard
      setTimeout(() => {
        window.location.href = "/admin-dashboard";
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to initialize demo.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020818] flex items-center justify-center p-6 relative overflow-hidden">
      <ImmersiveBackground variant="landing" intensity="heavy" />
      
      <div className="max-w-xl w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-[2rem] p-8 md:p-12 shadow-2xl relative z-10 text-center">
        <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-8 animate-bounce">
          <Rocket className="w-10 h-10 text-primary" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4 neon-glow">
          START THE <span className="text-primary">MISSION</span>
        </h1>
        
        <p className="text-muted-foreground text-lg mb-10 font-medium leading-relaxed">
          Experience Nexora like a pro recruiter. We've set up an isolated sandbox
          just for you to explore our advanced AI support features.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 text-left">
          <div className="p-4 bg-white/5 rounded-xl border border-white/5">
            <ShieldCheck className="w-5 h-5 text-green-400 mb-2" />
            <h3 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Isolated Sandbox</h3>
            <p className="text-[11px] text-muted-foreground">Your own database. Zero risk to production tables.</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/5">
            <Zap className="w-5 h-5 text-yellow-400 mb-2" />
            <h3 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Mission Guided</h3>
            <p className="text-[11px] text-muted-foreground">Step-by-step checklist to master the platform.</p>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={loading}
          className="group w-full py-5 bg-primary text-primary-foreground rounded-2xl font-black text-xl flex items-center justify-center gap-3 hover:shadow-[0_0_50px_rgba(0,229,255,0.4)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              SYSTEMS ENGAGE <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
        
        <p className="mt-6 text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold">
          <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse mr-2" />
          Session-Based Isolation Enabled
        </p>
      </div>
    </div>
  );
}
