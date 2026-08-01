/*
Design Philosophy: Industrial Command Center Minimalism.
This application root keeps SBTS routes inside a persistent operational shell instead of isolated pages, so navigation, context, and access-control decisions remain visible and maintainable.
*/
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppShell } from "./components/layout/AppShell";
import { Route, Switch } from "wouter";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const Areas = lazy(() => import("./pages/Areas"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const IsolationPackages = lazy(() => import("./pages/IsolationPackages"));
const BlindDetailHub = lazy(() => import("./pages/BlindDetailHub"));
const Blinds = lazy(() => import("./pages/Blinds"));
const WorkflowStudio = lazy(() => import("./pages/WorkflowStudio"));
const SystemSettings = lazy(() => import("./pages/SystemSettings"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Approve = lazy(() => import("./pages/Approve"));
const BlindCertificate = lazy(() => import("./pages/BlindCertificate"));
const CertificateVerification = lazy(
  () => import("./pages/CertificateVerification")
);
const BlindQrVerification = lazy(() => import("./pages/BlindQrVerification"));
const BlindTagPrint = lazy(() => import("./pages/BlindTagPrint"));
const Reports = lazy(() => import("./pages/Reports"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));

function RouteLoading() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center bg-slate-50 px-4 text-sm font-semibold text-slate-500">
      Loading SBTS workspace…
    </div>
  );
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
      {/* Public / Auth routes - outside AppShell */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/approve" component={Approve} />
      <Route
        path="/certificate/verify/:token"
        component={CertificateVerification}
      />
      <Route path="/blind/verify/:token" component={BlindQrVerification} />
      <Route path="/tags/print/:projectId" component={BlindTagPrint} />
      <Route path="/certificate/:projectId/:tag" component={BlindCertificate} />
      {/* Protected routes - inside AppShell */}
      <Route>
        <AppShell>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/areas" component={Areas} />
            <Route
              path="/areas/:areaId/projects/:projectId/blinds/:tag"
              component={BlindDetailHub}
            />
            <Route
              path="/areas/:areaId/projects/:projectId"
              component={ProjectDetail}
            />
            <Route path="/areas/:areaId/projects" component={Projects} />
            <Route
              path="/projects/:projectId/blinds/:tag"
              component={BlindDetailHub}
            />
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
    </Suspense>
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
