/*
  AppShell — SBTS Professional
  ══════════════════════════════════════════
  Fully theme-aware layout shell.
  Uses CSS variables from index.css so all three themes
  (Standard, Modern, Manus) render correctly without
  any hardcoded color classes.
*/
import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronDown,
  Loader2,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { appMeta, navItems, secondaryNavItems } from "@/lib/domainCatalog";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { THEME_STORAGE_KEY, normalizeThemeId, useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { releaseVersion, shortReleaseCommit } from "@/lib/release";

const navPermissionByKey: Record<string, string | null> = {
  dashboard: null,
  areas: "projects.view",
  projects: "projects.view",
  "isolation-packages": "workflow.package.manage",
  blinds: "blinds.view",
  "workflow-studio": "workflow.configure",
  "access-control": "roles.manage",
  users: "users.view",
  settings: "admin",
  notifications: null,
  reports: "reports.view",
  audit: "audit.view",
};

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const { setTheme, themeId } = useTheme();

  // Load user profile to apply saved preferred theme
  const { data: profileData } = trpc.profile.get.useQuery(undefined, {
    enabled: !loading && !!user,
    refetchOnWindowFocus: false,
  });

  // Hydrate a new browser from the server profile, but never overwrite a
  // valid preference already saved in this browser.
  useEffect(() => {
    if (!profileData?.preferredTheme) return;
    try {
      if (normalizeThemeId(localStorage.getItem(THEME_STORAGE_KEY))) return;
    } catch {
      // Storage may be unavailable in hardened/private browser contexts.
    }
    const preferredTheme = normalizeThemeId(profileData.preferredTheme);
    if (preferredTheme) setTheme(preferredTheme);
  }, [profileData?.preferredTheme, setTheme]);

  // Load dynamic settings
  const { data: generalSettings } = trpc.settings.general.get.useQuery();
  const dynamicAppName = (generalSettings as any)?.appName || appMeta.title;
  const configuredEdition = String((generalSettings as any)?.versionName || "Professional Edition");
  const dynamicEdition = /(?:v?1\.0|react frontend alpha)/i.test(configuredEdition)
    ? "Professional Edition"
    : configuredEdition;
  const dynamicCompanyName = (generalSettings as any)?.companyName || appMeta.site;

  const { data: myAccess } = trpc.accessControl.myAccess.useQuery(undefined, {
    enabled: !loading && !!user,
    refetchOnWindowFocus: false,
  });
  const canSeeNavItem = (key: string) => {
    if (user?.role === "admin") return true;
    const required = navPermissionByKey[key];
    if (required == null) return true;
    if (required === "admin") return false;
    return myAccess?.permissionKeys.includes(required) ?? false;
  };
  const visibleNavItems = navItems.filter((item) => canSeeNavItem(item.key));
  const visibleSecondaryNavItems = secondaryNavItems.filter((item) => canSeeNavItem(item.key));

  // Auth guard
  useEffect(() => {
    if (loading) return;
    if (!user) { setLocation("/login"); return; }
    if ((user as any).role === "admin") return;
    const userStatus = (user as any).userStatus;
    if (userStatus === "pending" || userStatus === "rejected") { setLocation("/approve"); return; }
    if (userStatus === "active") return;
    if (!userStatus) { setLocation("/register"); return; }
  }, [user, loading, setLocation]);

  // Pending users count for admin badge
  const pendingQuery = trpc.accessControl.pendingUsers.useQuery(undefined, {
    enabled: !loading && user?.role === "admin",
    refetchInterval: 60_000,
  });
  const pendingCount = pendingQuery.data?.length ?? 0;

  const showComingSoon = (label: string) => toast.info(`${label} — قريباً`);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm tracking-widest uppercase">
            جاري التحقق من الصلاحيات...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userInitials = (user as any).name
    ? (user as any).name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Subtle background grid ─────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 industrial-grid" aria-hidden />

      {/* ── Mobile overlay ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SIDEBAR
          ══════════════════════════════════════════════════════════════════ */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col",
          "border-r transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--sidebar-border)",
          color: "var(--sidebar-foreground)",
        }}
      >
        {/* Sidebar Header */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-4 border-b"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 min-w-0"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: "color-mix(in oklch, var(--sidebar-primary) 20%, transparent)",
                boxShadow: "0 0 0 1px color-mix(in oklch, var(--sidebar-primary) 35%, transparent)",
              }}
            >
              <ShieldCheck
                className="h-5 w-5"
                style={{ color: "var(--sidebar-primary)" }}
              />
            </div>
            <div className="min-w-0">
              <div
                className="truncate text-sm font-extrabold tracking-tight"
                style={{ color: "var(--sidebar-foreground)" }}
              >
                {dynamicAppName}
              </div>
              <div
                className="truncate text-xs font-medium opacity-60"
                style={{ color: "var(--sidebar-foreground)" }}
              >
                {dynamicCompanyName}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            {/* Version badge */}
            <span
              className="hidden rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline-block"
              style={{
                background: "color-mix(in oklch, var(--sidebar-primary) 18%, transparent)",
                color: "var(--sidebar-primary)",
              }}
            >
              v{releaseVersion}
            </span>
            {/* Mobile close */}
            <button
              className="rounded-lg p-1.5 opacity-60 hover:opacity-100 transition lg:hidden"
              style={{ color: "var(--sidebar-foreground)" }}
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Primary nav */}
          <div>
            <p
              className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-50"
              style={{ color: "var(--sidebar-foreground)" }}
            >
              Command
            </p>
            <nav className="space-y-0.5">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active =
                  location === item.path ||
                  (location === "/" && item.path === "/dashboard") ||
                  (item.path !== "/dashboard" && location.startsWith(`${item.path}/`)) ||
                  (item.path === "/projects" && /^\/areas\/[^/]+\/projects(\/.*)?$/.test(location));
                return (
                  <Link
                    key={item.key}
                    href={item.path}
                    onClick={() => setMobileOpen(false)}
                    className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all"
                    style={{
                      background: active
                        ? "color-mix(in oklch, var(--sidebar-primary) 15%, transparent)"
                        : "transparent",
                      color: active
                        ? "var(--sidebar-primary)"
                        : "var(--sidebar-foreground)",
                      opacity: active ? 1 : 0.7,
                      boxShadow: active
                        ? "inset 3px 0 0 var(--sidebar-primary)"
                        : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background =
                          "color-mix(in oklch, var(--sidebar-foreground) 8%, transparent)";
                        (e.currentTarget as HTMLElement).style.opacity = "1";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.opacity = "0.7";
                      }
                    }}
                  >
                    <Icon
                      className="h-4.5 w-4.5 shrink-0"
                      style={{
                        color: active ? "var(--sidebar-primary)" : "var(--sidebar-foreground)",
                        opacity: active ? 1 : 0.6,
                      }}
                    />
                    <span>{item.label}</span>
                    {item.key === "users" && pendingCount > 0 && (
                      <span
                        className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold"
                        style={{
                          background: "oklch(0.78 0.165 75)",
                          color: "oklch(0.13 0.025 255)",
                        }}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Secondary nav */}
          <div>
            <p
              className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-50"
              style={{ color: "var(--sidebar-foreground)" }}
            >
              Next Modules
            </p>
            <div className="space-y-0.5">
              {visibleSecondaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <button
                    key={item.key}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all",
                      isActive ? "opacity-100" : "opacity-60 hover:opacity-90"
                    )}
                    style={{ color: "var(--sidebar-foreground)" }}
                    onClick={() => item.path ? setLocation(item.path) : showComingSoon(item.label)}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Footer — User card */}
        <div
          className="border-t p-3"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <div
            className="flex items-center gap-3 rounded-xl p-2.5"
            style={{
              background: "color-mix(in oklch, var(--sidebar-foreground) 6%, transparent)",
            }}
          >
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:opacity-80 transition p-0.5"
            >
              {(user as any).avatarUrl ? (
                <img
                  src={(user as any).avatarUrl}
                  alt="Avatar"
                  className="h-9 w-9 rounded-lg object-cover ring-2 ring-sidebar-primary/30"
                />
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold"
                  style={{
                    background: "var(--sidebar-primary)",
                    color: "var(--sidebar-primary-foreground)",
                  }}
                >
                  {userInitials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-sm font-bold"
                  style={{ color: "var(--sidebar-foreground)" }}
                >
                  {(user as any).name ?? "مستخدم"}
                </div>
                <div
                  className="truncate text-xs opacity-55"
                  style={{ color: "var(--sidebar-foreground)" }}
                >
                  {user.role === "admin" ? "مسؤول النظام" : (user as any).specialty ?? "مستخدم"}
                </div>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 opacity-50 hover:opacity-100 transition"
              style={{ color: "var(--sidebar-foreground)" }}
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ══════════════════════════════════════════════════════════════════ */}
      <div className="relative min-h-screen lg:pl-[280px]">
        {/* ── Top Header ──────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-30 border-b px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8"
          style={{
            background: "color-mix(in oklch, var(--background) 85%, transparent)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="rounded-xl border p-2.5 transition hover:bg-muted lg:hidden"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>

            {/* App title */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1
                  className="truncate text-base font-extrabold tracking-tight sm:text-lg"
                  style={{ color: "var(--foreground)" }}
                >
                  {dynamicAppName}
                </h1>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{
                    background: "color-mix(in oklch, var(--primary) 12%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  v{releaseVersion}
                </span>
              </div>
              <p
                className="mt-0.5 truncate text-xs font-medium opacity-55"
                style={{ color: "var(--foreground)" }}
              >
                {dynamicCompanyName} · {dynamicEdition} · build {shortReleaseCommit}
              </p>
            </div>

            {/* Search bar */}
            <div
              className="hidden min-w-[240px] items-center gap-2 rounded-xl border px-3 py-2 md:flex"
              style={{
                borderColor: "var(--border)",
                background: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="text-sm">Search blind tag, project...</span>
            </div>

            {/* Theme toggle */}
            <ThemeToggle className="rounded-xl border transition" />

            {/* Notifications */}
            <NotificationBell />
          </div>
        </header>

        {/* ── Page content ────────────────────────────────────────────── */}
        <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
