import { useEffect } from "react";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { CustomCursor } from "./components/CustomCursor";
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

function Router() {
  return (
    <Switch>
      {/* Specific Protected Pages FIRST */}
      <Route path="/agent-dashboard"><ProtectedRoute roles={["Agent", "Administrator"]}><AgentDashboard /></ProtectedRoute></Route>
      <Route path="/admin-dashboard"><ProtectedRoute roles={["Administrator"]}><AdminDashboard /></ProtectedRoute></Route>
      <Route path="/conversation/:ticketId"><ProtectedRoute roles={["Customer", "Agent", "Administrator"]}><Conversation /></ProtectedRoute></Route>
      <Route path="/set-password"><ProtectedRoute roles={["Agent", "Administrator"]}><SetPassword /></ProtectedRoute></Route>
      <Route path="/sql-console"><ProtectedRoute roles={["Administrator"]}><SqlConsole /></ProtectedRoute></Route>
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
          const { authenticated, user, loading } = useAuth();
          if (loading) return null;
          
          // If staff is logged in, send them to dashboard
          if (authenticated && user) {
            const role = (user?.Role || user?.role || "").toLowerCase();
            if (role === "administrator") return <Redirect to="/admin-dashboard" />;
            if (role === "agent") return <Redirect to="/agent-dashboard" />;
            // Customers stay on this Home page
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
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
