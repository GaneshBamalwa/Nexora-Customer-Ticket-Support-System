import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToAPI, postConversation } from '../api';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

const MISSION_KEY = (email: string, sessionId?: string) => `nexora_mission_${email}${sessionId ? '_' + sessionId : ''}`;
const AUTO_REPLY_KEY = (ticketId: number, sessionId?: string) =>
  `nexora_demo_auto_reply_${sessionId || 'global'}_${ticketId}`;

export type DemoChecklist = {
  ticket_opened: boolean;
  ticket_replied: boolean;
  ticket_resolved: boolean;
  dashboard_visited: boolean;
  assign_visited: boolean;
  analytics_visited: boolean;
  admin_visited: boolean;
  sql_visited: boolean;
};

const DEFAULT_STATE: DemoChecklist = {
  ticket_opened: false,
  ticket_replied: false,
  ticket_resolved: false,
  dashboard_visited: false,
  assign_visited: false,
  analytics_visited: false,
  admin_visited: false,
  sql_visited: false,
};

export const useDemoMission = () => {
  const { user } = useAuth();
  const [location] = useLocation();
  const isDemo = !!(user as any)?.is_demo;
  const sessionId = (user as any)?.session_id;

  const [checklist, setChecklist] = useState<DemoChecklist>(() => {
    if (!isDemo || !(user as any)?.Email_ID) return DEFAULT_STATE;
    const key = MISSION_KEY((user as any).Email_ID, sessionId);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_STATE;
  });
  const [isCompleted, setIsCompleted] = useState(() => Object.values(checklist).every(Boolean));

  useEffect(() => {
    const handleSync = (e: any) => {
       // Optional check to prevent unnecessary overriding 
       setChecklist(prev => JSON.stringify(prev) === JSON.stringify(e.detail) ? prev : e.detail);
    };
    window.addEventListener('demo_mission_update', handleSync);
    return () => window.removeEventListener('demo_mission_update', handleSync);
  }, []);

  // Save state & Check Completion
  useEffect(() => {
    if (!isDemo || !user?.Email_ID) return;
    const key = MISSION_KEY(user.Email_ID, sessionId);
    localStorage.setItem(key, JSON.stringify(checklist));
    
    // Broadcast state directly so sibling hooks update
    window.dispatchEvent(new CustomEvent('demo_mission_update', { detail: checklist }));

    // Check if fully completed
    const allDone = Object.values(checklist).every(Boolean);
    if (allDone && !isCompleted) {
      setIsCompleted(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00E5FF', '#BD00FF', '#00FFA3']
      });
      toast.success("🚀 Mission Complete – Nexora Demo Master!", { 
        description: "You've explored all key features.",
        duration: 8000
      });
    } else if (!allDone && isCompleted) {
       setIsCompleted(false);
    }
  }, [checklist, user, isDemo, sessionId, isCompleted]);

  const markComplete = (step: keyof DemoChecklist) => {
    setChecklist(prev => {
      if (prev[step]) return prev;
      return { ...prev, [step]: true };
    });
  };

  const resetMission = () => {
    setChecklist(DEFAULT_STATE);
    setIsCompleted(false);
    if (user?.Email_ID) {
      localStorage.removeItem(MISSION_KEY(user.Email_ID, sessionId));
    }
  };

  // Route-based detection
  useEffect(() => {
    if (!isDemo) return;
    if (location === '/admin-dashboard') {
      // Base landing triggers dashboard visited
      markComplete('dashboard_visited');
    }
    if (location === '/sql-console') {
      markComplete('sql_visited');
    }
  }, [location, isDemo]);

  // API-based Automated Action Detection
  useEffect(() => {
    if (!isDemo) return;

    const unsubscribe = subscribeToAPI(async (event) => {
      
      // Ticket Opened
      if (event.method === 'GET' && event.path.includes('/conversation')) {
        markComplete('ticket_opened');
      }

      // Ticket Replied
      if (event.method === 'POST' && event.path.includes('/conversation')) {
        markComplete('ticket_replied');
        
        // Only trigger Elon's response once
        if (!checklist.ticket_replied) {
            const ticketId = parseInt(event.path.split('/')[2], 10);
            if (!Number.isFinite(ticketId)) return;

            const autoReplyKey = AUTO_REPLY_KEY(ticketId, sessionId);
            if (sessionStorage.getItem(autoReplyKey) === '1') return;
            sessionStorage.setItem(autoReplyKey, '1');

            setTimeout(async () => {
              try {
                await postConversation(
                  ticketId,
                  "That's very helpful! I see the update now. Everything is back online. You may resolve the ticket and continue with the missions.", 
                  "elon@starlink.io"
                );
                toast("📬 New Message from Elon Musk", { description: "Review and resolve the ticket.", icon: "💬" });
              } catch (e) {
                // Release lock on failure so the auto-response can retry on next send.
                sessionStorage.removeItem(autoReplyKey);
              }
            }, 4000);
        }
      }

      // Ticket Resolved
      if (event.method === 'POST' && event.path.includes('/resolve')) {
        markComplete('ticket_resolved');
      }

    });

    return () => unsubscribe();
  }, [isDemo, checklist.ticket_replied, sessionId]);

  const totalSteps = Object.keys(checklist).length;
  const completedSteps = Object.values(checklist).filter(Boolean).length;
  const progress = (completedSteps / totalSteps) * 100;

  return { checklist, markComplete, resetMission, isDemo, progress, isCompleted };
};
