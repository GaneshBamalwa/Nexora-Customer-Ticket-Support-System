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
  Activity,
  Database,
  Search,
  HardDrive,
  Loader2,
  Send,
  Clock
} from "lucide-react";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";
import { aiQuery, getPublicStats } from "@/api";
import ReactMarkdown from "react-markdown";

/**
 * Nexora - Immersive About Page
 * Futuristic, Premium SaaS, AI-Powered experience
 */

interface ChatMessage {
  role: "user" | "ai" | "ai-suggestion";
  text: string;
}

export default function About() {
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "ai", text: "Welcome to Nexora! How can I help you today?" }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("mousemove", handleMouseMove);

    // Fetch real stats
    getPublicStats().then(setStats).catch(console.error);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isTyping) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setChatMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsTyping(true);

    try {
      const response = await aiQuery(userMessage);
      setChatMessages(prev => [...prev, { role: "ai", text: response.answer }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: "ai", text: "Sorry, I'm having trouble connecting to my knowledge base right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const calculateOpacity = (start: number, end: number) => {
    const progress = (scrollY - start) / (end - start);
    return Math.max(0, Math.min(1, progress));
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto materialize">
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


      {/* Section 4: Engineering Excellence (Live Stats Visualization) */}
      <section className="py-24 relative overflow-hidden bg-primary/5">
        <div className="container">
          <div className="max-w-4xl mx-auto flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-8 fade-slide-in">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Activity className="w-3 h-3" />
                Live System Diagnostics
              </div>
              <h2 className="text-5xl font-bold tracking-tight leading-tight">
                Engineering <br /><span className="text-primary italic">Excellence</span>
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Nexora maintains a <span className="text-white font-bold">99.9% uptime</span> through redundant microservices and real-time SLA monitoring. Our infrastructure is built for speed and reliability.
              </p>
              
              <div className="grid grid-cols-2 gap-8 pt-4">
                {[
                  { label: "Active Tickets", value: stats?.pending ?? "12", sub: "Live Workload" },
                  { label: "Resolved", value: stats?.resolved ?? "842", sub: "Total Solutions" },
                  { label: "Uptime", value: stats?.uptime ?? "99.98%", sub: "Last 30 Days" },
                  { label: "Avg Latency", value: stats?.latency ?? "114ms", sub: "API Response" }
                ].map((stat, i) => (
                  <div key={i} className="space-y-1">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</div>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-[10px] text-primary font-bold uppercase tracking-tighter italic">{stat.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 w-full lg:max-w-md">
              <div className="glass-card p-10 relative overflow-hidden group min-h-[500px]">
                <div className="flex items-center justify-between mb-12">
                   <h3 className="text-sm font-bold uppercase tracking-widest text-white/50 px-2 border-l-2 border-primary">Database Core</h3>
                   <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/30" />
                   </div>
                </div>

                {/* Unified Vertical Pipeline UI */}
                <div className="relative px-2">
                  {/* Continuous Pipeline Base Track (Threads through everything) */}
                  <div className="absolute left-8 top-6 bottom-6 w-[2px] bg-primary/20 rounded-full" />
                  
                  {/* Glowing Overlay Line (Threading through nodes) */}
                  <div className="absolute left-8 top-6 bottom-6 w-[2px] bg-primary shadow-[0_0_10px_rgba(0,229,255,0.6)] rounded-full animate-pulse opacity-80" />
                  
                  {/* Optional: Subtle Animated Flow along the line */}
                  <div className="absolute left-8 top-6 bottom-6 w-[2px] overflow-hidden rounded-full">
                    <div className="w-full h-24 bg-gradient-to-b from-transparent via-white to-transparent animate-[streamingPulse_3s_linear_infinite] opacity-50" />
                  </div>

                  <div className="space-y-12">
                    {[
                      { icon: Search, label: "Query Ingestion", sub: "Request Received" },
                      { icon: Cpu, label: "Optimizer", sub: "Execution Plan Alpha" },
                      { icon: Database, label: "Table Scan", sub: "B-Tree Navigation" },
                      { icon: HardDrive, label: "Commit", sub: "Persistent Storage", synced: true }
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-6 relative group transform transition-transform hover:translate-x-1 duration-500">
                         {/* Opaque dark node background - Hides bar behind it */}
                         <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-primary/20 bg-[#0a0f1d] shadow-xl relative z-20">
                            <step.icon className="w-5 h-5 text-primary" />
                            <div className="absolute inset-0 bg-primary/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                         </div>
                         
                         <div className="space-y-1">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-white">{step.label}</h4>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">{step.sub}</p>
                         </div>

                         <div className="ml-auto">
                           <div className="text-[8px] font-bold py-1 px-2 rounded border border-primary/20 bg-primary/5 text-primary/70 uppercase tracking-tighter">
                             {step.synced ? "Synced" : "In Queue"}
                           </div>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Decoration */}
                <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Analytics & AI */}
      <section className="pt-20 pb-40 bg-gradient-to-b from-transparent to-primary/5">
        <div className="container">
          <div className="text-center mb-16 space-y-4 max-w-3xl mx-auto">
            <h2 className="text-5xl font-bold tracking-tight">Precision <span className="text-primary">Analytics & AI</span></h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Gain deep insights into team performance and interact with our project AI to learn more about Nexora.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center">
            
            {/* Interactive AI Chat Box - Expanded */}
            <div className="relative w-full max-w-4xl">
              <div className="glass-card p-8 h-[650px] flex flex-col shadow-2xl relative border border-white/10">
                {/* Chat Header */}
                <div className="flex items-center gap-4 pb-6 border-b border-white/5 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Cpu className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white uppercase tracking-wider mb-1">Nexora AI</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest text-primary/70">AI agent Active</span>
                    </div>
                  </div>
                </div>

                {/* Messages Area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto pr-4 space-y-6 custom-scrollbar mb-4">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${msg.role === 'user' ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        {msg.role === 'user' ? (
                          <>
                            <span className="text-[10px] font-bold uppercase tracking-tighter opacity-50">Authorized User</span>
                            <Users className="w-3 h-3 text-muted-foreground" />
                          </>
                        ) : (
                          <>
                            <Cpu className="w-3 h-3 text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-tighter text-primary">Nexora AI Agent</span>
                          </>
                        )}
                      </div>
                      <div
                        className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 prose prose-invert prose-p:my-0 prose-li:my-0 prose-ul:my-1 prose-strong:text-white whitespace-pre-wrap ${
                          msg.role === 'user' 
                          ? "bg-primary/20 text-white rounded-tr-none border border-primary/20" 
                          : "bg-white/5 text-white/90 rounded-tl-none border border-white/10"
                        }`}
                      >
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <Cpu className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter text-primary">Nexora AI Agent</span>
                      </div>
                      <div className="bg-white/5 text-white/90 p-4 rounded-2xl rounded-tl-none border border-white/10 flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-xs italic opacity-50 tracking-wider">Processing query...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="pt-6 border-t border-white/5 flex items-center gap-3">
                   <input 
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Describe your inquiry about Nexora's systems, team, or implementation..."
                    className="flex-1 h-14 bg-white/5 rounded-2xl border border-white/10 px-6 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                  <button 
                    type="submit"
                    disabled={!inputMessage.trim() || isTyping}
                    className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)]"
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </form>

                {/* Background Glow Accents */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
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

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 229, 255, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 229, 255, 0.5);
        }
      `}</style>
    </div>
  );
}
