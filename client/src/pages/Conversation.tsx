import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, Send, MessageSquare, User, Cpu, CheckCircle } from "lucide-react";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";
import { getConversation, postConversation, aiSuggest, resolveTicket } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoMission } from "@/hooks/useDemoMission";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Conversation() {
  const { authenticated, user } = useAuth();
  const { checklist, isDemo } = useDemoMission();
  const params = useParams<{ ticketId: string }>();
  const ticketId = parseInt(params.ticketId || "0");
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchConversation();
    const interval = setInterval(() => {
      fetchConversation(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [ticketId]);

  const fetchConversation = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const email = !authenticated ? sessionStorage.getItem("trackingEmail") || "" : undefined;
      const data = await getConversation(ticketId, email);
      setTicket(data.ticket);
      setMessages(data.messages || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const email = !authenticated ? sessionStorage.getItem("trackingEmail") || "" : undefined;
      await postConversation(ticketId, newMessage, email);
      setNewMessage("");
      fetchConversation(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const res = await aiSuggest();
      setNewMessage((prev) => (prev ? prev + "\n" + res.suggestion : res.suggestion));
    } catch (err: any) {
      toast.error(err.message || "AI failed to respond");
    } finally {
      setAiLoading(false);
    }
  };

  const handleResolve = async () => {
    try {
      await resolveTicket(ticketId);
      toast.success("Ticket resolved successfully!");
      fetchConversation();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getSenderIcon = (role: string) => {
    if (role === "Customer") return <User className="w-4 h-4" />;
    return <Cpu className="w-4 h-4 text-primary" />;
  };

  const [, setLocation] = useLocation();
  const backLink = authenticated ? "/agent-dashboard" : "/portal";
  
  const handleBack = () => {
    if (window.history.length > 2) {
      window.history.back();
    } else {
      setLocation(backLink);
    }
  };

  return (
    <div className="min-h-screen bg-[#020818] text-[#e0e0e0] flex flex-col relative">
      <ImmersiveBackground variant="dashboard" intensity="light" showOrb={false} />

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-[#020818]/80 backdrop-blur-2xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={handleBack} className="flex items-center gap-2 group">
            <div className="p-1.5 rounded-lg border border-white/10 group-hover:border-primary/50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">Back</span>
          </button>
          <div className="flex items-center gap-3">
            {authenticated && user?.Role !== "Customer" && ticket?.Status !== "Resolved" && (
              <button 
                onClick={handleResolve}
                className={cn(
                  "hidden sm:flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-black rounded-lg hover:bg-green-500/20 transition-all active:scale-95",
                  isDemo && checklist.ticket_replied && !checklist.ticket_resolved && "mission-pulse"
                )}
              >
                <CheckCircle className="w-4 h-4" />
                RESOLVE TICKET
              </button>
            )}
            <div className="w-6 sm:w-24"></div>
          </div>
        </div>
      </header>

      {/* Ticket Info */}
      {ticket && (
        <div className="container mx-auto px-4 py-4 relative z-10">
          <div className="glass-card-enhanced p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold">{ticket.Subject}</h2>
                <p className="text-sm text-muted-foreground mt-1">{ticket.Description}</p>
              </div>
              <div className="flex gap-3">
                <span className={`status-badge ${ticket.Status === "Open" ? "status-open" : ticket.Status === "Resolved" ? "status-resolved" : "status-pending"}`}>
                  {ticket.Status}
                </span>
                <span className={`status-badge ${ticket.Priority === "High" ? "priority-high" : ticket.Priority === "Medium" ? "priority-medium" : "priority-low"}`}>
                  {ticket.Priority}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 container mx-auto px-4 py-4 relative z-10 overflow-y-auto">
        <div className="space-y-4 max-w-3xl mx-auto">
          {loading ? (
            <div className="text-center text-muted-foreground py-12">Loading conversation...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg: any, idx: number) => {
              const isMe = authenticated ? msg.Sender_Role !== "Customer" : msg.Sender_Role === "Customer";
              
              return (
                <div
                  key={msg.Message_ID || idx}
                  className={`flex gap-3 ${isMe ? "justify-end" : "justify-start"}`}
                >
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                      {getSenderIcon(msg.Sender_Role)}
                    </div>
                  )}
                  <div className={`max-w-lg p-4 rounded-2xl ${
                    isMe
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-white/5 border border-white/10"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                        {msg.Sender_Role}
                      </span>
                      <span className="text-[10px] opacity-40">
                        {msg.Timestamp ? new Date(msg.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                      </span>
                    </div>
                    <p className="text-sm">{msg.Message_Text}</p>
                  </div>
                  {isMe && (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      {getSenderIcon(msg.Sender_Role)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Message Input - Lockdown if Resolved */}
      <div className="border-t border-white/5 bg-[#020818]/80 backdrop-blur-2xl relative z-10">
        <div className="container mx-auto px-4 py-4 max-w-3xl">
          {ticket?.Status === "Resolved" ? (
            <div className="flex items-center justify-center p-10 border border-white/10 rounded-2xl bg-white/5 materialize shadow-inner shadow-black/40">
              <div className="flex flex-col items-center gap-3">
                 <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_15px_rgba(248,113,113,0.5)]" />
                 <p className="font-bold text-muted-foreground uppercase tracking-widest text-[10px] sm:text-xs">Ticket has been closed - can't send message</p>
                 <p className="text-[9px] text-muted-foreground opacity-40 uppercase tracking-tighter">Read-only mode active</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 materialize">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                className={cn(
                  "flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none shadow-inner",
                  isDemo && !checklist.ticket_replied && "mission-pulse"
                )}
              />

              <button
                onClick={handleSend}
                disabled={sending || !newMessage.trim()}
                className={cn(
                  "px-6 rounded-xl bg-primary text-primary-foreground font-bold transition-all hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] disabled:opacity-50 flex items-center gap-2 active:scale-95",
                  isDemo && !checklist.ticket_replied && "mission-pulse"
                )}
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">SEND</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
