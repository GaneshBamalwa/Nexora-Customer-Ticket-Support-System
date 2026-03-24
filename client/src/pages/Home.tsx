import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, MessageSquare, Search, ArrowRight, Menu, X, Cpu, Zap, Shield, Star } from "lucide-react";
import { Link } from "wouter";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";
import { raiseTicket, searchHistory, rateTicket, followUp } from "@/api";
import { toast } from "sonner";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [scrollY, setScrollY] = useState(0);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    subject: "",
    priority: "Medium",
    description: "",
  });
  const [trackingEmail, setTrackingEmail] = useState("");
  const [ticketHistory, setTicketHistory] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState("");

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
      const data = await searchHistory({ email: trackingEmail });
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

  const features = [
    { icon: Cpu, label: "AI Core", desc: "Intelligent automation" },
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

  return (
    <div className="min-h-screen bg-[#020818] text-[#e0e0e0] overflow-x-hidden font-inter selection:bg-primary/30 relative">
      <ImmersiveBackground variant="landing" intensity="heavy" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#020818]/80 backdrop-blur-2xl">
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
            <Link href="/staff-login" className="btn-primary">Staff Login</Link>
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
              <Link href="/staff-login" className="btn-primary w-full text-center">Staff Login</Link>
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
              Experience the future of customer support. Nexora's AI-powered command center transforms tickets into solutions in real-time.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Link href="#submit" className="btn-primary flex items-center gap-2">
                <Ticket className="w-4 h-4" /> Submit Ticket
              </Link>
              <Link href="/about" className="px-6 py-3 rounded-lg border border-primary/30 hover:bg-primary/10 transition-all font-semibold">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section className="relative py-32 border-y border-white/5 bg-white/[0.01]">
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

      {/* Main Content - Ticket System */}
      <section id="submit" className="relative py-24 z-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* New Ticket Form */}
            {(activeTab === "new" || typeof window !== 'undefined' && window.innerWidth >= 1024) && (
              <div className="glass-card-enhanced p-10 materialize node-float">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Ticket className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">New Support Ticket</h2>
                    <p className="text-sm text-muted-foreground">AI-assisted resolution</p>
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
                    className="btn-primary w-full py-4 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.2)] disabled:opacity-50"
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
              <div className="glass-card-enhanced p-10 materialize node-float" style={{ animationDelay: '1s' }}>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center border border-secondary/30">
                    <Search className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Track Ticket</h2>
                    <p className="text-sm text-muted-foreground">Real-time status</p>
                  </div>
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
                      />
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
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

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 bg-[#020818] relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tighter">NEXORA</span>
            </div>
            <p className="text-sm text-muted-foreground">&copy; 2026 Nexora. Built for the future.</p>
            <div className="flex gap-6">
              <Link href="/about" className="text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors">About</Link>
              <Link href="/staff-login" className="text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors">Staff</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
