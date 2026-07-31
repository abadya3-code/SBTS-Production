/*
Design Philosophy: Industrial Command Center Minimalism.
The profile page is a personal operations hub — showing identity, settings, and activity
in a structured layout that matches the rest of the SBTS design language.
*/

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Hash,
  KeyRound,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Palette,
  Phone,
  Save,
  Shield,
  User,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTheme, THEMES, type ThemeId } from "@/contexts/ThemeContext";
import { ActivityTimeline } from "@/components/profile/ActivityTimeline";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Theme Option Card ───────────────────────────────────────────────────────

function ThemeCard({
  t,
  active,
  onSelect,
}: {
  t: (typeof THEMES)[number];
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group relative flex flex-col gap-2.5 rounded-xl border-2 p-3 text-left transition-all ${
        active
          ? "border-primary bg-primary/8 ring-1 ring-primary/20"
          : "border-border hover:border-primary/40 hover:bg-muted"
      }`}
    >
      {/* Swatch */}
      <div
        className="relative h-10 w-full overflow-hidden rounded-lg ring-1 ring-border"
        aria-hidden
      >
        <div className="absolute inset-0" style={{ background: t.preview.bg }} />
        <div className="absolute inset-y-0 left-0 w-3" style={{ background: t.preview.sidebar }} />
        <div className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full" style={{ background: t.preview.primary }} />
        <div className="absolute right-1.5 top-1.5 h-1 w-5 rounded-full opacity-70" style={{ background: t.preview.accent }} />
      </div>
      {/* Label */}
      <div>
        <p className={`text-xs font-bold leading-tight ${ active ? "text-primary" : "text-foreground" }`}>
          {t.name}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">{t.description}</p>
      </div>
      {active && (
        <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />
      )}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function UserProfile() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { themeId, setTheme, isDarkMode, allowUserThemeOverride } = useTheme();
  const theme = themeId;

  // ─── Data ────────────────────────────────────────────────────────────────
  const { data: profile, isLoading, refetch } = trpc.profile.get.useQuery();
  const { data: stats } = trpc.profile.stats.useQuery();

  // ─── Form state ──────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation2] = useState("");
  const [linkedIn, setLinkedIn] = useState("");
  const [department, setDepartment] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [formInitialized, setFormInitialized] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState<"image/jpeg" | "image/png" | "image/webp" | "image/gif">("image/jpeg");

  // Initialize form from profile data without updating state during render.
  useEffect(() => {
    if (!profile || formInitialized) return;
    setName(profile.name ?? "");
    setBio(profile.bio ?? "");
    setPhone(profile.phone ?? "");
    setLocation2(profile.userLocation ?? "");
    setLinkedIn(profile.linkedIn ?? "");
    setDepartment(profile.department ?? "");
    setSpecialty(profile.specialty ?? "");
    setEmployeeNumber(profile.employeeNumber ?? "");
    setFormInitialized(true);
  }, [profile, formInitialized]);

  // ─── Mutations ───────────────────────────────────────────────────────────
  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => { toast.success("Profile updated successfully"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const themeMutation = trpc.profile.updateTheme.useMutation({
    onSuccess: () => toast.success("Theme preference saved"),
    onError: (e) => toast.error(e.message),
  });

  const avatarMutation = trpc.profile.uploadAvatar.useMutation({
    onSuccess: (data) => {
      toast.success("Profile photo updated");
      setAvatarPreview(data.avatarUrl);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const passwordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: async () => {
      toast.success("Password changed. Sign in again with the new password.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      await logout();
      window.location.href = "/login";
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Image must be under 3MB"); return; }
    const validTypes: Array<"image/jpeg" | "image/png" | "image/webp" | "image/gif"> = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
    ];
    if (!validTypes.includes(file.type as any)) { toast.error("Unsupported format (JPEG, PNG, WebP, GIF only)"); return; }
    setAvatarMime(file.type as any);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAvatarPreview(result);
      setAvatarBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = () => {
    if (!avatarBase64) return;
    avatarMutation.mutate({ base64: avatarBase64, mimeType: avatarMime, filename: "avatar" });
  };

  const handleSaveProfile = () => {
    updateMutation.mutate({ name, bio, phone, userLocation: location, linkedIn, department, specialty, employeeNumber });
  };

  const handleThemeChange = (newTheme: string) => {
    // Map light/dark/system to ThemeId
    if (newTheme === "dark") {
      setTheme("modern");
    } else if (newTheme === "light") {
      setTheme("standard");
    }
    themeMutation.mutate({ theme: newTheme as "light" | "dark" | "system" });
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match"); return; }
    if (!newPassword) { toast.error("Enter a new password"); return; }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!profile) return null;

  const displayAvatar = avatarPreview || profile.avatarUrl;
  const initials = getInitials(profile.name);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back button */}
      <button
        onClick={() => setLocation("/dashboard")}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      {/* ─── Hero Card ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border-0 shadow-lg">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 relative">
          <div className="absolute inset-0 opacity-30"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(6,182,212,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(14,165,233,0.3) 0%, transparent 40%)" }}
          />
        </div>
        <CardContent className="relative px-6 pb-6">
          {/* Avatar */}
          <div className="absolute -top-12 left-6 flex items-end gap-3">
            <div className="relative">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt="Avatar"
                  className="h-24 w-24 rounded-2xl object-cover ring-4 ring-white dark:ring-slate-900 shadow-xl"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 ring-4 ring-white dark:ring-slate-900 shadow-xl text-2xl font-extrabold text-white">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg hover:bg-cyan-600 transition"
                title="Change photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarSelect}
              />
            </div>
          </div>

          {/* Name & role */}
          <div className="pt-16">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {profile.name ?? "Unnamed User"}
                  </h1>
                  {profile.role === "admin" && (
                    <Badge className="gap-1 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800">
                      <Shield className="h-3 w-3" />
                      System Admin
                    </Badge>
                  )}
                  {profile.userStatus === "active" && (
                    <BadgeCheck className="h-5 w-5 text-emerald-500" />
                  )}
                </div>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {profile.specialty ?? profile.department ?? "No specialty set"} · {profile.email ?? "No email"}
                </p>
              </div>

              {/* Upload button (shown when new avatar selected) */}
              {avatarBase64 && (
                <Button
                  onClick={handleAvatarUpload}
                  disabled={avatarMutation.isPending}
                  size="sm"
                  className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  {avatarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  Save Photo
                </Button>
              )}
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl">
                {profile.bio}
              </p>
            )}

            {/* Stats row */}
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <UserCircle2 className="h-4 w-4" />
                <span>Member since {formatDate(stats?.memberSince)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Last signed in {formatDate(stats?.lastSignedIn)}</span>
              </div>
              {profile.userLocation && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <MapPin className="h-4 w-4" />
                  <span>{profile.userLocation}</span>
                </div>
              )}
              {profile.linkedIn && (
                <a
                  href={profile.linkedIn.startsWith("http") ? profile.linkedIn : `https://${profile.linkedIn}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-cyan-500 hover:text-cyan-400 transition"
                >
                  <Linkedin className="h-4 w-4" />
                  <span>LinkedIn</span>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Two-column layout ──────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column (2/3) */}
        <div className="space-y-6 lg:col-span-2">

          {/* Personal Information */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-cyan-500" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9"
                      placeholder="Your full name"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      value={profile.email ?? ""}
                      disabled
                      className="pl-9 bg-slate-50 dark:bg-slate-800 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-slate-400">Email cannot be changed</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio / About</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short description about yourself, your role, or expertise..."
                  className="resize-none"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-right text-xs text-slate-400">{bio.length}/500</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9"
                      placeholder="+966 5x xxx xxxx"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation2(e.target.value)}
                      className="pl-9"
                      placeholder="e.g. Dhahran, Saudi Arabia"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="linkedin">LinkedIn Profile</Label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="linkedin"
                    value={linkedIn}
                    onChange={(e) => setLinkedIn(e.target.value)}
                    className="pl-9"
                    placeholder="linkedin.com/in/yourprofile"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Information */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-5 w-5 text-cyan-500" />
                Professional Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="department">Department</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="pl-9"
                      placeholder="e.g. Maintenance"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="specialty">Specialty / Job Title</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="specialty"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="pl-9"
                      placeholder="e.g. T&I Engineer"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empno">Employee Number</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="empno"
                    value={employeeNumber}
                    onChange={(e) => setEmployeeNumber(e.target.value)}
                    className="pl-9"
                    placeholder="e.g. EMP-00123"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={updateMutation.isPending}
              className="gap-2 bg-slate-950 hover:bg-slate-800 text-white px-8"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>

          {/* Change Password */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-5 w-5 text-amber-500" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPw">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPw"
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="newPw">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPw"
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPw">Confirm New Password</Label>
                  <Input
                    id="confirmPw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                  />
                </div>
              </div>
              {/* Password strength hints */}
              {newPassword.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 ${newPassword.length >= 8 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                    {newPassword.length >= 8 ? "✓" : "✗"} 8+ characters
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${/[A-Z]/.test(newPassword) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {/[A-Z]/.test(newPassword) ? "✓" : "○"} Uppercase
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${/[0-9]/.test(newPassword) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {/[0-9]/.test(newPassword) ? "✓" : "○"} Number
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${/[^A-Za-z0-9]/.test(newPassword) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {/[^A-Za-z0-9]/.test(newPassword) ? "✓" : "○"} Special char
                  </span>
                  {confirmPassword.length > 0 && (
                    <span className={`rounded-full px-2 py-0.5 ${newPassword === confirmPassword ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                      {newPassword === confirmPassword ? "✓ Passwords match" : "✗ Passwords don't match"}
                    </span>
                  )}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  onClick={handleChangePassword}
                  disabled={passwordMutation.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                  variant="outline"
                  className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
                >
                  {passwordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">
          {/* Account Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-cyan-500" />
                Account Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Role</span>
                <Badge variant={profile.role === "admin" ? "default" : "secondary"} className={profile.role === "admin" ? "bg-cyan-500 text-white" : ""}>
                  {profile.role === "admin" ? "System Admin" : "User"}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Status</span>
                <Badge variant="outline" className={
                  profile.userStatus === "active"
                    ? "border-emerald-200 text-emerald-700 dark:text-emerald-400"
                    : "border-amber-200 text-amber-700"
                }>
                  {profile.userStatus}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">User ID</span>
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300">#{profile.id}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Member since</span>
                <span className="text-xs text-slate-600 dark:text-slate-300">{formatDate(profile.createdAt)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Last login</span>
                <span className="text-xs text-slate-600 dark:text-slate-300">{formatDate(profile.lastSignedIn)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Theme Preference */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-5 w-5 text-primary" />
                Appearance
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {allowUserThemeOverride ? "Choose your preferred display theme" : "The plant administrator enforces the system theme"}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2.5">
                {THEMES.map((t) => (
                  <ThemeCard
                    key={t.id}
                    t={t}
                    active={themeId === t.id}
                    onSelect={() => {
                      if (!allowUserThemeOverride) {
                        toast.info("Theme selection is controlled by System Settings.");
                        return;
                      }
                      setTheme(t.id as ThemeId);
                      themeMutation.mutate({ theme: t.id as "standard" | "modern" | "manus" });
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-sm"
                onClick={() => setLocation("/dashboard")}
              >
                <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                Go to Dashboard
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-sm"
                onClick={() => setLocation("/notifications")}
              >
                <Globe className="h-4 w-4 text-cyan-500" />
                View Notifications
              </Button>
              {profile.role === "admin" && (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm"
                  onClick={() => setLocation("/system-settings")}
                >
                  <Shield className="h-4 w-4 text-cyan-500" />
                  System Settings
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Activity Timeline (full width) ─────────────────────────────── */}
      <ActivityTimeline />
    </div>
  );
}
