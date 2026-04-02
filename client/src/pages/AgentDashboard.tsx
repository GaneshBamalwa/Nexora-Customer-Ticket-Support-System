import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Ticket, MessageSquare, LogOut, Menu, X, Clock,
  AlertCircle, CheckCircle, Search, ChevronRight, LayoutDashboard,
  Filter, Star, KeyRound, Database
} from "lucide-react";
import { getDashboard, resolveTicket, assignTicket, logout, isAuthenticated, getCurrentUser, requestPasswordChange } from "@/api";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";

type Section = "dashboard" | "my-tickets" | "active-tickets";

export default function AgentDashboard() {
  const { user, authenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [hideResolved, setHideResolved] = useState(false);
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0 });
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pwRequestLoading, setPwRequestLoading] = useState(false);

  useEffect(() => {
    // ProtectedRoute handles the main auth and role check.
    // We just fetch data here.
    if (authenticated) {
      fetchDashboard();
      const interval = setInterval(() => {
        fetchDashboard(true);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [authenticated]);

  const fetchDashboard = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getDashboard();
      setTickets(data.tickets || []);
      setStats(data.stats || { total: 0, open: 0, resolved: 0 });
      setAgents(data.agents || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (ticketId: number) => {
    try {
      await resolveTicket(ticketId);
      toast.success("Ticket resolved!");
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRequestPasswordChange = async () => {
    setPwRequestLoading(true);
    try {
      await requestPasswordChange();
      toast.success("Password change request submitted. Await admin approval.");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setPwRequestLoading(false);
    }
  };

  const currentAgentId = user?.agent_id || user?.Agent_ID;
  const isAdmin = user?.Role === "Administrator" || user?.role === "Administrator";

  const getFilteredData = () => {
    let base = [...tickets];
    
    if (activeSection === "my-tickets") {
      if (!isAdmin) {
        base = base.filter(t => t.Agent_ID === currentAgentId);
      }
      if (hideResolved) {
        base = base.filter(t => t.Status !== "Resolved");
      }
    } else if (activeSection === "active-tickets") {
      if (isAdmin) {
        base = base.filter(t => t.Status !== "Resolved");
      } else {
        base = base.filter(t => (t.Agent_ID === currentAgentId || !t.Agent_ID) && t.Status !== "Resolved");
      }
    }

    if (filterStatus !== "All") {
      base = base.filter(t => t.Status === filterStatus);
    }
    if (filterPriority !== "All") {
      base = base.filter(t => t.Priority === filterPriority);
    }

    return base.filter((ticket) => {
      const matchesSearch =
        String(ticket.Ticket_ID).includes(searchQuery) ||
        (ticket.Subject || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  };

  const displayTickets = getFilteredData();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open": return <span className="status-badge status-open">Open</span>;
      case "Pending": return <span className="status-badge status-pending">Pending</span>;
      case "Resolved": return <span className="status-badge status-resolved">Resolved</span>;
      default: return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "High": return <span className="status-badge priority-high">🔴 High</span>;
      case "Medium": return <span className="status-badge priority-medium">🟡 Medium</span>;
      case "Low": return <span className="status-badge priority-low">🟢 Low</span>;
      default: return null;
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "my-tickets", label: (user?.role === "Administrator" || user?.Role === "Administrator") ? "Global History" : "My History", icon: Ticket },
    { id: "active-tickets", label: "Active Tickets", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-background grid-bg-animated overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/20 bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-card/50 rounded-lg transition-colors md:hidden">
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <span className="text-xl font-black text-primary neon-glow tracking-tighter uppercase">Nexora Agent</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center font-bold text-primary text-xs">
                {user?.Name?.[0] || "A"}
              </div>
              <span className="text-sm font-bold text-foreground">{user?.Name || "Agent"}</span>
            </div>
            <button onClick={logout} className="flex items-center gap-2 p-2 px-4 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-all">
              <span className="text-[10px] font-black text-red-400">TERMINATE SESSION</span>
              <LogOut className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} border-r border-border/20 bg-card/10 backdrop-blur-md h-[calc(100vh-73px)] sticky top-[73px] transition-all duration-300 hidden md:block z-30`}>
          <nav className="p-4 space-y-1">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as Section)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeSection === item.id 
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="font-bold text-xs uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-border/20">
            {(user?.Role === "Administrator" || user?.role === "Administrator") && (
              <Link href="/admin-dashboard">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent transition-all mb-2">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="font-bold text-xs uppercase tracking-widest">Admin Portal</span>
                </button>
              </Link>
            )}
            <button
              onClick={handleRequestPasswordChange}
              disabled={pwRequestLoading}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all disabled:opacity-50"
            >
                {pwRequestLoading
                  ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  : <KeyRound className="w-4 h-4" />}
                <span className="font-bold text-xs uppercase tracking-widest">Change Password</span>
              </button>
            </div>
            
            <div className="p-4 border-t border-white/10 mt-auto">
              <Link href="/sql-console">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-white hover:bg-[#00e5ff]/10 border border-white/5 hover:border-[#00e5ff]/30 transition-all bg-black/20 shadow-lg">
                  <Database className="w-4 h-4 text-[#00e5ff]" />
                  <span className="font-bold text-[11px] uppercase tracking-widest leading-none text-[#00e5ff]">SQL Console</span>
                </button>
              </Link>
            </div>
          </aside>
  
          {/* Main Content */}
        <main className="flex-1 p-6 md:p-10">
          {activeSection === "dashboard" ? (
             <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: "Active Tickets", value: stats.open, icon: AlertCircle, color: "text-primary" },
                    { label: "Total Recieved", value: stats.total, icon: Clock, color: "text-secondary" },
                    { label: "Resolved Work", value: stats.resolved, icon: CheckCircle, color: "text-green-400" },
                  ].map((stat, idx) => (
                    <div key={idx} className="glass-card p-6 border-white/5 materialize">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                        <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <p className="text-3xl font-black">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="glass-card border-white/5 overflow-hidden materialize">
                  <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest">Active Operations</h3>
                    <button onClick={() => setActiveSection("active-tickets")} className="text-[10px] font-bold text-primary group flex items-center gap-1">
                      EXPAND MATRIX <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/5">
                    {tickets.filter(t => (isAdmin ? true : (t.Agent_ID === currentAgentId || !t.Agent_ID)) && t.Status !== "Resolved").slice(0, 5).map(t => (
                      <div key={t.Ticket_ID} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                           <div className="text-xs font-mono font-bold text-primary">#{t.Ticket_ID}</div>
                           <p className="text-sm font-bold truncate max-w-[200px]">{t.Subject}</p>
                        </div>
                        <Link href={`/conversation/${t.Ticket_ID}`}>
                           <button className="p-2 bg-primary/10 border border-primary/20 rounded hover:bg-primary/20"><ChevronRight className="w-3 h-3 text-primary" /></button>
                        </Link>
                      </div>
                    ))}
                    {tickets.filter(t => (isAdmin ? true : (t.Agent_ID === currentAgentId || !t.Agent_ID)) && t.Status !== "Resolved").length === 0 && (
                      <div className="p-10 text-center text-xs text-muted-foreground italic">Grid registry clear. No pending units.</div>
                    )}
                  </div>
                </div>
             </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="flex-1 max-w-2xl flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search registry subject..."
                      value={searchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[130px] bg-white/5 border-white/10 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#020818] border-white/10">
                      <SelectItem value="All">All Status</SelectItem>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="w-[130px] bg-white/5 border-white/10 text-xs">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#020818] border-white/10">
                      <SelectItem value="All">All Priority</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {activeSection === "my-tickets" && (
                  <button
                    onClick={() => setHideResolved(!hideResolved)}
                    className={`flex items-center gap-2 px-4 h-10 rounded border text-[10px] font-bold transition-all ${hideResolved ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-muted-foreground'}`}
                  >
                    <Filter className="w-3 h-3" />
                    HIDE RESOLVED
                  </button>
                )}
              </div>

              <div className="glass-card-enhanced border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-500 relative z-0">
                <div className="">
                  <table className="w-full relative">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5">
                        <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Identifier</th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Subject</th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">State</th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Urgency</th>
                        <th className="px-6 py-4 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Mission Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {displayTickets.map((ticket) => (
                        <tr key={ticket.Ticket_ID} className="hover:bg-primary/5 transition-all group/row">
                          <td className="px-6 py-5">
                            <span className="text-xs font-mono font-bold text-primary">#{String(ticket.Ticket_ID).padStart(4, '0')}</span>
                          </td>
                          <td className="px-6 py-5">
                            <p className="text-sm font-bold text-foreground group-hover/row:text-primary transition-colors">{ticket.Subject}</p>
                            <p className="text-[10px] text-muted-foreground opacity-60">LOG: {new Date(ticket.Created_Date).toLocaleDateString()}</p>
                          </td>
                          <td className="px-6 py-5">{getStatusBadge(ticket.Status)}</td>
                          <td className="px-6 py-5">{getPriorityBadge(ticket.Priority)}</td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-2 relative">
                               <Link href={`/conversation/${ticket.Ticket_ID}`}>
                                  <button className="px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black hover:bg-primary/20 transition-all">
                                    OPEN CHAT
                                  </button>
                               </Link>

                               {(!isAdmin && ticket.Status !== "Resolved") && (
                                 <>
                                   <div className="relative group/pass">
                                      <button className="px-3 py-1.5 bg-secondary/10 border border-secondary/30 text-secondary text-[10px] font-black hover:bg-secondary/20 transition-all">
                                        PASS
                                      </button>
                                      {/* Dropdown - positioned below and atop everything with pointer events fix */}
                                      <div className="absolute right-0 top-full mt-1 w-48 invisible group-hover/pass:visible opacity-0 group-hover/pass:opacity-100 transition-all z-[999] materialize">
                                         <div className="bg-card border border-border/40 rounded-md shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-1 overflow-hidden ring-1 ring-white/10">
                                            <p className="p-2 text-[9px] font-bold text-muted-foreground border-b border-white/5 uppercase">Agent Registry</p>
                                            <div className="max-h-40 overflow-y-auto custom-scrollbar">
                                              {agents.filter(a => a.Agent_ID !== currentAgentId).map(agent => (
                                                <button
                                                  key={agent.Agent_ID}
                                                  onClick={() => {
                                                    assignTicket(ticket.Ticket_ID, agent.Agent_ID)
                                                      .then(() => { toast.success(`Transferred to ${agent.Name}`); fetchDashboard(); })
                                                      .catch(e => toast.error(e.message));
                                                  }}
                                                  className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-primary/20 hover:text-primary rounded transition-colors"
                                                >
                                                  {agent.Name}
                                                </button>
                                              ))}
                                            </div>
                                         </div>
                                      </div>
                                   </div>
                                   
                                   <button 
                                      onClick={() => handleResolve(ticket.Ticket_ID)}
                                      className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black hover:bg-green-500/20 transition-all"
                                   >
                                      RESOLVE
                                   </button>
                                 </>
                               )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {displayTickets.length === 0 && (
                  <div className="p-20 text-center italic text-xs text-muted-foreground">Registry scan successful. No units found for this query.</div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
