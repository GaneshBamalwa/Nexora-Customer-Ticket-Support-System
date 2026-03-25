import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  Ticket,
  Users,
  Zap,
  Shield,
  ArrowLeft,
  MessageSquare,
  Cpu,
  Network,
  Bell,
  BarChart3,
  ChevronRight,
  ArrowRight,
  MousePointer2,
  Clock
} from "lucide-react";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";

/**
 * Nexora - Immersive About Page
 * Futuristic, Premium SaaS, AI-Powered experience
 */

export default function About() {
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeMessage, setActiveMessage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("mousemove", handleMouseMove);

    // Simulate chat messages
    const interval = setInterval(() => {
      setActiveMessage((prev) => (prev < 2 ? prev + 1 : 0));
    }, 3000);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
      clearInterval(interval);
    };
  }, []);

  const calculateOpacity = (start: number, end: number) => {
    const progress = (scrollY - start) / (end - start);
    return Math.max(0, Math.min(1, progress));
  };

  const calculateTransform = (start: number, end: number, maxDistance: number) => {
    const progress = (scrollY - start) / (end - start);
    return Math.max(0, Math.min(maxDistance, progress * maxDistance));
  };

  return (
    <div className="min-h-screen bg-[#020818] text-[#e0e0e0] overflow-x-hidden font-inter selection:bg-primary/30" ref={containerRef}>
      {/* Custom Cursor Glow */}
      <div
        className="fixed pointer-events-none z-[9999] w-[250px] h-[250px] rounded-full opacity-10 blur-[80px] bg-primary transition-transform duration-100 ease-out hidden md:block"
        style={{
          transform: `translate(${mousePos.x - 125}px, ${mousePos.y - 125}px)`,
        }}
      />

      {/* Navigation Header */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#020818]/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-1.5 rounded-lg border border-white/10 group-hover:border-primary/50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">Home</Link>
            <Link href="/staff-login" className="text-sm font-medium px-4 py-2 rounded-full border border-primary/20 hover:bg-primary/10 transition-all">Sign In</Link>
          </div>
        </div>
      </header>

      <ImmersiveBackground variant="landing" intensity="medium" />

      {/* Section 1: Hero (System Core) */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Parallax Background */}
        <div
          className="absolute inset-0 grid-bg-animated opacity-20"
          style={{ transform: `translateY(${scrollY * 0.2}px)` }}
        />

        <div className="container relative z-10 text-center">
          <div
            className="transition-all duration-700"
            style={{
              opacity: Math.max(0, 1 - scrollY / 500),
              transform: `translateY(${-scrollY * 0.1}px)`
            }}
          >
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
              NEXORA
            </h1>
            <p className="text-xl md:text-2xl text-primary font-medium tracking-[0.2em] uppercase neon-glow">
              AI-Powered Support System
            </p>
          </div>

          {/* Floating Energy Core (Restored) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[500px] aspect-square pointer-events-none opacity-30 select-none -z-10">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute inset-[10%] border border-primary/30 rounded-full animate-[spin_20s_linear_infinite]" />
            <div className="absolute inset-[20%] border border-secondary/20 rounded-full animate-[spin_30s_linear_reverse_infinite]" />
            <div className="absolute inset-[30%] border border-primary/10 rounded-full animate-[spin_40s_linear_infinite]" />
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-50">
          <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-primary rounded-full" />
          </div>
        </div>
      </section>

      {/* Project Description Section */}
      <section className="py-24 relative z-10 border-y border-white/5 bg-[#020818]/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row gap-12 items-center">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary tracking-wider uppercase">
                  <Zap className="w-3 h-3" /> Core Intelligence
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">About Nexora</h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Nexora is a next-generation AI-powered customer support platform designed to streamline communication, automate responses, and provide real-time insights into support operations. Built with a focus on performance, scalability, and intelligent workflows, Nexora transforms traditional ticketing systems into a dynamic, interactive experience.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  {[
                    "AI-assisted responses",
                    "SLA-driven workflows",
                    "Real-time analytics"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm font-medium text-white/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full md:w-1/3 aspect-square glass-card flex items-center justify-center relative group">
                <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                <Network className="w-24 h-24 text-primary/40 group-hover:text-primary transition-all duration-500 group-hover:scale-110" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: The Architects (Restored Position) */}
      <section className="py-40 relative z-10 border-t border-white/5">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-20 fade-slide-in">The Architects</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto materialize">
            {[
              {
                name: "Ganesh Bamalwa",
                role: "Co-Developer",
                bio: "I build cool stuff.",
                linkedin: "https://www.linkedin.com/in/ganeshbamalwa/",
                github: "https://github.com/GaneshBamalwa",
              },
              {
                name: "Rudransh Kadiveti",
                role: "Co-developer",
                bio: "Backend designer and SQL expert",
                linkedin: "https://www.linkedin.com/in/rudransh-kadiveti-2b3b96292",
                github: "https://github.com/RudranshKadiveti",
              },
              {
                name: "Manohar Adimalla",
                role: "Backend Systems Lead",
                bio: "Database optimization and API design. PostgreSQL & microservices expert.",
                linkedin: "https://in.linkedin.com/in/naga-manohar-adimalla-a7773b326",
                github: "https://github.com/Manohar9111",
              },
            ].map((developer, idx) => (
              <div
                key={idx}
                className="glass-card p-8 group hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,229,255,0.15)] transition-all duration-500 fade-slide-in"
                style={{ animationDelay: `${idx * 0.2}s` }}
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {developer.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                </div>
                <h4 className="text-xl font-bold text-center mb-2 group-hover:text-primary transition-colors">{developer.name}</h4>
                <p className="text-sm text-primary font-bold text-center mb-4 uppercase tracking-widest">{developer.role}</p>
                <p className="text-muted-foreground text-center text-sm leading-relaxed">{developer.bio}</p>

                {(developer.linkedin || developer.github) && (
                  <div className="mt-8 pt-8 border-t border-white/5 flex justify-center gap-6">
                    {developer.linkedin && (
                      <a href={developer.linkedin} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      </a>
                    )}
                    {developer.github && (
                      <a href={developer.github} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Section 4: SLA / Alerts (Urgency Visualization) */}
      <section className="py-20 relative overflow-hidden">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">Uncompromising Reliability</h2>
            <p className="text-muted-foreground">Real-time SLA monitoring ensures no ticket is ever left behind.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { label: "Normal", time: "24h left", status: "ok", color: "primary" },
              { label: "Warning", time: "4h left", status: "warning", color: "yellow-400" },
              { label: "Overdue", time: "Expired", status: "alert", color: "red-500" }
            ].map((item, i) => (
              <div key={i} className="glass-card p-8 group relative overflow-hidden">
                {item.status === 'alert' && <div className="absolute inset-0 bg-red-500/5 animate-pulse" />}

                <div className="relative z-10">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 border transition-colors ${item.status === 'ok' ? "bg-primary/10 border-primary/20" :
                    item.status === 'warning' ? "bg-yellow-500/10 border-yellow-500/20" :
                      "bg-red-500/10 border-red-500/20"
                    }`}>
                    <Bell className={`w-6 h-6 ${item.status === 'ok' ? "text-primary" :
                      item.status === 'warning' ? "text-yellow-400" :
                        "text-red-500 animate-bounce"
                      }`} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{item.label}</h3>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className={`text-sm font-mono ${item.status === 'alert' ? "text-red-500" : "text-muted-foreground"
                      }`}>
                      {item.time}
                    </span>
                  </div>

                  {/* Ticking Effect for Overdue */}
                  {item.status === 'alert' && (
                    <div className="mt-6 flex gap-1">
                      {[...Array(5)].map((_, j) => (
                        <div key={j} className="h-1 flex-1 bg-red-500/20 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 animate-[shimmer_2s_infinite]" style={{ animationDelay: `${j * 0.2}s` }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: Analytics & AI */}
      <section className="pt-20 pb-40 bg-gradient-to-b from-transparent to-primary/5">
        <div className="container">
          <div className="text-center mb-16 space-y-4 max-w-3xl mx-auto">
            <h2 className="text-5xl font-bold tracking-tight">Precision <span className="text-primary">Analytics & AI</span></h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Gain deep insights into team performance and experience our contextual AI that learns from every interaction.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-12 items-stretch justify-center">
            
            {/* Chat Box */}
            <div className="relative w-full lg:w-1/2 max-w-lg">
              <div className="glass-card p-6 h-full flex flex-col justify-end space-y-4 shadow-2xl relative overflow-hidden">
                {/* Chat Messages */}
                {[
                  { role: "user", text: "How do I reset my API key?" },
                  { role: "ai", text: "I can help with that. You can find the reset option in your dashboard under Settings > API." },
                  { role: "ai-suggestion", text: "Would you like me to send a direct link?" }
                ].map((msg, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-lg text-sm transition-all duration-500 ${i <= activeMessage ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                      } ${msg.role === 'user' ? "bg-white/5 ml-8" : "bg-primary/10 mr-8 border border-primary/20"
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {msg.role === 'user' ? <Users className="w-3 h-3 text-muted-foreground" /> : <Cpu className="w-3 h-3 text-primary" />}
                      <span className="text-[10px] font-bold uppercase tracking-tighter opacity-50">
                        {msg.role === 'user' ? "Customer" : "Nexora AI"}
                      </span>
                    </div>
                    {msg.text}
                    {msg.role === 'ai-suggestion' && (
                      <button className="mt-3 w-full py-2 rounded bg-primary text-primary-foreground font-bold text-xs hover:scale-[1.02] active:scale-95 transition-all">
                        USE REPLY
                      </button>
                    )}
                  </div>
                ))}

                <div className="pt-4 flex items-center gap-2">
                  <div className="flex-1 h-10 bg-white/5 rounded-full border border-white/10 px-4 flex items-center text-xs text-muted-foreground">
                    Type a message...
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center relative z-10">
                    <ArrowRight className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>

                {/* Glow Decoration */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
              </div>
            </div>

            {/* System Performance */}
            <div className="w-full lg:w-1/2 max-w-lg glass-card p-8 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">System Performance</h3>
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>

              <div className="space-y-6">
                {[
                  { label: "AI Accuracy", width: "94%", color: "primary" },
                  { label: "SLA Compliance", width: "99%", color: "secondary" },
                  { label: "User Satisfaction", width: "88%", color: "primary" }
                ].map((bar, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
                      <span>{bar.label}</span>
                      <span>{bar.width}</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-${bar.color} transition-all duration-1000 ease-out`}
                        style={{ width: calculateOpacity(2500, 3500) > 0.5 ? bar.width : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 grid grid-cols-7 gap-2 items-end h-24">
                {[40, 60, 45, 90, 65, 80, 70].map((h, i) => (
                  <div
                    key={i}
                    className="bg-primary/20 rounded-t hover:bg-primary/40 transition-all duration-500"
                    style={{ height: calculateOpacity(2500, 3500) > 0.5 ? `${h}%` : '0%' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-60 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full scale-150" />

        <div className="container relative z-10 text-center">
          <div className="max-w-3xl mx-auto space-y-12">
            <h2 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-tight">
              Nexora — One Platform.<br />
              <span className="text-primary neon-glow">Complete Control.</span>
            </h2>

            <Link href="/">
              <button className="btn-primary text-lg px-12 py-5 rounded-full shadow-[0_0_40px_rgba(0,229,255,0.4)] hover:shadow-[0_0_60px_rgba(0,229,255,0.6)] group">
                Go to Dashboard
                <ArrowRight className="inline-block ml-2 group-hover:translate-x-2 transition-transform" />
              </button>
            </Link>
          </div>
        </div>

        {/* Floating elements that collapse into center on scroll would go here, 
            simulated with scale and opacity */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-1000"
          style={{
            opacity: calculateOpacity(4000, 5000),
            transform: `scale(${2 - calculateOpacity(4000, 5000)})`
          }}
        >
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-primary rounded-full animate-ping" />
          <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-secondary rounded-full animate-pulse" />
          <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-primary rounded-full animate-ping" />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 bg-[#020818]">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Cpu className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tighter text-white">NEXORA</span>
            </div>

            <div className="text-sm text-muted-foreground">
              &copy; 2026 Nexora. All rights reserved. Built for the future of support.
            </div>

            <div className="flex gap-6">
              <span className="text-xs font-bold uppercase tracking-widest hover:text-primary cursor-pointer transition-colors">Privacy</span>
              <span className="text-xs font-bold uppercase tracking-widest hover:text-primary cursor-pointer transition-colors">Terms</span>
              <span className="text-xs font-bold uppercase tracking-widest hover:text-primary cursor-pointer transition-colors">Status</span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .selection\\:bg-primary\\/30 ::selection {
          background-color: rgba(0, 229, 255, 0.3);
        }

        /* Smooth scrolling for the whole page */
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
