/*
Design Philosophy: Industrial Command Center Minimalism.
System Settings Center — Full operational configuration in one authoritative panel.
5 Tabs: General, Default Tag, Certificate, Security, Notifications.
*/
import { type DragEvent, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bell, Building2, FileText, Lock, Save, Settings, Shield, Tag, Upload, X, Image, Palette, Eye, EyeOff, Plus, Trash2, ToggleLeft, Workflow, ShieldAlert, ShieldCheck, Layers3, Timer, CheckCircle2, Gauge, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { canonicalWorkflowPhases, vesselEntryReadinessGate, finalReinstatementGate } from "../../../shared/workflowSpecification";
import { InspectionActivityBuilder } from "@/components/settings/InspectionActivityBuilder";
import { CertificateQualitySettings } from "@/components/settings/CertificateQualitySettings";

type Tab = "general" | "workflowSafety" | "defaultTag" | "certificate" | "security" | "notifications" | "features";

const tabs: { key: Tab; label: string; icon: typeof Settings; description: string }[] = [
  { key: "general", label: "General Settings", icon: Settings, description: "App identity, company info, dashboard & versioning" },
  { key: "workflowSafety", label: "Workflow & Safety", icon: Workflow, description: "Canonical workflow, gates and plant safety policies" },
  { key: "defaultTag", label: "Default Tag Settings", icon: Tag, description: "Tag format, visuals & live preview" },
  { key: "certificate", label: "Certificate Settings", icon: FileText, description: "Print layout, sections & branding" },
  { key: "security", label: "Security Settings", icon: Shield, description: "QR access, delete policies & sessions" },
  { key: "notifications", label: "Notification Settings", icon: Bell, description: "Event notification preferences" },
  { key: "features", label: "Feature Controls", icon: ToggleLeft, description: "Enable/disable Blind Hub features" },
];

// ─── General Settings Tab ─────────────────────────────────────────────────────

function GeneralSettingsTab() {
  const { data, isLoading, refetch } = trpc.settings.general.get.useQuery();
  const updateMutation = trpc.settings.general.update.useMutation({
    onSuccess: () => { toast.success("General settings saved successfully."); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const uploadImageMutation = trpc.settings.general.uploadImage.useMutation({
    onSuccess: ({ url }) => { toast.success("Image uploaded."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<{
    companyName: string; companyCode: string; plantName: string; contractNumber: string;
    language: "en" | "ar"; timezone: string; dateFormat: string;
    defaultTheme: "standard" | "modern" | "manus"; allowUserThemeOverride: boolean;
    appName: string; appDescription: string; appImageUrl: string; companyLogoUrl: string;
    companyDescription: string; regionName: string;
    dashboardHeroTitle: string; dashboardHeroDescription: string; dashboardHeroBadge: string;
    dashboardHeroImageUrl: string; dashboardCtaButtons: string;
    versionName: string; versionDate: string;
    maintenanceMode: boolean;
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      companyName: data.companyName,
      companyCode: data.companyCode,
      plantName: data.plantName,
      contractNumber: data.contractNumber ?? "",
      language: (data.language as "en" | "ar") ?? "en",
      timezone: data.timezone,
      dateFormat: data.dateFormat,
      defaultTheme: (data.defaultTheme as "standard" | "modern" | "manus") ?? "standard",
      allowUserThemeOverride: data.allowUserThemeOverride === 1,
      appName: data.appName ?? "SBTS Professional",
      appDescription: data.appDescription ?? "",
      appImageUrl: data.appImageUrl ?? "",
      companyLogoUrl: data.companyLogoUrl ?? "",
      companyDescription: data.companyDescription ?? "",
      regionName: data.regionName ?? "",
      dashboardHeroTitle: data.dashboardHeroTitle ?? "",
      dashboardHeroDescription: data.dashboardHeroDescription ?? "",
      dashboardHeroBadge: data.dashboardHeroBadge ?? "",
      dashboardHeroImageUrl: data.dashboardHeroImageUrl ?? "",
      dashboardCtaButtons: data.dashboardCtaButtons ?? "[]",
      versionName: data.versionName ?? "",
      versionDate: data.versionDate ?? "",
      maintenanceMode: data.maintenanceMode === 1,
    });
  
  }, [data]);

  if (isLoading || !form) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  }

  const handleUpload = (target: "appImage" | "companyLogo" | "heroImage") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/jpg,image/svg+xml,image/webp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast.error("File must be under 2MB"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        uploadImageMutation.mutate({ base64, mimeType: file.type as "image/png", target });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSave = () => {
    updateMutation.mutate({
      companyName: form.companyName,
      companyCode: form.companyCode,
      plantName: form.plantName,
      contractNumber: form.contractNumber || null,
      language: form.language,
      timezone: form.timezone,
      dateFormat: form.dateFormat,
      defaultTheme: form.defaultTheme,
      allowUserThemeOverride: form.allowUserThemeOverride,
      appName: form.appName,
      appDescription: form.appDescription || null,
      appImageUrl: form.appImageUrl || null,
      companyLogoUrl: form.companyLogoUrl || null,
      companyDescription: form.companyDescription || null,
      regionName: form.regionName,
      dashboardHeroTitle: form.dashboardHeroTitle,
      dashboardHeroDescription: form.dashboardHeroDescription || null,
      dashboardHeroBadge: form.dashboardHeroBadge,
      dashboardHeroImageUrl: form.dashboardHeroImageUrl || null,
      dashboardCtaButtons: form.dashboardCtaButtons || null,
      versionName: form.versionName,
      versionDate: form.versionDate || null,
      maintenanceMode: form.maintenanceMode,
    });
  };

  return (
    <div className="space-y-6">
      {/* App Identity */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 ring-1 ring-cyan-100">
              <Image className="h-5 w-5 text-cyan-700" />
            </div>
            <div>
              <CardTitle className="text-base font-extrabold text-slate-950">Application Identity</CardTitle>
              <CardDescription className="text-xs text-slate-500">App name, description, and default image</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Application Name</Label>
              <Input value={form.appName} onChange={e => setForm(f => f && ({ ...f, appName: e.target.value }))} placeholder="SBTS Professional" className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Region / Location</Label>
              <Input value={form.regionName} onChange={e => setForm(f => f && ({ ...f, regionName: e.target.value }))} placeholder="e.g. Eastern Province" className="sbts-input" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Application Description</Label>
              <Textarea value={form.appDescription} onChange={e => setForm(f => f && ({ ...f, appDescription: e.target.value }))} placeholder="Brief description of the application..." rows={2} className="sbts-input resize-none" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">App Image</Label>
              <div className="flex items-center gap-3">
                {form.appImageUrl && <img src={form.appImageUrl} alt="App" className="h-14 w-14 rounded-xl border object-cover" />}
                <Button type="button" variant="outline" size="sm" onClick={() => handleUpload("appImage")} disabled={uploadImageMutation.isPending}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> {form.appImageUrl ? "Replace" : "Upload"}
                </Button>
                {form.appImageUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setForm(f => f && ({ ...f, appImageUrl: "" }))} className="text-red-500"><X className="h-3.5 w-3.5" /></Button>}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Company Logo</Label>
              <div className="flex items-center gap-3">
                {form.companyLogoUrl && <img src={form.companyLogoUrl} alt="Logo" className="h-14 w-14 rounded-xl border object-contain" />}
                <Button type="button" variant="outline" size="sm" onClick={() => handleUpload("companyLogo")} disabled={uploadImageMutation.isPending}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> {form.companyLogoUrl ? "Replace" : "Upload"}
                </Button>
                {form.companyLogoUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setForm(f => f && ({ ...f, companyLogoUrl: "" }))} className="text-red-500"><X className="h-3.5 w-3.5" /></Button>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance defaults */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 ring-1 ring-violet-100"><Palette className="h-5 w-5 text-violet-700" /></div>
            <div><CardTitle className="text-base font-extrabold text-slate-950">Application Theme Policy</CardTitle><CardDescription className="text-xs text-slate-500">Keep the visual system consistent across dashboards, field pages and certificates.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Default Theme</Label>
            <Select value={form.defaultTheme} onValueChange={(value) => setForm((current) => current && ({ ...current, defaultTheme: value as "standard" | "modern" | "manus" }))}>
              <SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="standard">Standard · light command center</SelectItem><SelectItem value="modern">Modern · dark industrial</SelectItem><SelectItem value="manus">Manus · premium violet</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div><div className="text-sm font-bold text-slate-900">Allow user theme override</div><div className="text-xs text-slate-500">When disabled, the plant default is enforced for every account.</div></div>
            <Switch checked={form.allowUserThemeOverride} onCheckedChange={(value) => setForm((current) => current && ({ ...current, allowUserThemeOverride: value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Company Info */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 ring-1 ring-cyan-100">
              <Building2 className="h-5 w-5 text-cyan-700" />
            </div>
            <div>
              <CardTitle className="text-base font-extrabold text-slate-950">Company Information</CardTitle>
              <CardDescription className="text-xs text-slate-500">Core organizational identifiers used across reports and certificates</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Company Name</Label>
              <Input value={form.companyName} onChange={e => setForm(f => f && ({ ...f, companyName: e.target.value }))} placeholder="e.g. Shedgum Gas Plant" className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Company Code</Label>
              <Input value={form.companyCode} onChange={e => setForm(f => f && ({ ...f, companyCode: e.target.value }))} placeholder="e.g. SGP" maxLength={10} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Plant Name</Label>
              <Input value={form.plantName} onChange={e => setForm(f => f && ({ ...f, plantName: e.target.value }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Contract Number</Label>
              <Input value={form.contractNumber} onChange={e => setForm(f => f && ({ ...f, contractNumber: e.target.value }))} placeholder="SAP-2024-001" className="sbts-input" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Company Description</Label>
              <Textarea value={form.companyDescription} onChange={e => setForm(f => f && ({ ...f, companyDescription: e.target.value }))} rows={2} className="sbts-input resize-none" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Localization */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Localization</CardTitle>
          <CardDescription className="text-xs text-slate-500">Language, timezone, and date format</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Language</Label>
              <Select value={form.language} onValueChange={v => setForm(f => f && ({ ...f, language: v as "en" | "ar" }))}>
                <SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Timezone</Label>
              <Select value={form.timezone} onValueChange={v => setForm(f => f && ({ ...f, timezone: v }))}>
                <SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Riyadh">Asia/Riyadh (UTC+3)</SelectItem>
                  <SelectItem value="Asia/Dubai">Asia/Dubai (UTC+4)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Date Format</Label>
              <Select value={form.dateFormat} onValueChange={v => setForm(f => f && ({ ...f, dateFormat: v }))}>
                <SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Hero */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Dashboard Hero Section</CardTitle>
          <CardDescription className="text-xs text-slate-500">Title, description, badge, and CTA buttons shown on the main dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Hero Title</Label>
              <Input value={form.dashboardHeroTitle} onChange={e => setForm(f => f && ({ ...f, dashboardHeroTitle: e.target.value }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Hero Description</Label>
              <Textarea value={form.dashboardHeroDescription} onChange={e => setForm(f => f && ({ ...f, dashboardHeroDescription: e.target.value }))} rows={2} className="sbts-input resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Badge Text</Label>
              <Input value={form.dashboardHeroBadge} onChange={e => setForm(f => f && ({ ...f, dashboardHeroBadge: e.target.value }))} placeholder="e.g. Production Ready" className="sbts-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Hero Background Image</Label>
              <div className="flex items-center gap-3">
                {form.dashboardHeroImageUrl && <img src={form.dashboardHeroImageUrl} alt="Hero" className="h-10 w-20 rounded-lg border object-cover" />}
                <Button type="button" variant="outline" size="sm" onClick={() => handleUpload("heroImage")} disabled={uploadImageMutation.isPending}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> {form.dashboardHeroImageUrl ? "Replace" : "Upload"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Version & System */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Version & System</CardTitle>
          <CardDescription className="text-xs text-slate-500">Version info and maintenance mode</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Version Name</Label>
              <Input value={form.versionName} onChange={e => setForm(f => f && ({ ...f, versionName: e.target.value }))} placeholder="Professional Edition" className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Version Date</Label>
              <Input value={form.versionDate} onChange={e => setForm(f => f && ({ ...f, versionDate: e.target.value }))} placeholder="2025-01-01" className="sbts-input" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-amber-900">Maintenance Mode</div>
                {form.maintenanceMode && <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800 text-[10px]">ACTIVE</Badge>}
              </div>
              <div className="text-xs text-amber-700">Restrict system access to administrators only</div>
            </div>
            <Switch checked={form.maintenanceMode} onCheckedChange={v => setForm(f => f && ({ ...f, maintenanceMode: v }))} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 rounded-2xl bg-slate-950 px-6 font-bold text-white hover:bg-slate-800">
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? "Saving..." : "Save General Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── Default Tag Settings Tab ─────────────────────────────────────────────────

function DefaultTagSettingsTab() {
  const { data, isLoading, refetch } = trpc.settings.defaultTag.get.useQuery();
  const updateMutation = trpc.settings.defaultTag.update.useMutation({
    onSuccess: () => { toast.success("Tag settings saved."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<{
    tagPrefix: string; tagSeparator: string; tagPaddingDigits: number; tagStartNumber: number;
    defaultType: string; defaultSize: string; defaultRate: string;
    defaultPriority: "Low" | "Normal" | "High" | "Critical";
    defaultPhase: "Broken / Preparation" | "Assembly" | "Tight & Torque" | "Final Tight" | "Inspection Ready";
    autoGenerateTag: boolean; requireEquipment: boolean; requireLocation: boolean; requireIsolationPoint: boolean;
    tagColor: string; tagWidth: number; tagHeight: number; tagFontSize: number; tagFontColor: string;
    tagTheme: string; tagShowLogo: boolean; tagShowQR: boolean; tagHoleEnabled: boolean; tagHolePosition: string;
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      tagPrefix: data.tagPrefix,
      tagSeparator: data.tagSeparator,
      tagPaddingDigits: data.tagPaddingDigits,
      tagStartNumber: data.tagStartNumber,
      defaultType: data.defaultType,
      defaultSize: data.defaultSize,
      defaultRate: data.defaultRate ?? "",
      defaultPriority: (data.defaultPriority as "Low" | "Normal" | "High" | "Critical") ?? "Normal",
      defaultPhase: (data.defaultPhase as "Broken / Preparation" | "Assembly" | "Tight & Torque" | "Final Tight" | "Inspection Ready") ?? "Broken / Preparation",
      autoGenerateTag: data.autoGenerateTag === 1,
      requireEquipment: data.requireEquipment === 1,
      requireLocation: data.requireLocation === 1,
      requireIsolationPoint: data.requireIsolationPoint === 1,
      tagColor: (data as any).tagColor ?? "#0f172a",
      tagWidth: (data as any).tagWidth ?? 85,
      tagHeight: (data as any).tagHeight ?? 55,
      tagFontSize: (data as any).tagFontSize ?? 14,
      tagFontColor: (data as any).tagFontColor ?? "#0f172a",
      tagTheme: (data as any).tagTheme ?? "industrial",
      tagShowLogo: ((data as any).tagShowLogo ?? 1) === 1,
      tagShowQR: ((data as any).tagShowQR ?? 1) === 1,
      tagHoleEnabled: ((data as any).tagHoleEnabled ?? 1) === 1,
      tagHolePosition: (data as any).tagHolePosition ?? "top-center",
    });
  
  }, [data]);

  if (isLoading || !form) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  }

  const previewTag = `${form.tagPrefix}${form.tagSeparator}${String(form.tagStartNumber).padStart(form.tagPaddingDigits, "0")}`;

  const handleSave = () => {
    updateMutation.mutate({
      tagPrefix: form.tagPrefix,
      tagSeparator: form.tagSeparator,
      tagPaddingDigits: form.tagPaddingDigits,
      tagStartNumber: form.tagStartNumber,
      defaultType: form.defaultType,
      defaultSize: form.defaultSize,
      defaultRate: form.defaultRate || undefined,
      defaultPriority: form.defaultPriority,
      defaultPhase: form.defaultPhase,
      autoGenerateTag: form.autoGenerateTag,
      requireEquipment: form.requireEquipment,
      requireLocation: form.requireLocation,
      requireIsolationPoint: form.requireIsolationPoint,
      tagColor: form.tagColor,
      tagWidth: form.tagWidth,
      tagHeight: form.tagHeight,
      tagFontSize: form.tagFontSize,
      tagFontColor: form.tagFontColor,
      tagTheme: form.tagTheme,
      tagShowLogo: form.tagShowLogo,
      tagShowQR: form.tagShowQR,
      tagHoleEnabled: form.tagHoleEnabled,
      tagHolePosition: form.tagHolePosition,
    });
  };

  return (
    <div className="space-y-6">
      {/* Live Tag Preview */}
      <Card className="sbts-card border-cyan-200 bg-gradient-to-br from-cyan-50/50 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-extrabold text-slate-950">Live Tag Preview</CardTitle>
          <CardDescription className="text-xs text-slate-500">Changes reflect in real-time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div
              className="relative rounded-2xl border-2 shadow-lg flex flex-col items-center justify-between p-4"
              style={{
                width: `${form.tagWidth}mm`,
                height: `${form.tagHeight}mm`,
                borderColor: form.tagColor,
                minWidth: "200px",
                minHeight: "140px",
                maxWidth: "340px",
              }}
            >
              {form.tagHoleEnabled && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 border-slate-400 bg-white" />
              )}
              <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] mt-3" style={{ color: form.tagColor }}>
                SBTS BLIND TAG
              </div>
              <div className="font-mono text-2xl font-extrabold tracking-wide" style={{ color: form.tagFontColor, fontSize: `${form.tagFontSize}px` }}>
                {previewTag}
              </div>
              {form.tagShowQR && (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
                  <span className="text-[9px] font-bold text-slate-400">QR</span>
                </div>
              )}
              {form.tagShowLogo && (
                <div className="text-[8px] font-bold text-slate-400 mt-1">LOGO</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tag Format */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-extrabold text-slate-950">Tag Format</CardTitle>
              <CardDescription className="text-xs text-slate-500">Configure how blind tags are auto-generated</CardDescription>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wide text-cyan-600">Preview</div>
              <div className="font-mono text-lg font-extrabold text-cyan-800">{previewTag}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Prefix</Label>
              <Input value={form.tagPrefix} onChange={e => setForm(f => f && ({ ...f, tagPrefix: e.target.value }))} maxLength={10} className="sbts-input font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Separator</Label>
              <Input value={form.tagSeparator} onChange={e => setForm(f => f && ({ ...f, tagSeparator: e.target.value }))} maxLength={3} className="sbts-input font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Padding Digits</Label>
              <Input type="number" min={1} max={6} value={form.tagPaddingDigits} onChange={e => setForm(f => f && ({ ...f, tagPaddingDigits: parseInt(e.target.value) || 3 }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Start Number</Label>
              <Input type="number" min={1} value={form.tagStartNumber} onChange={e => setForm(f => f && ({ ...f, tagStartNumber: parseInt(e.target.value) || 1 }))} className="sbts-input" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Auto-Generate Tag</div>
              <div className="text-xs text-slate-500">Automatically generate tag number when adding new blinds</div>
            </div>
            <Switch checked={form.autoGenerateTag} onCheckedChange={v => setForm(f => f && ({ ...f, autoGenerateTag: v }))} />
          </div>
        </CardContent>
      </Card>

      {/* Tag Visual Settings */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-cyan-700" />
            <div>
              <CardTitle className="text-base font-extrabold text-slate-950">Tag Visual Settings</CardTitle>
              <CardDescription className="text-xs text-slate-500">Colors, dimensions, and display options</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Border Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.tagColor} onChange={e => setForm(f => f && ({ ...f, tagColor: e.target.value }))} className="h-9 w-12 cursor-pointer rounded-lg border" />
                <Input value={form.tagColor} onChange={e => setForm(f => f && ({ ...f, tagColor: e.target.value }))} className="sbts-input font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Font Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.tagFontColor} onChange={e => setForm(f => f && ({ ...f, tagFontColor: e.target.value }))} className="h-9 w-12 cursor-pointer rounded-lg border" />
                <Input value={form.tagFontColor} onChange={e => setForm(f => f && ({ ...f, tagFontColor: e.target.value }))} className="sbts-input font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Font Size (px)</Label>
              <Input type="number" min={8} max={32} value={form.tagFontSize} onChange={e => setForm(f => f && ({ ...f, tagFontSize: parseInt(e.target.value) || 14 }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Width (mm)</Label>
              <Input type="number" min={40} max={200} value={form.tagWidth} onChange={e => setForm(f => f && ({ ...f, tagWidth: parseInt(e.target.value) || 125 }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Height (mm)</Label>
              <Input type="number" min={30} max={150} value={form.tagHeight} onChange={e => setForm(f => f && ({ ...f, tagHeight: parseInt(e.target.value) || 55 }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Theme</Label>
              <Select value={form.tagTheme} onValueChange={v => setForm(f => f && ({ ...f, tagTheme: v }))}>
                <SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            {[
              { key: "tagShowLogo" as const, label: "Show Logo on Tag", desc: "Display company logo on the physical tag" },
              { key: "tagShowQR" as const, label: "Show QR Code", desc: "Include scannable QR code on the tag" },
              { key: "tagHoleEnabled" as const, label: "Hanging Hole", desc: "Add a hole marker for physical tag attachment" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">{label}</div>
                  <div className="text-xs text-slate-500">{desc}</div>
                </div>
                <Switch checked={form[key]} onCheckedChange={v => setForm(f => f && ({ ...f, [key]: v }))} />
              </div>
            ))}
            {form.tagHoleEnabled && (
              <div className="ml-4 space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Hole Position</Label>
                <Select value={form.tagHolePosition} onValueChange={v => setForm(f => f && ({ ...f, tagHolePosition: v }))}>
                  <SelectTrigger className="sbts-input w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-center">Top Center</SelectItem>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Default Blind Values */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Default Blind Values</CardTitle>
          <CardDescription className="text-xs text-slate-500">Pre-filled values when registering new blinds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Default Type</Label>
              <Select value={form.defaultType} onValueChange={v => setForm(f => f && ({ ...f, defaultType: v }))}>
                <SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Spectacle Blind">Spectacle Blind</SelectItem>
                  <SelectItem value="Slip Blind">Slip Blind</SelectItem>
                  <SelectItem value="Drop Spool">Drop Spool</SelectItem>
                  <SelectItem value="Isolation">Isolation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Default Size</Label>
              <Input value={form.defaultSize} onChange={e => setForm(f => f && ({ ...f, defaultSize: e.target.value }))} placeholder='e.g. 2"' className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Default Rate</Label>
              <Input value={form.defaultRate} onChange={e => setForm(f => f && ({ ...f, defaultRate: e.target.value }))} placeholder="e.g. 150#" className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Default Priority</Label>
              <Select value={form.defaultPriority} onValueChange={v => setForm(f => f && ({ ...f, defaultPriority: v as typeof form.defaultPriority }))}>
                <SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Required Fields */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Required Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "requireEquipment" as const, label: "Equipment / Line Number", desc: "Require equipment or line number" },
            { key: "requireLocation" as const, label: "Location", desc: "Require physical location" },
            { key: "requireIsolationPoint" as const, label: "Isolation Point", desc: "Require isolation point" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-slate-900">{label}</div>
                <div className="text-xs text-slate-500">{desc}</div>
              </div>
              <Switch checked={form[key]} onCheckedChange={v => setForm(f => f && ({ ...f, [key]: v }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 rounded-2xl bg-slate-950 px-6 font-bold text-white hover:bg-slate-800">
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? "Saving..." : "Save Tag Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── Certificate Settings Tab ─────────────────────────────────────────────────

function CertificateSettingsTab() {
  const { data, isLoading, refetch } = trpc.settings.certificate.get.useQuery();
  const updateMutation = trpc.settings.certificate.update.useMutation({
    onSuccess: () => { toast.success("Certificate settings saved."); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const uploadLogoMutation = trpc.settings.certificate.uploadLogo.useMutation({
    onSuccess: ({ url }) => { setForm(f => f ? { ...f, logoUrl: url } : f); toast.success("Logo uploaded."); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const removeLogoMutation = trpc.settings.certificate.removeLogo.useMutation({
    onSuccess: () => { setForm(f => f ? { ...f, logoUrl: "" } : f); toast.success("Logo removed."); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.type)) { toast.error("Use PNG, JPG, SVG, or WebP."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("File must be under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadLogoMutation.mutate({ base64, mimeType: file.type as "image/png", fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: DragEvent) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFileSelect(file); };

  const [form, setForm] = useState<{
    certificateTitle: string; headerCompanyName: string; headerSubtitle: string; logoUrl: string;
    signature1Label: string; signature1Name: string; signature1Title: string;
    signature2Label: string; signature2Name: string; signature2Title: string;
    signature3Label: string; signature3Name: string; signature3Title: string;
    footerText: string; showPageNumbers: boolean; showGenerationDate: boolean; showSystemVersion: boolean;
    paperSize: "A4" | "A3" | "Letter" | "Legal"; orientation: "portrait" | "landscape";
    showWorkflowLog: boolean; showExecutionTorque: boolean; showFinalApprovals: boolean;
    showBlindInfo: boolean; showProjectInfo: boolean; showQrCode: boolean;
    showLockStatus: boolean; showAreaInfo: boolean;
    statusBadgeText: string; lockBadgeText: string;
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      certificateTitle: data.certificateTitle,
      headerCompanyName: data.headerCompanyName,
      headerSubtitle: data.headerSubtitle,
      logoUrl: data.logoUrl ?? "",
      signature1Label: data.signature1Label,
      signature1Name: data.signature1Name ?? "",
      signature1Title: data.signature1Title ?? "",
      signature2Label: data.signature2Label,
      signature2Name: data.signature2Name ?? "",
      signature2Title: data.signature2Title ?? "",
      signature3Label: data.signature3Label,
      signature3Name: data.signature3Name ?? "",
      signature3Title: data.signature3Title ?? "",
      footerText: data.footerText ?? "",
      showPageNumbers: data.showPageNumbers === 1,
      showGenerationDate: data.showGenerationDate === 1,
      showSystemVersion: data.showSystemVersion === 1,
      paperSize: (data.paperSize as "A4" | "A3" | "Letter" | "Legal") ?? "A4",
      orientation: (data.orientation as "portrait" | "landscape") ?? "portrait",
      showWorkflowLog: ((data as any).showWorkflowLog ?? 1) === 1,
      showExecutionTorque: ((data as any).showExecutionTorque ?? 1) === 1,
      showFinalApprovals: ((data as any).showFinalApprovals ?? 1) === 1,
      showBlindInfo: ((data as any).showBlindInfo ?? 1) === 1,
      showProjectInfo: ((data as any).showProjectInfo ?? 1) === 1,
      showQrCode: ((data as any).showQrCode ?? 1) === 1,
      showLockStatus: ((data as any).showLockStatus ?? 1) === 1,
      showAreaInfo: ((data as any).showAreaInfo ?? 1) === 1,
      statusBadgeText: (data as any).statusBadgeText ?? "APPROVED",
      lockBadgeText: (data as any).lockBadgeText ?? "LOCKED / FINAL",
    });
  
  }, [data]);

  if (isLoading || !form) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  }

  const handleSave = () => {
    updateMutation.mutate({
      certificateTitle: form.certificateTitle,
      headerCompanyName: form.headerCompanyName,
      headerSubtitle: form.headerSubtitle,
      logoUrl: form.logoUrl || null,
      signature1Label: form.signature1Label,
      signature1Name: form.signature1Name || null,
      signature1Title: form.signature1Title || null,
      signature2Label: form.signature2Label,
      signature2Name: form.signature2Name || null,
      signature2Title: form.signature2Title || null,
      signature3Label: form.signature3Label,
      signature3Name: form.signature3Name || null,
      signature3Title: form.signature3Title || null,
      footerText: form.footerText || null,
      showPageNumbers: form.showPageNumbers,
      showGenerationDate: form.showGenerationDate,
      showSystemVersion: form.showSystemVersion,
      paperSize: form.paperSize,
      orientation: form.orientation,
      showWorkflowLog: form.showWorkflowLog,
      showExecutionTorque: form.showExecutionTorque,
      showFinalApprovals: form.showFinalApprovals,
      showBlindInfo: form.showBlindInfo,
      showProjectInfo: form.showProjectInfo,
      showQrCode: form.showQrCode,
      showLockStatus: form.showLockStatus,
      showAreaInfo: form.showAreaInfo,
      statusBadgeText: form.statusBadgeText,
      lockBadgeText: form.lockBadgeText,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Certificate Header</CardTitle>
          <CardDescription className="text-xs text-slate-500">Title and branding shown at the top of printed certificates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Certificate Title</Label>
              <Input value={form.certificateTitle} onChange={e => setForm(f => f && ({ ...f, certificateTitle: e.target.value }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Company Name on Certificate</Label>
              <Input value={form.headerCompanyName} onChange={e => setForm(f => f && ({ ...f, headerCompanyName: e.target.value }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Subtitle</Label>
              <Input value={form.headerSubtitle} onChange={e => setForm(f => f && ({ ...f, headerSubtitle: e.target.value }))} className="sbts-input" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Company Logo</Label>
              {form.logoUrl && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <img src={form.logoUrl} alt="Logo" className="max-h-14 max-w-[88px] rounded-lg border object-contain" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeLogoMutation.mutate()} disabled={removeLogoMutation.isPending} className="text-red-500 hover:bg-red-50">
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              )}
              <div
                className={`relative rounded-xl border-2 border-dashed transition-colors ${isDragging ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
                <div className="flex flex-col items-center gap-2 py-5 text-center">
                  <Upload className="h-5 w-5 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-700">{form.logoUrl ? "Replace logo" : "Upload logo"}</p>
                  <p className="text-xs text-slate-400">PNG, JPG, SVG, WebP · max 2MB</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Visibility */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Certificate Sections</CardTitle>
          <CardDescription className="text-xs text-slate-500">Show or hide sections on the printed certificate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "showBlindInfo" as const, label: "Blind Information", desc: "Area, project, type, size, phase details" },
            { key: "showProjectInfo" as const, label: "Project Information", desc: "Project name and metadata" },
            { key: "showAreaInfo" as const, label: "Area Information", desc: "Area code and name" },
            { key: "showWorkflowLog" as const, label: "Workflow Log", desc: "Phase transition history table" },
            { key: "showExecutionTorque" as const, label: "Execution / Torque", desc: "Torque values and technician info" },
            { key: "showFinalApprovals" as const, label: "Final Approvals", desc: "Approval signatures and dates" },
            { key: "showQrCode" as const, label: "QR Code", desc: "Scannable QR code with certificate data" },
            { key: "showLockStatus" as const, label: "Lock Status Badge", desc: "LOCKED / FINAL indicator" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3">
                {form[key] ? <Eye className="h-4 w-4 text-emerald-500" /> : <EyeOff className="h-4 w-4 text-slate-300" />}
                <div>
                  <div className="text-sm font-bold text-slate-900">{label}</div>
                  <div className="text-xs text-slate-500">{desc}</div>
                </div>
              </div>
              <Switch checked={form[key]} onCheckedChange={v => setForm(f => f && ({ ...f, [key]: v }))} />
            </div>
          ))}
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Status Badge Text</Label>
              <Input value={form.statusBadgeText} onChange={e => setForm(f => f && ({ ...f, statusBadgeText: e.target.value }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Lock Badge Text</Label>
              <Input value={form.lockBadgeText} onChange={e => setForm(f => f && ({ ...f, lockBadgeText: e.target.value }))} className="sbts-input" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signatures */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Signature Fields</CardTitle>
          <CardDescription className="text-xs text-slate-500">Up to three signature blocks on certificates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {([1, 2, 3] as const).map((num) => {
            const labelKey = `signature${num}Label` as "signature1Label" | "signature2Label" | "signature3Label";
            const nameKey = `signature${num}Name` as "signature1Name" | "signature2Name" | "signature3Name";
            const titleKey = `signature${num}Title` as "signature1Title" | "signature2Title" | "signature3Title";
            return (
              <div key={num} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Signature {num}</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Label</Label>
                    <Input value={form[labelKey]} onChange={e => setForm(f => f && ({ ...f, [labelKey]: e.target.value }))} placeholder="e.g. Prepared By" className="sbts-input bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Name</Label>
                    <Input value={form[nameKey]} onChange={e => setForm(f => f && ({ ...f, [nameKey]: e.target.value }))} placeholder="Full name" className="sbts-input bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Title / Role</Label>
                    <Input value={form[titleKey]} onChange={e => setForm(f => f && ({ ...f, [titleKey]: e.target.value }))} placeholder="Job title" className="sbts-input bg-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Print Options */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Print Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Paper Size</Label>
              <Select value={form.paperSize} onValueChange={v => setForm(f => f && ({ ...f, paperSize: v as typeof form.paperSize }))}>
                <SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
                  <SelectItem value="A3">A3 (297 x 420 mm)</SelectItem>
                  <SelectItem value="Letter">Letter (8.5 x 11 in)</SelectItem>
                  <SelectItem value="Legal">Legal (8.5 x 14 in)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Orientation</Label>
              <Select value={form.orientation} onValueChange={v => setForm(f => f && ({ ...f, orientation: v as typeof form.orientation }))}>
                <SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Footer Text</Label>
              <Textarea value={form.footerText} onChange={e => setForm(f => f && ({ ...f, footerText: e.target.value }))} rows={2} className="sbts-input resize-none" />
            </div>
          </div>
          <div className="space-y-3">
            {[
              { key: "showPageNumbers" as const, label: "Show Page Numbers" },
              { key: "showGenerationDate" as const, label: "Show Generation Date" },
              { key: "showSystemVersion" as const, label: "Show System Version" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-sm font-bold text-slate-900">{label}</div>
                <Switch checked={form[key]} onCheckedChange={v => setForm(f => f && ({ ...f, [key]: v }))} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 rounded-2xl bg-slate-950 px-6 font-bold text-white hover:bg-slate-800">
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? "Saving..." : "Save Certificate Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── Security Settings Tab ────────────────────────────────────────────────────

function SecuritySettingsTab() {
  const { data, isLoading, refetch } = trpc.settings.security.get.useQuery();
  const updateMutation = trpc.settings.security.update.useMutation({
    onSuccess: () => { toast.success("Security settings saved."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<{
    qrPublicAccess: boolean; qrRequireAuth: boolean;
    allowDeleteBlinds: boolean; allowDeleteProjects: boolean; requireDeleteConfirmation: boolean;
    auditTrailEnabled: boolean; auditRetentionDays: number;
    sessionTimeoutMinutes: number; maxLoginAttempts: number; lockoutDurationMinutes: number;
    requireStrongPassword: boolean; minPasswordLength: number;
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      qrPublicAccess: data.qrPublicAccess === 1,
      qrRequireAuth: data.qrRequireAuth === 1,
      allowDeleteBlinds: data.allowDeleteBlinds === 1,
      allowDeleteProjects: data.allowDeleteProjects === 1,
      requireDeleteConfirmation: data.requireDeleteConfirmation === 1,
      auditTrailEnabled: data.auditTrailEnabled === 1,
      auditRetentionDays: data.auditRetentionDays,
      sessionTimeoutMinutes: data.sessionTimeoutMinutes,
      maxLoginAttempts: data.maxLoginAttempts,
      lockoutDurationMinutes: data.lockoutDurationMinutes,
      requireStrongPassword: data.requireStrongPassword === 1,
      minPasswordLength: data.minPasswordLength,
    });
  
  }, [data]);

  if (isLoading || !form) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  }

  const handleSave = () => updateMutation.mutate(form);

  return (
    <div className="space-y-6">
      {/* QR Access */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">QR Code Access</CardTitle>
          <CardDescription className="text-xs text-slate-500">Control who can access blind information via QR scan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Public QR Access</div>
              <div className="text-xs text-slate-500">Allow unauthenticated users to view blind status via QR</div>
            </div>
            <Switch checked={form.qrPublicAccess} onCheckedChange={v => setForm(f => f && ({ ...f, qrPublicAccess: v }))} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Require Authentication for QR</div>
              <div className="text-xs text-slate-500">Force login before showing detailed blind data</div>
            </div>
            <Switch checked={form.qrRequireAuth} onCheckedChange={v => setForm(f => f && ({ ...f, qrRequireAuth: v }))} />
          </div>
        </CardContent>
      </Card>

      {/* Delete Policies */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Delete Policies</CardTitle>
          <CardDescription className="text-xs text-slate-500">Control destructive operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "allowDeleteBlinds" as const, label: "Allow Delete Blinds", desc: "Permit permanent deletion of blind records" },
            { key: "allowDeleteProjects" as const, label: "Allow Delete Projects", desc: "Permit permanent deletion of projects" },
            { key: "requireDeleteConfirmation" as const, label: "Require Delete Confirmation", desc: "Show confirmation dialog before any delete" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-slate-900">{label}</div>
                <div className="text-xs text-slate-500">{desc}</div>
              </div>
              <Switch checked={form[key]} onCheckedChange={v => setForm(f => f && ({ ...f, [key]: v }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Enable Audit Trail</div>
              <div className="text-xs text-slate-500">Log all user actions for compliance</div>
            </div>
            <Switch checked={form.auditTrailEnabled} onCheckedChange={v => setForm(f => f && ({ ...f, auditTrailEnabled: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Retention (days)</Label>
            <Input type="number" min={7} max={365} value={form.auditRetentionDays} onChange={e => setForm(f => f && ({ ...f, auditRetentionDays: parseInt(e.target.value) || 90 }))} className="sbts-input w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Session & Password */}
      <Card className="sbts-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold text-slate-950">Session & Password Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Session Timeout (minutes)</Label>
              <Input type="number" min={15} max={1440} value={form.sessionTimeoutMinutes} onChange={e => setForm(f => f && ({ ...f, sessionTimeoutMinutes: parseInt(e.target.value) || 480 }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Max Login Attempts</Label>
              <Input type="number" min={3} max={20} value={form.maxLoginAttempts} onChange={e => setForm(f => f && ({ ...f, maxLoginAttempts: parseInt(e.target.value) || 5 }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Lockout Duration (minutes)</Label>
              <Input type="number" min={5} max={60} value={form.lockoutDurationMinutes} onChange={e => setForm(f => f && ({ ...f, lockoutDurationMinutes: parseInt(e.target.value) || 15 }))} className="sbts-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Min Password Length</Label>
              <Input type="number" min={8} max={64} value={form.minPasswordLength} onChange={e => setForm(f => f && ({ ...f, minPasswordLength: parseInt(e.target.value) || 12 }))} className="sbts-input" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Require Strong Password</div>
              <div className="text-xs text-slate-500">Enforce uppercase, lowercase, number, and special character</div>
            </div>
            <Switch checked={form.requireStrongPassword} onCheckedChange={v => setForm(f => f && ({ ...f, requireStrongPassword: v }))} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 rounded-2xl bg-slate-950 px-6 font-bold text-white hover:bg-slate-800">
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? "Saving..." : "Save Security Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── Notification Settings Tab ────────────────────────────────────────────────

function NotificationSettingsTab() {
  const { data, isLoading, refetch } = trpc.settings.notifications.get.useQuery();
  const updateMutation = trpc.settings.notifications.update.useMutation({
    onSuccess: () => { toast.success("Notification preferences saved."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<{
    registrationRequest: boolean; registrationApproved: boolean; registrationRejected: boolean;
    blindPhaseChanged: boolean; blindPhaseApproval: boolean; blindAssigned: boolean;
    projectCreated: boolean; projectStatusChanged: boolean; phaseOwnerAssigned: boolean;
    workflowUpdated: boolean; workflowTransition: boolean; workflowGateBlocked: boolean;
    workflowApprovalRequired: boolean; safetyHoldPlaced: boolean; safetyHoldReleased: boolean;
    systemAnnouncement: boolean;
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      registrationRequest: data.registrationRequest === 1,
      registrationApproved: data.registrationApproved === 1,
      registrationRejected: data.registrationRejected === 1,
      blindPhaseChanged: data.blindPhaseChanged === 1,
      blindPhaseApproval: data.blindPhaseApproval === 1,
      blindAssigned: data.blindAssigned === 1,
      projectCreated: data.projectCreated === 1,
      projectStatusChanged: data.projectStatusChanged === 1,
      phaseOwnerAssigned: data.phaseOwnerAssigned === 1,
      workflowUpdated: data.workflowUpdated === 1,
      workflowTransition: data.workflowTransition === 1,
      workflowGateBlocked: data.workflowGateBlocked === 1,
      workflowApprovalRequired: data.workflowApprovalRequired === 1,
      safetyHoldPlaced: data.safetyHoldPlaced === 1,
      safetyHoldReleased: data.safetyHoldReleased === 1,
      systemAnnouncement: data.systemAnnouncement === 1,
    });
  
  }, [data]);

  if (isLoading || !form) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  }

  const handleSave = () => updateMutation.mutate(form);

  const categories = [
    { title: "Registration Events", items: [
      { key: "registrationRequest" as const, label: "New Registration Request", desc: "When a new user submits registration" },
      { key: "registrationApproved" as const, label: "Registration Approved", desc: "When admin approves a user" },
      { key: "registrationRejected" as const, label: "Registration Rejected", desc: "When admin rejects a user" },
    ]},
    { title: "Blind & Phase Events", items: [
      { key: "blindPhaseChanged" as const, label: "Phase Changed", desc: "When a blind moves to a new phase" },
      { key: "blindPhaseApproval" as const, label: "Phase Approval", desc: "When electronic approval is submitted" },
      { key: "blindAssigned" as const, label: "Blind Assigned", desc: "When a blind is assigned to a user" },
    ]},
    { title: "Project Events", items: [
      { key: "projectCreated" as const, label: "Project Created", desc: "When a new project is created" },
      { key: "projectStatusChanged" as const, label: "Project Status Changed", desc: "When project status is updated" },
      { key: "phaseOwnerAssigned" as const, label: "Phase Owner Assigned", desc: "When user is assigned as phase owner" },
    ]},
    { title: "System Events", items: [
      { key: "workflowUpdated" as const, label: "Workflow Updated", desc: "When workflow template is modified" },
      { key: "systemAnnouncement" as const, label: "System Announcement", desc: "General system announcements" },
    ]},
    { title: "Canonical Workflow & Safety", items: [
      { key: "workflowTransition" as const, label: "Workflow Transition", desc: "When a Blind completes a canonical phase and moves to the next owner" },
      { key: "workflowGateBlocked" as const, label: "Gate Blocked", desc: "When server validation rejects a phase action" },
      { key: "workflowApprovalRequired" as const, label: "Approval Required", desc: "When the next final-approval role must act" },
      { key: "safetyHoldPlaced" as const, label: "Safety Hold Placed", desc: "When Stop Work freezes a Blind and its Isolation Package" },
      { key: "safetyHoldReleased" as const, label: "Safety Hold Released", desc: "When corrective action is independently accepted" },
    ]},
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> These settings control which operational events generate in-app notifications. Email and Teams integrations can be attached later.
        </p>
      </div>

      {categories.map(({ title, items }) => (
        <Card key={title} className="sbts-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-extrabold text-slate-950">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">{label}</div>
                  <div className="text-xs text-slate-500">{desc}</div>
                </div>
                <Switch checked={form[key]} onCheckedChange={v => setForm(f => f && ({ ...f, [key]: v }))} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 rounded-2xl bg-slate-950 px-6 font-bold text-white hover:bg-slate-800">
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? "Saving..." : "Save Notification Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Workflow & Safety Policy Tab ─────────────────────────────────────────────
function WorkflowSafetySettingsTab() {
  const { data, isLoading, refetch } = trpc.settings.workflowPolicy.get.useQuery();
  const { data: workflows } = trpc.workflow.list.useQuery();
  const { data: accessModel } = trpc.accessControl.model.useQuery();
  const updateMutation = trpc.settings.workflowPolicy.update.useMutation({
    onSuccess: () => { toast.success("Workflow and safety policies saved."); refetch(); },
    onError: (error) => toast.error(error.message),
  });

  type PolicyForm = {
    activeWorkflowTemplateId: string;
    enforceServerGates: boolean;
    requireIndependentVerifier: boolean;
    requirePtwActive: boolean;
    requireLotoActive: boolean;
    requireGasTestForEntry: boolean;
    requireGasTestForDeBlinding: boolean;
    defaultGasTestValidityMinutes: number;
    gasTestExpiryWarningMinutes: number;
    safetyHoldEnabled: boolean;
    holdReleaseRequiresIndependentApproval: boolean;
    metalForemanRequiredForSlipBlind: boolean;
    operationsForemanFinalApprover: boolean;
    certificateRequiresLeakTest: boolean;
    allowPhaseReopen: boolean;
    phaseReopenRequiresApproval: boolean;
    showBlockingReasons: boolean;
    enableFieldMode: boolean;
    requireIsolationPackageForEntry: boolean;
    requireLineBreakingPermit: boolean;
    requireGasTestForLineBreaking: boolean;
    requireTorqueCalibration: boolean;
    requireInstallationTorque: boolean;
    requireReinstatementTorque: boolean;
    requireSequentialFinalApprovals: boolean;
    requireLotoReleasedForCloseout: boolean;
    blockTransitionWhenPermitExpired: boolean;
    allowAdminWorkflowOverride: boolean;
    showGateReadinessPanel: boolean;
    showLegacyPhaseReference: boolean;
    workflowUiDensity: "comfortable" | "compact";
    safetyBannerMode: "prominent" | "standard" | "compact";
    authorizedGasTesterRoleKey: string;
    gasTestRequiresInstrumentCalibration: boolean;
    gasTestLimitsConfigured: boolean;
    gasTestOxygenMinPercent: number | null;
    gasTestOxygenMaxPercent: number | null;
    gasTestMaxLelPercent: number | null;
    gasTestMaxH2sPpm: number | null;
    gasTestMaxCoPpm: number | null;
    entryReadinessValidityMinutes: number;
    isolationPackageIdPrefix: string;
    preventBlindInMultipleActivePackages: boolean;
    requireEvidenceBeforePhaseSubmit: boolean;
    evidenceMaxFileSizeMb: number;
    evidenceAllowedMimeTypesJson: string;
    defaultTorqueUnit: "N·m" | "ft·lbf";
    defaultPumpPressureUnit: "psi" | "bar";
    fieldRecordEditorMode: "dialog" | "inline";
    certificateNumberPrefix: string;
    certificateVerificationEnabled: boolean;
    certificateRequireClosedWorkflow: boolean;
    certificateReissueRequiresReason: boolean;
    certificateAllowRevocation: boolean;
    certificatePublicBaseUrl: string | null;
    defectNumberPrefix: string;
    punchNumberPrefix: string;
    ndtNumberPrefix: string;
    requireDefectDispositionBeforeClosure: boolean;
    requireMandatoryPunchClosureBeforeReadyForClosure: boolean;
    requireNdtAcceptanceBeforeReadyForClosure: boolean;
    allowPunchTransfer: boolean;
  };

  const [form, setForm] = useState<PolicyForm | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      activeWorkflowTemplateId: data.activeWorkflowTemplateId,
      enforceServerGates: data.enforceServerGates === 1,
      requireIndependentVerifier: data.requireIndependentVerifier === 1,
      requirePtwActive: data.requirePtwActive === 1,
      requireLotoActive: data.requireLotoActive === 1,
      requireGasTestForEntry: data.requireGasTestForEntry === 1,
      requireGasTestForDeBlinding: data.requireGasTestForDeBlinding === 1,
      defaultGasTestValidityMinutes: data.defaultGasTestValidityMinutes,
      gasTestExpiryWarningMinutes: data.gasTestExpiryWarningMinutes,
      safetyHoldEnabled: data.safetyHoldEnabled === 1,
      holdReleaseRequiresIndependentApproval: data.holdReleaseRequiresIndependentApproval === 1,
      metalForemanRequiredForSlipBlind: data.metalForemanRequiredForSlipBlind === 1,
      operationsForemanFinalApprover: data.operationsForemanFinalApprover === 1,
      certificateRequiresLeakTest: data.certificateRequiresLeakTest === 1,
      allowPhaseReopen: data.allowPhaseReopen === 1,
      phaseReopenRequiresApproval: data.phaseReopenRequiresApproval === 1,
      showBlockingReasons: data.showBlockingReasons === 1,
      enableFieldMode: data.enableFieldMode === 1,
      requireIsolationPackageForEntry: data.requireIsolationPackageForEntry === 1,
      requireLineBreakingPermit: data.requireLineBreakingPermit === 1,
      requireGasTestForLineBreaking: data.requireGasTestForLineBreaking === 1,
      requireTorqueCalibration: data.requireTorqueCalibration === 1,
      requireInstallationTorque: data.requireInstallationTorque === 1,
      requireReinstatementTorque: data.requireReinstatementTorque === 1,
      requireSequentialFinalApprovals: data.requireSequentialFinalApprovals === 1,
      requireLotoReleasedForCloseout: data.requireLotoReleasedForCloseout === 1,
      blockTransitionWhenPermitExpired: data.blockTransitionWhenPermitExpired === 1,
      allowAdminWorkflowOverride: data.allowAdminWorkflowOverride === 1,
      showGateReadinessPanel: data.showGateReadinessPanel === 1,
      showLegacyPhaseReference: data.showLegacyPhaseReference === 1,
      workflowUiDensity: (data.workflowUiDensity as "comfortable" | "compact") ?? "comfortable",
      safetyBannerMode: (data.safetyBannerMode as "prominent" | "standard" | "compact") ?? "prominent",
      authorizedGasTesterRoleKey: data.authorizedGasTesterRoleKey ?? "gasTester",
      gasTestRequiresInstrumentCalibration: data.gasTestRequiresInstrumentCalibration === 1,
      gasTestLimitsConfigured: data.gasTestLimitsConfigured === 1,
      gasTestOxygenMinPercent: data.gasTestOxygenMinPercent == null ? null : Number(data.gasTestOxygenMinPercent),
      gasTestOxygenMaxPercent: data.gasTestOxygenMaxPercent == null ? null : Number(data.gasTestOxygenMaxPercent),
      gasTestMaxLelPercent: data.gasTestMaxLelPercent == null ? null : Number(data.gasTestMaxLelPercent),
      gasTestMaxH2sPpm: data.gasTestMaxH2sPpm == null ? null : Number(data.gasTestMaxH2sPpm),
      gasTestMaxCoPpm: data.gasTestMaxCoPpm == null ? null : Number(data.gasTestMaxCoPpm),
      entryReadinessValidityMinutes: data.entryReadinessValidityMinutes ?? 720,
      isolationPackageIdPrefix: data.isolationPackageIdPrefix ?? "VIP",
      preventBlindInMultipleActivePackages: data.preventBlindInMultipleActivePackages === 1,
      requireEvidenceBeforePhaseSubmit: data.requireEvidenceBeforePhaseSubmit === 1,
      evidenceMaxFileSizeMb: data.evidenceMaxFileSizeMb ?? 10,
      evidenceAllowedMimeTypesJson: data.evidenceAllowedMimeTypesJson ?? '["image/jpeg","image/png","image/webp","application/pdf"]',
      defaultTorqueUnit: (data.defaultTorqueUnit as "N·m" | "ft·lbf") ?? "N·m",
      defaultPumpPressureUnit: (data.defaultPumpPressureUnit as "psi" | "bar") ?? "psi",
      fieldRecordEditorMode: (data.fieldRecordEditorMode as "dialog" | "inline") ?? "dialog",
      certificateNumberPrefix: data.certificateNumberPrefix ?? "CERT",
      certificateVerificationEnabled: data.certificateVerificationEnabled === 1,
      certificateRequireClosedWorkflow: data.certificateRequireClosedWorkflow === 1,
      certificateReissueRequiresReason: data.certificateReissueRequiresReason === 1,
      certificateAllowRevocation: data.certificateAllowRevocation === 1,
      certificatePublicBaseUrl: data.certificatePublicBaseUrl ?? null,
      defectNumberPrefix: data.defectNumberPrefix ?? "DEF",
      punchNumberPrefix: data.punchNumberPrefix ?? "PCH",
      ndtNumberPrefix: data.ndtNumberPrefix ?? "NDT",
      requireDefectDispositionBeforeClosure: data.requireDefectDispositionBeforeClosure === 1,
      requireMandatoryPunchClosureBeforeReadyForClosure: data.requireMandatoryPunchClosureBeforeReadyForClosure === 1,
      requireNdtAcceptanceBeforeReadyForClosure: data.requireNdtAcceptanceBeforeReadyForClosure === 1,
      allowPunchTransfer: data.allowPunchTransfer === 1,
    });
  }, [data]);

  if (isLoading || !form) {
    return <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  }

  type BooleanPolicyKey = {
    [Key in keyof PolicyForm]: PolicyForm[Key] extends boolean ? Key : never
  }[keyof PolicyForm];
  const setBoolean = (key: BooleanPolicyKey, value: boolean) => setForm((current) => current ? ({ ...current, [key]: value }) : current);
  const activeWorkflow = workflows?.find((workflow) => workflow.id === form.activeWorkflowTemplateId);

  const policyRows: { key: BooleanPolicyKey; label: string; description: string; critical?: boolean }[] = [
    { key: "enforceServerGates", label: "Enforce server-side transition gates", description: "The API must reject progression when a mandatory requirement is incomplete.", critical: true },
    { key: "requireIndependentVerifier", label: "Independent mechanical verification", description: "Executing technician and independent verifier must remain separate.", critical: true },
    { key: "requirePtwActive", label: "Active PTW required", description: "Block applicable phase actions when the permit is missing or expired.", critical: true },
    { key: "requireLotoActive", label: "Active LOTO required", description: "Require verified energy isolation during controlled installation and removal.", critical: true },
    { key: "requireGasTestForEntry", label: "Gas test mandatory for entry readiness", description: "Prevent entry authorization when the atmospheric test is invalid.", critical: true },
    { key: "requireGasTestForDeBlinding", label: "Gas test mandatory before de-blinding", description: "Apply the configured gas-test rule before blind removal where required." },
    { key: "requireGasTestForLineBreaking", label: "Gas test mandatory for line breaking", description: "Require a valid line-breaking gas test before containment is opened." },
    { key: "gasTestRequiresInstrumentCalibration", label: "Calibrated gas-test instrument required", description: "Active or valid gas tests require an instrument ID and non-expired calibration.", critical: true },
    { key: "requireLineBreakingPermit", label: "Line Breaking Permit required", description: "Block installation and removal work when the line-breaking permit is missing or invalid.", critical: true },
    { key: "requireIsolationPackageForEntry", label: "Isolation Package required for entry", description: "Entry authorization must be based on all linked blind points, not a single blind.", critical: true },
    { key: "preventBlindInMultipleActivePackages", label: "One active package per blind", description: "Prevent the same blind from being linked to more than one open Isolation Package.", critical: true },
    { key: "requireTorqueCalibration", label: "Valid torque calibration required", description: "Reject torque records when the selected tool calibration is missing or expired.", critical: true },
    { key: "requireInstallationTorque", label: "Installation torque record required", description: "Require a complete installation torque record before mechanical verification." },
    { key: "requireReinstatementTorque", label: "Reinstatement torque record required", description: "Require a second torque record after blind removal or repositioning." },
    { key: "safetyHoldEnabled", label: "Safety Hold / Stop Work", description: "Allow authorized field roles to freeze progression for an unsafe condition.", critical: true },
    { key: "holdReleaseRequiresIndependentApproval", label: "Independent Safety Hold release", description: "Corrective action and a separate approval are required before release." },
    { key: "metalForemanRequiredForSlipBlind", label: "Metal Foreman approval for slip blinds", description: "Add a conditional mandatory approval for spade/slip-blind work." },
    { key: "operationsForemanFinalApprover", label: "Operations Foreman is final approver", description: "Return-to-service authorization remains the last approval in the chain.", critical: true },
    { key: "certificateRequiresLeakTest", label: "Leak test required for final certificate", description: "Prevent final certificate locking until the leak/service test passes.", critical: true },
    { key: "requireSequentialFinalApprovals", label: "Sequential final approvals", description: "Inspection, T&I, mechanical/metal foreman and Operations must approve in order." },
    { key: "requireLotoReleasedForCloseout", label: "LOTO closeout required", description: "Do not close or lock the workflow until controlled LOTO release is recorded.", critical: true },
    { key: "blockTransitionWhenPermitExpired", label: "Block expired permits", description: "The runtime engine rejects a transition when an applicable permit has expired." },
    { key: "allowAdminWorkflowOverride", label: "Allow controlled Admin override", description: "Permit documented emergency override only for administrators. Keep disabled for normal production." },
    { key: "allowPhaseReopen", label: "Allow approved phase reopening", description: "Permit controlled correction without deleting the original record." },
    { key: "phaseReopenRequiresApproval", label: "Approval required to reopen a phase", description: "Record reason, requester and approver before creating a new revision." },
    { key: "showBlockingReasons", label: "Show blocking reasons in the UI", description: "Explain exactly which requirement prevents the current action." },
    { key: "showGateReadinessPanel", label: "Show Gate Readiness panel", description: "Display live server validation results on Blind Detail." },
    { key: "showLegacyPhaseReference", label: "Show legacy phase reference", description: "Display the five-phase compatibility value during migration. Disable after cutover." },
    { key: "enableFieldMode", label: "Enable tablet/mobile field mode", description: "Use field-oriented actions, large targets and concise current-phase content." },
    { key: "requireEvidenceBeforePhaseSubmit", label: "Require evidence before phase submission", description: "Block phase submission until at least one current-phase evidence record is attached." },
  ];

  const handleSave = () => updateMutation.mutate(form);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-700"><CheckCircle2 className="h-4 w-4" /> Sprint 2 Runtime Foundation</div>
            <h3 className="mt-2 text-xl font-black text-slate-950">Canonical 8-Phase Isolation Lifecycle</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">This setting selects the database workflow template enforced by the server state machine. Legacy phases remain only as a synchronized compatibility projection during controlled migration.</p>
          </div>
          <Badge className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Database backed</Badge>
        </div>
      </div>

      <Card className="sbts-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-extrabold"><Workflow className="h-5 w-5 text-cyan-700" /> Active Workflow Template</CardTitle>
          <CardDescription>Select the workflow definition assigned to projects and enforced by the runtime transition engine.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={form.activeWorkflowTemplateId} onValueChange={(value) => setForm((current) => current ? ({ ...current, activeWorkflowTemplateId: value }) : current)}>
            <SelectTrigger className="sbts-input"><SelectValue placeholder="Select workflow" /></SelectTrigger>
            <SelectContent>{(workflows ?? []).filter((workflow) => workflow.id === "wf-sbts-standard-v2").map((workflow) => <SelectItem key={workflow.id} value={workflow.id}>{workflow.name} · v{workflow.version}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {canonicalWorkflowPhases.map((phase, index) => (
              <div key={phase.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: phase.color }}>{index + 1}</span>
                  <div><div className="text-xs font-extrabold text-slate-900">{phase.shortLabel}</div><div className="mt-1 text-[11px] text-slate-500">{phase.actionLabel}</div></div>
                </div>
              </div>
            ))}
          </div>
          {activeWorkflow && <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><strong className="text-slate-900">Selected:</strong> {activeWorkflow.description}</div>}
        </CardContent>
      </Card>

      <Card className="sbts-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-extrabold"><ShieldAlert className="h-5 w-5 text-red-600" /> Workflow Guard Policies</CardTitle>
          <CardDescription>Plant-specific controls stored in the database and enforced by the Sprint 2 server transition engine.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {policyRows.map((item) => (
            <div key={item.key} className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${item.critical ? "border-red-100 bg-red-50/40" : "border-slate-100 bg-slate-50"}`}>
              <div><div className="flex items-center gap-2 text-sm font-bold text-slate-900">{item.label}{item.critical && <Badge variant="outline" className="border-red-200 text-[10px] text-red-700">Critical</Badge>}</div><div className="mt-0.5 text-xs text-slate-500">{item.description}</div></div>
              <Switch checked={Boolean(form[item.key])} onCheckedChange={(value) => setBoolean(item.key, value)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="sbts-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base font-extrabold"><Timer className="h-5 w-5 text-amber-600" /> Gas-Test Timing</CardTitle><CardDescription>Default validity and warning windows. Site rules can be refined later by phase and service.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Default validity (minutes)</Label><Input type="number" min={5} max={1440} value={form.defaultGasTestValidityMinutes} onChange={(event) => setForm((current) => current ? ({ ...current, defaultGasTestValidityMinutes: Number(event.target.value) }) : current)} /></div>
            <div className="space-y-1.5"><Label>Expiry warning (minutes)</Label><Input type="number" min={1} max={240} value={form.gasTestExpiryWarningMinutes} onChange={(event) => setForm((current) => current ? ({ ...current, gasTestExpiryWarningMinutes: Number(event.target.value) }) : current)} /></div>
          </CardContent>
        </Card>
        <Card className="sbts-card">
          <CardHeader><CardTitle className="text-base font-extrabold">Mandatory Internal Gates</CardTitle><CardDescription>These checks remain gates, not extra user-facing phases.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {[vesselEntryReadinessGate, finalReinstatementGate].map((gate) => <div key={gate.key} className="rounded-xl border border-slate-200 p-3"><div className="text-sm font-bold text-slate-900">{gate.label}</div><div className="mt-1 text-xs text-slate-500">{gate.requirements.length} mandatory checks configured in the canonical specification.</div></div>)}
          </CardContent>
        </Card>
      </div>

      <Card className="sbts-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-extrabold"><Gauge className="h-5 w-5 text-emerald-700" /> Gas-Test Acceptance Limits</CardTitle>
          <CardDescription>Configure plant-approved atmospheric acceptance limits. The runtime does not hard-code safety thresholds and will reject active/valid tests until this configuration is approved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${form.gasTestLimitsConfigured ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}>
            <div>
              <div className="text-sm font-bold text-slate-900">Site limits reviewed and configured</div>
              <div className="text-xs text-slate-600">Enable only after Operations/Safety approve the values below.</div>
            </div>
            <Switch checked={form.gasTestLimitsConfigured} onCheckedChange={(value) => setForm((current) => current ? ({ ...current, gasTestLimitsConfigured: value }) : current)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["O₂ minimum (%)", "gasTestOxygenMinPercent"],
              ["O₂ maximum (%)", "gasTestOxygenMaxPercent"],
              ["Maximum LEL (%)", "gasTestMaxLelPercent"],
              ["Maximum H₂S (ppm)", "gasTestMaxH2sPpm"],
              ["Maximum CO (ppm)", "gasTestMaxCoPpm"],
            ].map(([label, key]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form[key as keyof Pick<PolicyForm, "gasTestOxygenMinPercent" | "gasTestOxygenMaxPercent" | "gasTestMaxLelPercent" | "gasTestMaxH2sPpm" | "gasTestMaxCoPpm">] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value === "" ? null : Number(event.target.value);
                    setForm((current) => current ? ({ ...current, [key]: value }) : current);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Oxygen minimum, oxygen maximum and maximum LEL are mandatory when limits are enabled. H₂S and CO become mandatory readings only when a maximum is configured.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="sbts-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-extrabold"><ShieldCheck className="h-5 w-5 text-teal-600" /> Authorized Gas Tester</CardTitle>
            <CardDescription>Choose the role allowed to create valid atmospheric gas-test records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Authorized role</Label>
              <Select value={form.authorizedGasTesterRoleKey} onValueChange={(value) => setForm((current) => current ? ({ ...current, authorizedGasTesterRoleKey: value }) : current)}>
                <SelectTrigger className="sbts-input"><SelectValue placeholder="Select gas tester role" /></SelectTrigger>
                <SelectContent>
                  {(accessModel?.roles ?? []).map((role) => <SelectItem key={role.key} value={role.key}>{role.name} · {role.key}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs text-teal-900">
              The selected role must also carry the <strong>workflow.record.gasTest</strong> permission. Admin retains controlled override access.
            </div>
          </CardContent>
        </Card>

        <Card className="sbts-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-extrabold"><Layers3 className="h-5 w-5 text-cyan-700" /> Isolation Package Rules</CardTitle>
            <CardDescription>Standardize package identification and entry-authorization validity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Package ID prefix</Label>
              <Input value={form.isolationPackageIdPrefix} maxLength={16} onChange={(event) => setForm((current) => current ? ({ ...current, isolationPackageIdPrefix: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }) : current)} placeholder="VIP" />
            </div>
            <div className="space-y-1.5">
              <Label>Entry readiness validity (minutes)</Label>
              <Input type="number" min={15} max={2880} value={form.entryReadinessValidityMinutes} onChange={(event) => setForm((current) => current ? ({ ...current, entryReadinessValidityMinutes: Number(event.target.value) }) : current)} />
            </div>
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              New package IDs must begin with <strong>{form.isolationPackageIdPrefix || "VIP"}-</strong>. Authorized entry readiness expires automatically after the configured period unless a shorter expiry is recorded.
            </div>
          </CardContent>
        </Card>
      </div>

      <CertificateQualitySettings form={form} setForm={setForm} />

      <InspectionActivityBuilder />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="sbts-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-extrabold"><Upload className="h-5 w-5 text-indigo-600" /> Evidence & Attachment Policy</CardTitle>
            <CardDescription>Control field evidence limits centrally. The server validates these values before storage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Maximum file size (MB)</Label><Input type="number" min={1} max={50} value={form.evidenceMaxFileSizeMb} onChange={(event) => setForm((current) => current ? ({ ...current, evidenceMaxFileSizeMb: Number(event.target.value) }) : current)} /></div>
            <div className="space-y-1.5">
              <Label>Allowed MIME types (JSON array)</Label>
              <Textarea rows={4} value={form.evidenceAllowedMimeTypesJson} onChange={(event) => setForm((current) => current ? ({ ...current, evidenceAllowedMimeTypesJson: event.target.value }) : current)} />
              <p className="text-xs text-slate-500">Example: ["image/jpeg","image/png","application/pdf"]</p>
            </div>
          </CardContent>
        </Card>
        <Card className="sbts-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-extrabold"><Wrench className="h-5 w-5 text-amber-600" /> Field Record Defaults</CardTitle>
            <CardDescription>Standard units and record editor behavior shared by Blind Detail and Isolation Package views.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Default torque unit</Label><Select value={form.defaultTorqueUnit} onValueChange={(value: "N·m" | "ft·lbf") => setForm((current) => current ? ({ ...current, defaultTorqueUnit: value }) : current)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="N·m">N·m</SelectItem><SelectItem value="ft·lbf">ft·lbf</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Default pump pressure unit</Label><Select value={form.defaultPumpPressureUnit} onValueChange={(value: "psi" | "bar") => setForm((current) => current ? ({ ...current, defaultPumpPressureUnit: value }) : current)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="psi">psi</SelectItem><SelectItem value="bar">bar</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Field record editor</Label><Select value={form.fieldRecordEditorMode} onValueChange={(value: "dialog" | "inline") => setForm((current) => current ? ({ ...current, fieldRecordEditorMode: value }) : current)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dialog">Dialog · focused field entry</SelectItem><SelectItem value="inline">Inline · future compact workflow mode</SelectItem></SelectContent></Select><p className="text-xs text-slate-500">Dialog mode is the production-supported option in Sprint 3. Inline is stored for future activation.</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="sbts-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base font-extrabold"><Palette className="h-5 w-5 text-cyan-700" /> Workflow UI & Safety Presentation</CardTitle><CardDescription>Keep workflow density and safety emphasis consistent with the active application theme.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5"><Label>Workflow UI density</Label><Select value={form.workflowUiDensity} onValueChange={(value: "comfortable" | "compact") => setForm((current) => current ? ({ ...current, workflowUiDensity: value }) : current)}><SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comfortable">Comfortable · control room / desktop</SelectItem><SelectItem value="compact">Compact · tablet / high-volume work</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Safety banner emphasis</Label><Select value={form.safetyBannerMode} onValueChange={(value: "prominent" | "standard" | "compact") => setForm((current) => current ? ({ ...current, safetyBannerMode: value }) : current)}><SelectTrigger className="sbts-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="prominent">Prominent · recommended</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="compact">Compact</SelectItem></SelectContent></Select></div>
        </CardContent>
      </Card>

      <div className="flex justify-end"><Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 rounded-2xl bg-slate-950 px-6 font-bold text-white"><Save className="h-4 w-4" />{updateMutation.isPending ? "Saving..." : "Save Workflow & Safety Policies"}</Button></div>
    </div>
  );
}

// ─── Feature Controls Tab ─────────────────────────────────────────────────────
function FeatureControlsTab() {
  const { data: toggles, isLoading, refetch } = trpc.featureToggles.get.useQuery();
  const updateMutation = trpc.featureToggles.update.useMutation({
    onSuccess: () => { toast.success("Feature settings saved."); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const features = [
    { key: "enableWorkflowTab", label: "Workflow Tab", desc: "Phase timeline, approvals, and phase transitions" },
    { key: "enableComplianceTab", label: "Compliance Tab", desc: "Safety checklists, torque records, inspections, photo evidence" },
    { key: "enableFieldActionsTab", label: "Field Actions Tab", desc: "PTW, LOTO, risk assessment, field notes" },
    { key: "enableQrMobileTab", label: "QR & Mobile Tab", desc: "QR code generation and mobile verification" },
    { key: "enableHistoryTab", label: "History Tab", desc: "Change log and audit trail" },
    { key: "enableProgressRing", label: "Progress Ring", desc: "Circular progress indicator in blind header" },
    { key: "enableQuickActions", label: "Quick Actions", desc: "Action cards in Overview tab" },
    { key: "enableBreadcrumb", label: "Breadcrumb Navigation", desc: "Show breadcrumb path above blind detail" },
    { key: "enableSafetyChecklists", label: "Safety Checklists", desc: "Phase safety checklist section in Compliance" },
    { key: "enableTorqueRecords", label: "Torque Records", desc: "Bolt-by-bolt torque verification" },
    { key: "enableInspectionRecords", label: "Inspection Records", desc: "NDE, MTR, Leak Test records" },
    { key: "enablePtw", label: "Permit to Work (PTW)", desc: "Work permit management in Field Actions" },
    { key: "enableLoto", label: "Lockout/Tagout (LOTO)", desc: "Energy isolation verification" },
    { key: "enableRiskAssessment", label: "Risk Assessment", desc: "Hazard identification and controls" },
    { key: "enableFieldNotes", label: "Field Notes", desc: "Free-text field observations" },
    { key: "enableQrGeneration", label: "QR Generation", desc: "Generate QR tokens for field access" },
    { key: "enableMobileVerification", label: "Mobile Verification", desc: "Mobile read-only verification page" },
    { key: "enablePhotoEvidence", label: "Photo Evidence", desc: "Attach photos and documents as compliance evidence" },
    { key: "enableOfflineAccess", label: "Offline Access", desc: "Allow offline data caching for field use" },
    { key: "enableSlipBlindSurveys", label: "Slip Blind Surveys", desc: "Periodic survey tracking for slip blinds" },
    { key: "enableCertificates", label: "Certificates", desc: "Generate and print blind certificates" },
    { key: "enableExpiryTracking", label: "Expiry Tracking", desc: "Track and alert on blind expiry dates" },
  ] as const;

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading feature settings...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ToggleLeft className="w-5 h-5 text-primary" /> Blind Detail Hub Features</CardTitle>
          <CardDescription>Enable or disable individual features in the Blind Detail Hub. Disabled features will be hidden from all users.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {features.map(({ key, label, desc }) => {
              const isEnabled = toggles ? (toggles as any)[key] !== 0 : true;
              return (
                <div key={key} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div>
                    <p className="font-medium text-sm text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => {
                      updateMutation.mutate({ [key]: checked ? 1 : 0 } as any);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const ActiveIcon = tabs.find(t => t.key === activeTab)?.icon ?? Settings;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="System Settings Center"
        description="Full operational control — identity, workflow safety, tags, certificates, security, and notifications"
      />

      {/* Tab Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Sidebar Tabs */}
        <div className="w-full sm:w-64 shrink-0">
          <div className="sbts-card overflow-hidden p-2">
            <div className="space-y-1">
              {tabs.map(({ key, label, icon: Icon, description }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                    activeTab === key
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${activeTab === key ? "text-cyan-300" : "text-slate-400"}`} />
                  <div>
                    <div className={`text-sm font-bold ${activeTab === key ? "text-white" : "text-slate-900"}`}>{label}</div>
                    <div className={`text-xs ${activeTab === key ? "text-slate-300" : "text-slate-500"}`}>{description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center gap-2">
            <ActiveIcon className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-bold text-slate-700">{tabs.find(t => t.key === activeTab)?.label}</span>
          </div>
          {activeTab === "general" && <GeneralSettingsTab />}
          {activeTab === "workflowSafety" && <WorkflowSafetySettingsTab />}
          {activeTab === "defaultTag" && <DefaultTagSettingsTab />}
          {activeTab === "certificate" && <CertificateSettingsTab />}
          {activeTab === "security" && <SecuritySettingsTab />}
          {activeTab === "notifications" && <NotificationSettingsTab />}
          {activeTab === "features" && <FeatureControlsTab />}
        </div>
      </div>
    </div>
  );
}
