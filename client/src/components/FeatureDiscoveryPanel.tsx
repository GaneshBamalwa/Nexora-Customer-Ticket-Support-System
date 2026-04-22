import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDemoMission } from "../hooks/useDemoMission";
import { CheckCircle2, Circle, Rocket, X, Trophy, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const FeatureDiscoveryPanel = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  
  // We rely fully on useDemoMission for the demo state
  const { checklist, isDemo, progress, isCompleted, resetMission } = useDemoMission();

  if (!user || !isDemo) return null;

  const getMissionTip = () => {
    if (!checklist.ticket_opened) return "💡 Open the pre-made ticket from the dashboard.";
    if (!checklist.ticket_replied) return "💬 Type a reply to the customer in the conversation.";
    if (!checklist.ticket_resolved) return "✅ Mark the ticket as resolved once the customer is happy.";
    if (!checklist.analytics_visited) return "📊 Check out the Operational Intel (Analytics) panel.";
    if (!checklist.admin_visited) return "⚙️ Visit the Admin Panel to see the read-only overview.";
    return "🎊 Mission Complete! You are a Nexora Demo Master.";
  }

  const allTasks = [
    { key: "ticket_opened", label: "Ticket opened", phase: "Step 1: Interact" },
    { key: "ticket_replied", label: "Ticket replied", phase: "Step 1: Interact" },
    { key: "ticket_resolved", label: "Ticket resolved", phase: "Step 1: Interact" },
    { key: "dashboard_visited", label: "Dashboard overview", phase: "Step 2: Explore" },
    { key: "assign_visited", label: "Assign tickets", phase: "Step 2: Explore" },
    { key: "analytics_visited", label: "View operation intel", phase: "Step 2: Explore" },
    { key: "admin_visited", label: "View team management", phase: "Step 2: Explore" },
    { key: "sql_visited", label: "View sql console", phase: "Step 2: Explore" },
  ];

  const totalTasks = allTasks.length;
  const completedCount = Object.values(checklist).filter(Boolean).length;
  const currentTask = allTasks.find(task => !(checklist as any)[task.key]);

  const renderTask = (task: { key: string; label: string }) => {
    const done = (checklist as any)[task.key];
    return (
      <div key={task.key} className="flex items-center gap-3 group">
        <div className={`transition-colors duration-300 ${done ? 'text-green-500' : 'text-muted-foreground group-hover:text-primary'}`}>
          {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
        </div>
        <span className={`text-[11px] transition-all duration-300 ${done ? 'text-muted-foreground line-through opacity-50 font-normal' : 'font-bold underline underline-offset-4 decoration-primary/30'}`}>
          {task.label}
        </span>
      </div>
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] materialize">
      <div className={`glass-card-enhanced overflow-hidden transition-all duration-500 shadow-2xl ${isOpen ? 'w-80' : 'w-14 h-14 rounded-full flex items-center justify-center p-0 overflow-hidden'}`}>
        {!isOpen ? (
          <button 
            onClick={() => setIsOpen(true)}
            className="w-full h-full flex items-center justify-center text-primary hover:scale-110 transition-transform"
          >
            <Trophy className="w-6 h-6 animate-pulse" />
          </button>
        ) : (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <span className="font-black tracking-tighter text-[10px] uppercase">Interactive Mission</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-6 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                 <div className="text-[9px] font-black uppercase text-primary tracking-widest">Mission Progress</div>
                 <div className="text-[9px] font-black text-primary">{Math.round(progress)}%</div>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                 <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-primary" />
              </div>
              
              <div className="mt-3 text-[11px] font-medium leading-relaxed text-primary">
                {getMissionTip()}
              </div>
            </div>

            <div className="min-h-[60px]">
              <AnimatePresence mode="wait">
                {currentTask ? (
                  <motion.div 
                    key={currentTask.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                     <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                       {currentTask.phase}
                     </h4>
                     {renderTask(currentTask)}
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-4 text-center bg-green-500/5 rounded-lg border border-green-500/10"
                  >
                    <Trophy className="w-8 h-8 text-green-500 mb-2" />
                    <span className="text-[12px] font-black text-green-500 uppercase tracking-widest">
                      Mission Complete
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-1">You've explored everything!</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                {completedCount}/{totalTasks} Complete
              </div>
              <button 
                onClick={() => {
                  if (confirm("Restart mission?")) resetMission();
                }}
                className="text-[10px] items-center gap-1 flex uppercase font-black tracking-widest text-muted-foreground hover:text-destructive transition-colors"
              >
                Reset
              </button>
            </div>

            
            <AnimatePresence>
              {isCompleted && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex flex-col items-center gap-2"
                >
                  <Trophy className="w-5 h-5 text-green-500" />
                  <div className="text-[10px] text-green-500 font-black text-center uppercase tracking-widest">
                    Nexora Demo Master
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
