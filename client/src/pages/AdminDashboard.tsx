import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Ticket, Users, BarChart3, LogOut, Menu, X, TrendingUp,
  AlertCircle, CheckCircle, Clock, Star, Plus,
} from "lucide-react";
import {
  getAdminReport, addAgent, assignTicket, handlePwRequest,
  getDashboard, logout, isAuthenticated, getCurrentUser,
} from "@/api";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  // Data
  const [reportStats, setReportStats] = useState<any>({ total: 0, resolved: 0, pending: 0, avg_rating: 0 });
  const [performance, setPerformance] = useState<any[]>([]);
  const [priorityData, setPriorityData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [pwRequests, setPwRequests] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [agentsList, setAgentsList] = useState<any[]>([]);

  // Add agent form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", email: "", role: "Agent" });

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/staff-login");
      return;
    }
    const user = getCurrentUser();
    if (user && user.Role !== "Administrator" && user.role !== "Administrator") {
      setLocation("/agent-dashboard");
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [report, dashboard] = await Promise.all([
        getAdminReport(),
        getDashboard(),
      ]);
      setReportStats(report.stats || {});
      setPerformance(report.performance || []);
      setPriorityData(report.priority_data || []);
      setDailyData(report.daily_data || []);
      setPwRequests(report.pw_requests || []);
      setTickets(dashboard.tickets || []);
      setAgentsList(dashboard.agents || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgent = async () => {
    try {
      await addAgent(newAgent);
      toast.success(`Added ${newAgent.name}`);
      setNewAgent({ name: "", email: "", role: "Agent" });
      setShowAddForm(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAssign = async (ticketId: number, agentId: number | null) => {
    try {
      await assignTicket(ticketId, agentId);
      toast.success("Ticket assigned!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePwAction = async (reqId: number, action: "approve" | "deny") => {
    try {
      await handlePwRequest(reqId, action);
      toast.success(`Request ${action}d`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const totalTickets = reportStats.total || 0;
  const resolvedPct = totalTickets > 0 ? Math.round(((reportStats.resolved || 0) / totalTickets) * 100) : 0;

  const stats = [
    { label: "Total Tickets", value: totalTickets, icon: Ticket, color: "text-primary", trend: "" },
    { label: "Resolved %", value: `${resolvedPct}%`, icon: CheckCircle, color: "text-green-400", trend: "" },
    { label: "Open/Pending", value: reportStats.pending || 0, icon: AlertCircle, color: "text-secondary", trend: "" },
    { label: "Avg Satisfaction", value: reportStats.avg_rating ? `${reportStats.avg_rating}⭐` : "N/A", icon: Star, color: "text-yellow-400", trend: "" },
  ];

  const maxDaily = Math.max(...(dailyData.map((d: any) => d.count || 0)), 1);

  return (
    <div className="min-h-screen bg-background grid-bg-animated">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/20 bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-card/50 rounded-lg transition-colors md:hidden">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2 flex-1 md:flex-none">
            <span className="text-lg font-bold text-primary neon-glow">ADMIN DASHBOARD</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-secondary">AD</span>
              </div>
              <span className="text-foreground">Administrator</span>
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
                <p className="text-sm font-semibold text-primary">Overview</p>
              </div>
              <a href="#" className="flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card/50 transition-colors">
                <BarChart3 className="w-5 h-5" /><span>Analytics</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card/50 transition-colors">
                <Users className="w-5 h-5" /><span>Team Management</span>
              </a>
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="glass-card p-6 hover:scale-105 transition-transform">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="glass-card p-2 mb-6 inline-flex gap-2 bg-card/50 border border-border/30">
              <TabsTrigger value="overview" className="px-4 py-2 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-colors">Overview</TabsTrigger>
              <TabsTrigger value="agents" className="px-4 py-2 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-colors">Team Performance</TabsTrigger>
              <TabsTrigger value="requests" className="px-4 py-2 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-colors">Approvals</TabsTrigger>
              <TabsTrigger value="assign" className="px-4 py-2 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-colors">Assign Tickets</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-6">Ticket Priority Distribution</h3>
                  <div className="space-y-4">
                    {priorityData.map((item: any, idx: number) => {
                      const pct = totalTickets > 0 ? Math.round(((item.count || 0) / totalTickets) * 100) : 0;
                      return (
                        <div key={idx}>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm text-foreground">{item.Priority} Priority</span>
                            <span className="text-sm font-semibold text-primary">{item.count}</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-card/50 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                    {priorityData.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-6">Tickets Last 7 Days</h3>
                  <div className="flex items-end gap-2 h-40">
                    {dailyData.length > 0 ? dailyData.map((item: any, idx: number) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                        <div
                          className="w-full bg-gradient-to-t from-primary to-secondary rounded-t-lg transition-all hover:opacity-80"
                          style={{ height: `${((item.count || 0) / maxDaily) * 100}%` }}
                        ></div>
                        <span className="text-xs text-muted-foreground">{item.day?.slice(5)}</span>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground w-full text-center">No data yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Team Performance Tab */}
            <TabsContent value="agents" className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Agent Performance</h3>
                <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Team Member
                </button>
              </div>

              {showAddForm && (
                <div className="glass-card p-6 mb-4 space-y-4">
                  <Input placeholder="Name" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} className="bg-input/50 border-border/30" />
                  <Input placeholder="Email" type="email" value={newAgent.email} onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })} className="bg-input/50 border-border/30" />
                  <Select value={newAgent.role} onValueChange={(v) => setNewAgent({ ...newAgent, role: v })}>
                    <SelectTrigger className="bg-input/50 border-border/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Agent">Agent</SelectItem>
                      <SelectItem value="Administrator">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={handleAddAgent} className="btn-primary">Add Agent</button>
                </div>
              )}

              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/20 bg-card/50">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">AGENT</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">ASSIGNED</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">RESOLVED</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">AVG RATING</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.map((agent: any, idx: number) => (
                        <tr key={idx} className="border-b border-border/20 hover:bg-card/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-semibold text-foreground">{agent.Name}</td>
                          <td className="px-6 py-4 text-sm text-foreground">{agent.assigned}</td>
                          <td className="px-6 py-4 text-sm text-foreground">{agent.solved}</td>
                          <td className="px-6 py-4 text-sm text-foreground">{agent.avg_rating || "N/A"}⭐</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {performance.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">No agent data yet.</div>
                )}
              </div>
            </TabsContent>

            {/* Approvals Tab */}
            <TabsContent value="requests" className="space-y-6">
              <h3 className="text-lg font-semibold">Pending Approvals</h3>
              {pwRequests.length > 0 ? (
                <div className="space-y-4">
                  {pwRequests.map((req: any) => (
                    <div key={req.Request_ID} className="glass-card p-6 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{req.Name}</p>
                        <p className="text-sm text-muted-foreground">{req.Email_ID}</p>
                        <p className="text-xs text-muted-foreground mt-1">Password Change Request</p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => handlePwAction(req.Request_ID, "approve")} className="btn-primary px-6">Approve</button>
                        <button onClick={() => handlePwAction(req.Request_ID, "deny")} className="btn-secondary px-6">Deny</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No pending approvals.</p>
                </div>
              )}
            </TabsContent>

            {/* Assign Tickets Tab */}
            <TabsContent value="assign" className="space-y-6">
              <h3 className="text-lg font-semibold">Assign Tickets to Agents</h3>
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/20 bg-card/50">
                        <th className="px-6 py-4 text-left text-sm font-semibold">TICKET</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">SUBJECT</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">STATUS</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold">ASSIGN TO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.filter(t => t.Status !== "Resolved").map((ticket: any) => (
                        <tr key={ticket.Ticket_ID} className="border-b border-border/20 hover:bg-card/50">
                          <td className="px-6 py-4 text-sm font-semibold text-primary">TKT-{String(ticket.Ticket_ID).padStart(3, '0')}</td>
                          <td className="px-6 py-4 text-sm max-w-xs truncate">{ticket.Subject}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className="status-badge status-open">{ticket.Status}</span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <Select
                              value={ticket.Agent_ID ? String(ticket.Agent_ID) : "unassigned"}
                              onValueChange={(v) => handleAssign(ticket.Ticket_ID, v === "unassigned" ? null : parseInt(v))}
                            >
                              <SelectTrigger className="bg-input/50 border-border/30 w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {agentsList.map((a: any) => (
                                  <SelectItem key={a.Agent_ID} value={String(a.Agent_ID)}>{a.Name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {tickets.filter(t => t.Status !== "Resolved").length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">No open tickets to assign.</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
