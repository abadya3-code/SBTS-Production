/*
Design Philosophy: Industrial Command Center Minimalism.
This application root keeps SBTS routes inside a persistent operational shell instead of isolated pages, so navigation, context, and access-control decisions remain visible and maintainable.
*/
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppShell } from "./components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import AccessControl from "./pages/AccessControl";
import Areas from "./pages/Areas";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import IsolationPackages from "./pages/IsolationPackages";
import BlindDetail from "./pages/BlindDetail";
import BlindDetailHub from "./pages/BlindDetailHub";
import Blinds from "./pages/Blinds";
import WorkflowStudio from "./pages/WorkflowStudio";
import SystemSettings from "./pages/SystemSettings";
import UserManagement from "./pages/UserManagement";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Approve from "./pages/Approve";
import BlindCertificate from "./pages/BlindCertificate";
import CertificateVerification from "./pages/CertificateVerification";
import Reports from "./pages/Reports";
import UserProfile from "./pages/UserProfile";
import AuditLogs from "./pages/AuditLogs";
import { Route, Switch } from "wouter";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* Public / Auth routes - outside AppShell */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/approve" component={Approve} />
      <Route path="/certificate/verify/:token" component={CertificateVerification} />
      <Route path="/certificate/:projectId/:tag" component={BlindCertificate} />
      {/* Protected routes - inside AppShell */}
      <Route>
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/areas" component={Areas} />
        <Route path="/areas/:areaId/projects/:projectId/blinds/:tag" component={BlindDetailHub} />
        <Route path="/areas/:areaId/projects/:projectId" component={ProjectDetail} />
        <Route path="/areas/:areaId/projects" component={Projects} />
        <Route path="/projects/:projectId/blinds/:tag" component={BlindDetailHub} />
        <Route path="/projects/:projectId" component={ProjectDetail} />
        <Route path="/projects" component={Projects} />
        <Route path="/isolation-packages" component={IsolationPackages} />
        <Route path="/blinds" component={Blinds} />
        <Route path="/workflow-studio" component={WorkflowStudio} />
        <Route path="/access-control" component={AccessControl} />
        <Route path="/users" component={UserManagement} />
        <Route path="/settings" component={SystemSettings} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/reports" component={Reports} />
        <Route path="/profile" component={UserProfile} />
        <Route path="/audit-logs" component={AuditLogs} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
