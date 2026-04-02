import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, MessageSquare, Search, ArrowRight, Menu, X, Cpu, Zap, Shield, Star, RefreshCw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";
import { 
  customerLogin, 
  customerSignUp, 
  raiseTicket, 
  searchHistory, 
  rateTicket, 
  followUp,
  demoLogin
} from "@/api";
import { toast } from "sonner";
import confetti from "canvas-confetti";

import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useDemoMission } from "@/hooks/useDemoMission";

export default function Home() {
  const { logout, user } = useAuth();
  const { currentStep, isDemo } = useDemoMission();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "history">(() => (sessionStorage.getItem("homeActiveTab") as "new" | "history") || "new");
  const [scrollY, setScrollY] = useState(0);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const [, setLocation] = useLocation();

  const handleDemoLogin = () => {
    // Redirect to the new dedicated demo start page
    setLocation("/demo-start");
  };
  const [formData, setFormData] = useState({
    email: user?.Email_ID || "",
    subject: "",
    priority: "Medium",
    description: "",
  });
  const [trackingEmail, setTrackingEmail] = useState(() => sessionStorage.getItem("trackingEmail") || user?.Email_ID || "");
  const [trackingStatus, setTrackingStatus] = useState(() => sessionStorage.getItem("trackingStatus") || "All");
  const [trackingPriority, setTrackingPriority] = useState(() => sessionStorage.getItem("trackingPriority") || "All");
  const [ticketHistory, setTicketHistory] = useState<any[]>(() => {
    const saved = sessionStorage.getItem("ticketHistory");
    return saved ? JSON.parse(saved) : [];
  });
  const [customerName, setCustomerName] = useState(() => sessionStorage.getItem("customerName") || user?.Name || "");

  useEffect(() => {
    // If user's session was just loaded, ensure the forms reflect this
    if (user?.Email_ID) {
      if (!formData.email) setFormData(prev => ({ ...prev, email: user.Email_ID || "" }));
      if (!trackingEmail) setTrackingEmail(user.Email_ID);
      if (!customerName) setCustomerName(user.Name);
    }
  }, [user]);

  useEffect(() => {
    sessionStorage.setItem("trackingEmail", trackingEmail);
    sessionStorage.setItem("trackingStatus", trackingStatus);
    sessionStorage.setItem("trackingPriority", trackingPriority);
    sessionStorage.setItem("ticketHistory", JSON.stringify(ticketHistory));
    sessionStorage.setItem("customerName", customerName);
    sessionStorage.setItem("homeActiveTab", activeTab);
  }, [trackingEmail, trackingStatus, trackingPriority, ticketHistory, customerName, activeTab]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await raiseTicket(formData);
      toast.success("Ticket raised successfully!");
      setFormData({ email: "", subject: "", priority: "Medium", description: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to raise ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrackTicket = async () => {
    if (!trackingEmail) return;
    setIsSearching(true);
    try {
      const filters: any = { email: trackingEmail };
      if (trackingStatus !== "All") filters.filter_status = trackingStatus;
      if (trackingPriority !== "All") filters.filter_priority = trackingPriority;
      const data = await searchHistory(filters);
      setTicketHistory(data.history || []);
      setCustomerName(data.customer_name || "");
      if (data.history?.length === 0) {
        toast.info("No tickets found for this email.");
      }
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleResetTracker = () => {
    setTrackingEmail("");
    setTrackingStatus("All");
    setTrackingPriority("All");
    setTicketHistory([]);
    setCustomerName("");
  };

  const handleRate = async (ticketId: number, rating: number) => {
    try {
      await rateTicket(ticketId, rating);
      toast.success("Rating submitted!");
      handleTrackTicket(); // refresh
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleFollowUp = async (ticketId: number) => {
    try {
      await followUp(ticketId);
      toast.success("Follow-up sent!");
      handleTrackTicket();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const triggerConfetti = () => {
    const end = Date.now() + 1.5 * 1000; // 1.5 seconds
    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#00e5ff', '#b537f2', '#ffffff']
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#00e5ff', '#b537f2', '#ffffff']
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const features = [
    { icon: Cpu, label: "Core Support", desc: "Automated efficiency" },
    { icon: Zap, label: "Lightning Fast", desc: "Real-time responses" },
    { icon: Shield, label: "Secure", desc: "Enterprise protection" },
    { icon: MessageSquare, label: "Seamless", desc: "Unified platform" }
  ];

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "High": return "text-red-400";
      case "Medium": return "text-yellow-400";
      case "Low": return "text-green-400";
      default: return "text-muted-foreground";
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case "Open": return "status-badge status-open";
      case "Resolved": return "status-badge status-resolved";
      default: return "status-badge status-pending";
    }
  };

  const [isManualLogin, setIsManualLogin] = useState(true);
  const [manualData, setManualData] = useState({ email: "", password: "", name: "" });
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      if (isManualLogin) {
        const res = await customerLogin({ email: manualData.email, password: manualData.password });
        if (res.token) {
          window.location.href = "/portal";
        }
      } else {
        const res = await customerSignUp(manualData);
        if (res.token) {
          toast.success("Account created successfully!");
          window.location.href = "/portal";
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleManualChange = (field: string, value: string) => {
    setManualData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-[#020818] text-[#e0e0e0] overflow-x-hidden font-inter selection:bg-primary/30 relative">
      <ImmersiveBackground variant="landing" intensity="heavy" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-[60] border-b border-white/5 bg-[#020818]/80 backdrop-blur-2xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <span
              className="text-xl font-semibold neon-glow bg-gradient-to-r from-[#00e5ff] to-[#66d4ff] bg-clip-text text-transparent"
              style={{ fontFamily: "'Sora', sans-serif", letterSpacing: '2px' }}
            >NEXORA</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-semibold text-foreground hover:text-primary transition-colors">Home</Link>
            <Link href="/about" className="text-sm font-semibold text-foreground hover:text-primary transition-colors">About</Link>
            {user ? (
              <button onClick={logout} className="text-sm font-semibold text-muted-foreground hover:text-red-400 transition-colors uppercase tracking-[0.2em] border border-white/10 px-4 py-2 rounded-lg hover:border-red-400/30">Logout</button>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors uppercase tracking-[0.2em] border border-white/10 px-4 py-2 rounded-lg hover:border-primary/30">Staff Login</Link>
            )}
          </nav>

          <button
            className="md:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-white/[0.02] backdrop-blur-2xl">
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
              <Link href="/" className="text-foreground hover:text-primary transition-colors">Home</Link>
              <Link href="/about" className="text-foreground hover:text-primary transition-colors">About</Link>
              {user && user.Role !== "Customer" ? (
                <button onClick={logout} className="text-muted-foreground hover:text-red-400 transition-colors text-left uppercase tracking-[0.2em] pt-4 border-t border-white/5">Logout</button>
              ) : (
                <Link href="/login" className="text-muted-foreground hover:text-primary transition-colors text-left uppercase tracking-[0.2em] pt-4 border-t border-white/5">Staff Login</Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        <div className="container relative z-10 text-center space-y-12">
          <div className="space-y-6 fade-slide-in max-w-3xl mx-auto flex flex-col items-center justify-center">
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter leading-tight">
              How can we <span className="text-primary neon-glow">help you?</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Experience the future of customer support. Nexora's high-performance command center transforms tickets into solutions in real-time.
            </p>
            
            {!user ? (
              <div className="pt-8 flex flex-col items-center gap-8 w-full max-w-xl mx-auto materialize">
                <div className="text-sm font-bold uppercase tracking-[0.4em] text-primary/50 mb-4 px-4 py-2 bg-primary/10 rounded-full">Identify to Access Support</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <a
                    href={`${import.meta.env.VITE_API_URL || ""}/api/auth/google?redirect=http://localhost:3002/`}
                    className="glass-card-enhanced p-5 flex flex-col items-center justify-center gap-3 hover:scale-110 transition-all border border-white/5 hover:border-primary/30 group"
                  >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6 grayscale group-hover:grayscale-0 transition-all" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Google</span>
                  </a>
                  
                  <a
                    href={`${import.meta.env.VITE_API_URL || ""}/api/auth/microsoft?redirect=http://localhost:3002/`}
                    className="glass-card-enhanced p-5 flex flex-col items-center justify-center gap-3 hover:scale-110 transition-all border border-white/5 hover:border-blue-400/30 group"
                  >
                    <img src="https://www.microsoft.com/favicon.ico" alt="Microsoft" className="w-6 h-6 grayscale group-hover:grayscale-0 transition-all" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Microsoft</span>
                  </a>
                </div>
                
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.4em]">One-click secure access to your portal</p>

                {/* ── RECRUITER DEMO ── */}
                <div className="w-full mt-2 border-t border-white/5 pt-6">
                  <button
                    onClick={handleDemoLogin}
                    disabled={isDemoLoading}
                    className="w-full relative group overflow-hidden rounded-xl border border-secondary/40 bg-secondary/10 hover:bg-secondary/20 hover:border-secondary/60 transition-all duration-300 p-4 flex flex-col items-center gap-2 disabled:opacity-60"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-secondary/0 via-secondary/10 to-secondary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <div className="flex items-center gap-2">
                      {isDemoLoading ? (
                        <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4 text-secondary" />
                      )}
                      <span className="text-sm font-bold tracking-[0.15em] uppercase text-secondary">
                        {isDemoLoading ? "Activating Demo..." : "Try Interactive Demo"}
                      </span>
                    </div>
                    <span className="text-[9px] text-muted-foreground tracking-widest uppercase">Preloaded data enabled for demonstration</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-8 flex justify-center animate-bounce-slow">
                <a href="#submit" className="glass-card px-8 py-3 rounded-full flex items-center gap-3 text-sm font-bold uppercase tracking-[0.2em] hover:text-primary transition-colors">
                  Continue to your portal <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* MANUAL CUSTOMER AUTH PORTAL (NEW SECTION) */}
      {!user && (
        <section className="relative py-12 z-10">
          <div className="container mx-auto px-4 materialize">
            <div className="max-w-md mx-auto glass-card-enhanced p-8 border border-white/5 relative overflow-hidden">
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[100px] -mr-16 -mt-16" />
              
              <div className="flex gap-4 mb-8">
                <button 
                  onClick={() => setIsManualLogin(true)}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-[0.2em] transition-all border ${isManualLogin ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white/5 border-transparent text-muted-foreground'}`}
                >
                  Sign In
                </button>
                <button 
                  onClick={() => setIsManualLogin(false)}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-[0.2em] transition-all border ${!isManualLogin ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white/5 border-transparent text-muted-foreground'}`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleManualAuth} className="space-y-5 relative z-10">
                {!isManualLogin && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Full Name</label>
                    <Input 
                      placeholder="Jane Doe" 
                      value={manualData.name}
                      onChange={(e) => handleManualChange("name", e.target.value)}
                      className="bg-white/5 border-white/10 text-foreground h-12 focus:border-primary/50"
                      required={!isManualLogin}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Email ID</label>
                  <Input 
                    type="email"
                    placeholder="you@email.com" 
                    value={manualData.email}
                    onChange={(e) => handleManualChange("email", e.target.value)}
                    className="bg-white/5 border-white/10 text-foreground h-12 focus:border-primary/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Password</label>
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    value={manualData.password}
                    onChange={(e) => handleManualChange("password", e.target.value)}
                    className="bg-white/5 border-white/10 text-foreground h-12 focus:border-primary/50"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-4 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-[0.3em] rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.2)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isAuthLoading ? "Authenticating..." : (isManualLogin ? "Login Now" : "Register Account")}
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Features Showcase */}
      <section className="relative py-24 border-y border-white/5 bg-white/[0.01]">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-20">System Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <div
                key={i}
                className="glass-card-enhanced p-8 group cursor-pointer node-float"
                style={{ animationDelay: `${i * 0.2}s` }}
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div className="relative mb-6">
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    hoveredFeature === i
                      ? "bg-primary/30 shadow-[0_0_30px_rgba(0,229,255,0.4)]"
                      : "bg-primary/10"
                  }`}>
                    <feature.icon className="w-8 h-8 text-primary" />
                  </div>
                  {hoveredFeature === i && (
                    <div className="absolute inset-0 rounded-xl border-2 border-primary/50 animate-pulse" />
                  )}
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.label}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content - Ticket System (HIDDEN UNTIL LOGIN) */}
      {user && (
        <section id="submit" className="relative py-24 z-10">
          <div className="container mx-auto px-4 materialize">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
              {/* New Ticket Form */}
              {(activeTab === "new" || typeof window !== 'undefined' && window.innerWidth >= 1024) && (
                <div className="glass-card-enhanced p-10 node-float">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                      <Ticket className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">New Support Ticket</h2>
                      <p className="text-sm text-muted-foreground">High-performance resolution</p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-widest">Email</label>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) => handleFormChange("email", e.target.value)}
                        className="bg-white/5 border-white/10 text-foreground h-12 focus:border-primary/50 focus:ring-primary/20"
                        required
                        disabled
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-widest">Subject</label>
                      <Input
                        type="text"
                        placeholder="Brief summary"
                        value={formData.subject}
                        onChange={(e) => handleFormChange("subject", e.target.value)}
                        className="bg-white/5 border-white/10 text-foreground h-12 focus:border-primary/50"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-widest">Priority</label>
                      <Select value={formData.priority} onValueChange={(value) => handleFormChange("priority", value)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-foreground h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#020818] border-white/10">
                          <SelectItem value="Low">🟢 Low</SelectItem>
                          <SelectItem value="Medium">🟡 Medium</SelectItem>
                          <SelectItem value="High">🔴 High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-widest">Description</label>
                      <Textarea
                        placeholder="Describe your issue..."
                        value={formData.description}
                        onChange={(e) => handleFormChange("description", e.target.value)}
                        className="bg-white/5 border-white/10 text-foreground min-h-32 focus:border-primary/50 resize-none"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        "btn-primary w-full py-4 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.2)] disabled:opacity-50",
                        isDemo && currentStep === 'start' && "mission-pulse"
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                          SUBMITTING...
                        </>
                      ) : (
                        <>
                          <Ticket className="w-5 h-5" /> SUBMIT TICKET
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Track Ticket */}
              {(activeTab === "history" || typeof window !== 'undefined' && window.innerWidth >= 1024) && (
                <div className="glass-card-enhanced p-10 node-float" style={{ animationDelay: '1s' }}>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center border border-secondary/30">
                      <Search className="w-6 h-6 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold">Track Ticket</h2>
                      <p className="text-sm text-muted-foreground">Real-time status</p>
                    </div>
                    <button
                      onClick={handleResetTracker}
                      className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors group"
                      title="Reset Tracker"
                    >
                      <RefreshCw className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-widest">Email</label>
                      <div className="relative">
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          value={trackingEmail}
                          onChange={(e) => setTrackingEmail(e.target.value)}
                          className="bg-white/5 border-white/10 text-foreground h-12 pl-12 focus:border-primary/50"
                          disabled
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Select value={trackingStatus} onValueChange={setTrackingStatus}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-foreground h-12 text-xs">
                            <SelectValue placeholder="Filter Status" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#020818] border-white/10">
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Select value={trackingPriority} onValueChange={setTrackingPriority}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-foreground h-12 text-xs">
                            <SelectValue placeholder="Filter Priority" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#020818] border-white/10">
                            <SelectItem value="All">All Priorities</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <button
                      onClick={handleTrackTicket}
                      disabled={isSearching}
                      className="btn-secondary w-full py-4 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(181,55,242,0.2)] disabled:opacity-50"
                    >
                      {isSearching ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          SEARCHING...
                        </>
                      ) : (
                        <>
                          <Search className="w-5 h-5" /> TRACK TICKET
                        </>
                      )}
                    </button>

                    {/* Results */}
                    {ticketHistory.length > 0 && (
                      <div className="space-y-4 mt-6">
                        <p className="text-sm text-muted-foreground">
                          Found <span className="text-primary font-bold">{ticketHistory.length}</span> ticket(s) for <span className="text-primary">{customerName}</span>
                        </p>
                        {ticketHistory.map((ticket: any) => (
                          <div key={ticket.Ticket_ID} className="glass-card p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-primary">TKT-{String(ticket.Ticket_ID).padStart(3, '0')}</span>
                              <span className={getStatusColor(ticket.Status)}>{ticket.Status}</span>
                            </div>
                            <p className="text-sm text-foreground">{ticket.Subject}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className={getPriorityColor(ticket.Priority)}>● {ticket.Priority}</span>
                              <span>{ticket.Created_Date ? new Date(ticket.Created_Date).toLocaleDateString() : ""}</span>
                            </div>
                            <div className="flex gap-2 pt-2">
                              {ticket.Status === "Resolved" && !ticket.Rating && (
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map(r => (
                                    <button key={r} onClick={() => handleRate(ticket.Ticket_ID, r)}
                                      className="text-yellow-400 hover:scale-125 transition-transform">
                                      <Star className="w-4 h-4" />
                                    </button>
                                  ))}
                                </div>
                              )}
                              {ticket.Status !== "Resolved" && (
                                <button
                                  onClick={() => handleFollowUp(ticket.Ticket_ID)}
                                  className="text-xs text-primary hover:underline"
                                >
                                  Follow Up
                                </button>
                              )}
                              <Link href={`/conversation/${ticket.Ticket_ID}`}
                                className="text-xs text-secondary hover:underline ml-auto">
                                View Conversation →
                              </Link>
                            </div>
                            {ticket.Rating && (
                              <p className="text-xs text-yellow-400">Rating: {"⭐".repeat(ticket.Rating)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tab Navigation Mobile */}
            <div className="flex gap-4 mb-8 md:hidden mt-8">
              <button
                onClick={() => setActiveTab("new")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  activeTab === "new"
                    ? "glass-card-enhanced text-primary border-primary/30"
                    : "glass-card text-muted-foreground"
                }`}
              >
                <Ticket className="w-5 h-5 mx-auto mb-2" />
                New Ticket
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  activeTab === "history"
                    ? "glass-card-enhanced text-primary border-primary/30"
                    : "glass-card text-muted-foreground"
                }`}
              >
                <Search className="w-5 h-5 mx-auto mb-2" />
                Track Ticket
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 bg-[#020818] relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2 select-none">
              <span 
                onClick={triggerConfetti}
                className="text-lg font-bold tracking-tighter cursor-default hover:text-primary transition-colors"
              >NEXORA</span>
            </div>
            <p className="text-sm text-muted-foreground">&copy; 2026 Nexora. Built for the future.</p>
            <div className="flex gap-6">
              <Link href="/about" className="text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors">About</Link>
              <button onClick={logout} className="text-xs font-bold uppercase tracking-widest hover:text-red-400 transition-colors">Logout</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
