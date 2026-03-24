import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Ticket, MessageSquare, LogOut, Menu, X, Clock,
  AlertCircle, CheckCircle, Search, ChevronRight,
} from "lucide-react";
import { getDashboard, resolveTicket, logout, isAuthenticated, getCurrentUser } from "@/api";
import { toast } from "sonner";

export default function AgentDashboard() {
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0 });
  const [agents, setAgents] = useState<any[]>([]);
  const [userName, setUserName] = useState("Agent");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/staff-login");
      return;
    }
    const user = getCurrentUser();
    if (user) setUserName(user.Name || user.name || "Agent");
    fetchDashboard();
  }, []);

  const fetchDashboard = async (statusFilter?: string, priorityFilter?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      if (priorityFilter && priorityFilter !== "all") params.priority = priorityFilter;
      const data = await getDashboard(params);
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
      fetchDashboard(filterStatus, filterPriority);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleFilterChange = (type: "status" | "priority", value: string) => {
    if (type === "status") {
      setFilterStatus(value);
      fetchDashboard(value, filterPriority);
    } else {
      setFilterPriority(value);
      fetchDashboard(filterStatus, value);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      String(ticket.Ticket_ID).includes(searchQuery) ||
      (ticket.Subject || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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

  const getSLAStatus = (ticket: any) => {
    if (!ticket.Due_Date || ticket.Status === "Resolved") return null;
    const due = new Date(ticket.Due_Date);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.floor((due.getTime() - now.getTime()) / 3600000));

    if (hoursLeft <= 4) {
      return (
        <div className="flex items-center gap-2 text-destructive pulse-alert">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs font-semibold">{hoursLeft}h left</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span className="text-xs">{hoursLeft}h left</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background grid-bg-animated">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/20 bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-card/50 rounded-lg transition-colors md:hidden"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <div className="flex items-center gap-2 flex-1 md:flex-none">
            <span className="text-lg font-bold text-primary neon-glow">AGENT DASHBOARD</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">
                  {userName.split(" ").map(n => n[0]).join("").toUpperCase()}
                </span>
              </div>
              <span className="text-foreground">{userName}</span>
            </div>
            <button onClick={logout} className="p-2 hover:bg-card/50 rounded-lg transition-colors">
              <LogOut className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 border-r border-border/20 bg-card/30 backdrop-blur-md p-6 hidden md:block">
            <nav className="space-y-2">
              <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-sm font-semibold text-primary">Dashboard</p>
              </div>
              <a href="#" className="flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card/50 transition-colors">
                <MessageSquare className="w-5 h-5" />
                <span>Conversations</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card/50 transition-colors">
                <Ticket className="w-5 h-5" />
                <span>My Tickets</span>
              </a>
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Open Tickets", value: stats.open, icon: AlertCircle, color: "text-primary" },
              { label: "Total Tickets", value: stats.total, icon: Clock, color: "text-secondary" },
              { label: "Resolved", value: stats.resolved, icon: CheckCircle, color: "text-green-400" },
            ].map((stat, idx) => (
              <div key={idx} className="glass-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <stat.icon className={`w-8 h-8 ${stat.color}`} />
                </div>
              </div>
            ))}
          </div>

          {/* Filters and Search */}
          <div className="glass-card p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-foreground mb-2">SEARCH</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by ticket ID or subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-input/50 border-border/30 text-foreground"
                  />
                </div>
              </div>

              <div className="w-full md:w-40">
                <label className="block text-sm font-semibold text-foreground mb-2">STATUS</label>
                <Select value={filterStatus} onValueChange={(v) => handleFilterChange("status", v)}>
                  <SelectTrigger className="bg-input/50 border-border/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-40">
                <label className="block text-sm font-semibold text-foreground mb-2">PRIORITY</label>
                <Select value={filterPriority} onValueChange={(v) => handleFilterChange("priority", v)}>
                  <SelectTrigger className="bg-input/50 border-border/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="High">🔴 High</SelectItem>
                    <SelectItem value="Medium">🟡 Medium</SelectItem>
                    <SelectItem value="Low">🟢 Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tickets Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20 bg-card/50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">TICKET ID</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">SUBJECT</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">STATUS</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">PRIORITY</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">SLA</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.Ticket_ID} className="border-b border-border/20 hover:bg-card/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-primary">TKT-{String(ticket.Ticket_ID).padStart(3, '0')}</td>
                      <td className="px-6 py-4 text-sm text-foreground max-w-xs truncate">{ticket.Subject}</td>
                      <td className="px-6 py-4 text-sm">{getStatusBadge(ticket.Status)}</td>
                      <td className="px-6 py-4 text-sm">{getPriorityBadge(ticket.Priority)}</td>
                      <td className="px-6 py-4 text-sm">{getSLAStatus(ticket)}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          {ticket.Status !== "Resolved" && (
                            <button
                              onClick={() => handleResolve(ticket.Ticket_ID)}
                              className="px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                          <Link href={`/conversation/${ticket.Ticket_ID}`}>
                            <button className="p-2 hover:bg-primary/20 rounded-lg transition-colors">
                              <ChevronRight className="w-4 h-4 text-primary" />
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTickets.length === 0 && (
              <div className="p-12 text-center">
                <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  {loading ? "Loading tickets..." : "No tickets found matching your filters."}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
