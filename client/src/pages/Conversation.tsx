import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Send, MessageSquare, User, Cpu } from "lucide-react";
import { ImmersiveBackground } from "@/components/ImmersiveBackground";
import { getConversation, postConversation, isAuthenticated } from "@/api";
import { toast } from "sonner";

export default function Conversation() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = parseInt(params.ticketId || "0");
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversation();
  }, [ticketId]);

  const fetchConversation = async () => {
    setLoading(true);
    try {
      const data = await getConversation(ticketId);
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
      await postConversation(ticketId, newMessage);
      setNewMessage("");
      fetchConversation();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
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

  const backLink = isAuthenticated() ? "/agent-dashboard" : "/";

  return (
    <div className="min-h-screen bg-[#020818] text-[#e0e0e0] flex flex-col relative">
      <ImmersiveBackground variant="dashboard" intensity="light" showOrb={false} />

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-[#020818]/80 backdrop-blur-2xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={backLink} className="flex items-center gap-2 group">
            <div className="p-1.5 rounded-lg border border-white/10 group-hover:border-primary/50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold text-primary neon-glow">
              Ticket #{ticketId}
            </span>
          </div>
          <div className="w-24"></div>
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
            messages.map((msg: any, idx: number) => (
              <div
                key={msg.Message_ID || idx}
                className={`flex gap-3 ${msg.Sender_Role === "Customer" ? "justify-start" : "justify-end"}`}
              >
                {msg.Sender_Role === "Customer" && (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    {getSenderIcon(msg.Sender_Role)}
                  </div>
                )}
                <div className={`max-w-lg p-4 rounded-2xl ${
                  msg.Sender_Role === "Customer"
                    ? "bg-white/5 border border-white/10"
                    : "bg-primary/10 border border-primary/20"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                      {msg.Sender_Role}
                    </span>
                    <span className="text-[10px] opacity-40">
                      {msg.Timestamp ? new Date(msg.Timestamp).toLocaleString() : ""}
                    </span>
                  </div>
                  <p className="text-sm">{msg.Message_Text}</p>
                </div>
                {msg.Sender_Role !== "Customer" && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    {getSenderIcon(msg.Sender_Role)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t border-white/5 bg-[#020818]/80 backdrop-blur-2xl relative z-10">
        <div className="container mx-auto px-4 py-4 max-w-3xl">
          <div className="flex gap-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
            />
            <button
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              className="px-6 rounded-xl bg-primary text-primary-foreground font-bold transition-all hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
