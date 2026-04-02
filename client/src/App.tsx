import { useEffect } from "react";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { CustomCursor } from "./components/CustomCursor";
import { FeatureDiscoveryPanel } from "./components/FeatureDiscoveryPanel";
import NotFound from "./pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import { useAuth } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Home from "./pages/Home";
import About from "./pages/About";
import LoginPage from "./pages/LoginPage";
import ForgotPassword from "./pages/ForgotPassword";
import AgentDashboard from "./pages/AgentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Conversation from "./pages/Conversation";
import SetPassword from "./pages/SetPassword";
import SqlConsole from "./pages/SqlConsole";
import DemoStart from "./pages/DemoStart";

function Router() {
  const { authenticated, user, loading } = useAuth();
  const role = (user?.Role || user?.role || "").toLowerCase();
  const isDemo = role === "demoagent";

  return (
    <Switch>
      {/* Demo Specific Routes */}
      <Route path="/demo-start" component={DemoStart} />

      {/* Specific Protected Pages FIRST */}
      <Route path="/agent-dashboard">
        <ProtectedRoute roles={["Agent", "Administrator"]}>
          {isDemo ? <Redirect to="/admin-dashboard" /> : <AgentDashboard />}
        </ProtectedRoute>
      </Route>
      <Route path="/admin-dashboard">
        <ProtectedRoute roles={["Administrator", "DemoAgent"]}>
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/conversation/:ticketId">
        <ProtectedRoute roles={["Customer", "Agent", "Administrator", "DemoAgent"]}>
          <Conversation />
        </ProtectedRoute>
      </Route>
      <Route path="/set-password"><ProtectedRoute roles={["Agent", "Administrator"]}><SetPassword /></ProtectedRoute></Route>
      <Route path="/sql-console"><ProtectedRoute roles={["Administrator", "DemoAgent"]}><SqlConsole /></ProtectedRoute></Route>
      <Route path="/portal"><ProtectedRoute roles={["Customer"]}><Home /></ProtectedRoute></Route>

      {/* Public Pages */}
      <Route path={"/about"} component={About} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/login"} component={LoginPage} />
      <Route path="/logout">
        {() => {
          const { logout } = useAuth();
          useEffect(() => { logout(); }, []);
          return <Redirect to="/" />;
        }}
      </Route>
      
      {/* Home / Entry Page - UNIFIED */}
      <Route path="/">
        {() => {
          if (loading) return null;
          
          if (authenticated && user) {
            if (role === "administrator") return <Redirect to="/admin-dashboard" />;
            if (role === "agent") return <Redirect to="/agent-dashboard" />;
            if (role === "demoagent") return <Redirect to="/admin-dashboard" />;
          }
          
          return <Home />;
        }}
      </Route>

      {/* Fallback */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <CustomCursor />
            <FeatureDiscoveryPanel />
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
