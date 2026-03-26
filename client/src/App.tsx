import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { CustomCursor } from "./components/CustomCursor";
import NotFound from "./pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import About from "./pages/About";
import StaffLogin from "./pages/StaffLogin";
import AgentDashboard from "./pages/AgentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Conversation from "./pages/Conversation";
import SetPassword from "./pages/SetPassword";
import SqlConsole from "./pages/SqlConsole";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/about"} component={About} />
      <Route path={"/staff-login"} component={StaffLogin} />
      <Route path={"/agent-dashboard"} component={AgentDashboard} />
      <Route path={"/admin-dashboard"} component={AdminDashboard} />
      <Route path={"/conversation/:ticketId"} component={Conversation} />
      <Route path={"/set-password"} component={SetPassword} />
      <Route path={"/sql-console"} component={SqlConsole} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <CustomCursor />
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
