/**
 * BlindDetailHub.tsx
 * ──────────────────
 * The central hub for a single blind — matches the visual mockup 100%.
 * 6 Tabs: Overview | Workflow | Compliance | Field Actions | QR & Mobile | History
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Award, Ban, CheckCircle2, CircleDot, ClipboardList, Clock, FileText, Gauge, History, LockKeyhole, MapPin, Layers3, PlayCircle, QrCode, RefreshCw, Settings2, Shield, ShieldAlert, Smartphone, Wrench } from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { canonicalWorkflowPhases, type CanonicalPhaseKey } from "../../../shared/workflowSpecification";
import type { WorkflowActionKey } from "../../../shared/workflowRuntime";
import { WorkflowOperationsPanel } from "@/components/workflow/WorkflowOperationsPanel";

// ─── Types ────────────────────────────────────────────────────────────────
type BlindPhase = "Broken / Preparation" | "Assembly" | "Tight & Torque" | "Final Tight" | "Inspection Ready";
const phaseOrder: BlindPhase[] = ["Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready"];

// ─── Phase & Priority Styles ──────────────────────────────────────────────
const phaseColors: Record<string, string> = {
  "Broken / Preparation": "bg-amber-500",
  "Assembly": "bg-blue-500",
  "Tight & Torque": "bg-purple-500",
  "Final Tight": "bg-indigo-500",
  "Inspection Ready": "bg-emerald-500",
};
const priorityBadge: Record<string, string> = {
  Low: "bg-slate-100 text-slate-700 border-slate-300",
  Normal: "bg-blue-50 text-blue-700 border-blue-200",
  High: "bg-amber-50 text-amber-800 border-amber-300",
  Critical: "bg-red-50 text-red-700 border-red-300",
};
const statusBadge: Record<string, string> = {
  "In Service": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  "Removed": "bg-slate-500/10 text-slate-400 border-slate-500/30",
  "Merged": "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

// ─── Progress Ring Component ──────────────────────────────────────────────
function ProgressRing({ percent }: { percent: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#progressGrad)" strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-700" />
        <defs>
          <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.75 0.18 200)" />
            <stop offset="100%" stopColor="oklch(0.7 0.2 180)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-foreground">{percent}%</span>
        <span className="text-[10px] text-muted-foreground">Complete</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function BlindDetailHub() {
  const [, params] = useRoute("/projects/:projectId/blinds/:tag");
  const [, params2] = useRoute("/areas/:areaId/projects/:projectId/blinds/:tag");
  const projectId = params?.projectId || params2?.projectId || "";
  const tag = params?.tag || params2?.tag || "";
  const [activeTab, setActiveTab] = useState("overview");

  // Feature toggles
  const { data: toggles } = trpc.featureToggles.get.useQuery();

  // Blind detail data
  const { data, isLoading, error } = trpc.projects.blindDetail.useQuery(
    { projectId, tag },
    { enabled: !!projectId && !!tag },
  );
  const runtimeQuery = trpc.workflowRuntime.state.useQuery(
    { projectId, blindTag: tag },
    { enabled: !!projectId && !!tag },
  );
  const policyQuery = trpc.settings.workflowPolicy.get.useQuery(undefined, { enabled: !!projectId && !!tag });
  const trpcUtils = trpc.useUtils();
  const checklistMutation = trpc.workflowRuntime.checklist.update.useMutation({
    onSuccess: async () => { await runtimeQuery.refetch(); },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const transitionMutation = trpc.workflowRuntime.transition.useMutation({
    onSuccess: async (result) => {
      await Promise.all([runtimeQuery.refetch(), trpcUtils.projects.blindDetail.invalidate({ projectId, tag })]);
      if (result.success) toast.success("Workflow phase completed successfully.");
      else toast.error(result.blockingReasons.map((reason) => reason.message).join(" "));
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const holdMutation = trpc.workflowRuntime.safetyHold.place.useMutation({
    onSuccess: async () => { await runtimeQuery.refetch(); toast.warning("Safety Hold placed. Workflow progression is blocked."); },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const releaseHoldMutation = trpc.workflowRuntime.safetyHold.release.useMutation({
    onSuccess: async (result) => {
      await runtimeQuery.refetch();
      if (result.pendingIndependentApproval) toast.info("Corrective action submitted. Independent Safety Hold release approval is required.");
      else toast.success("Safety Hold released and the prior lifecycle status was restored.");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  // Calculate progress
  const progress = useMemo(() => {
    if (runtimeQuery.data?.phases) {
      const completed = runtimeQuery.data.phases.filter((phase) => phase.status === "completed").length;
      return Math.round((completed / canonicalWorkflowPhases.length) * 100);
    }
    if (!data?.phaseTimeline) return 0;
    const completed = data.phaseTimeline.filter((p) => p.status === "completed").length;
    return Math.round((completed / phaseOrder.length) * 100);
  }, [data?.phaseTimeline, runtimeQuery.data?.phases]);

  // Determine blind status for badge
  const blindStatus = useMemo(() => {
    if (runtimeQuery.data?.runtime.lifecycleStatus) return runtimeQuery.data.runtime.lifecycleStatus.replaceAll("_", " ");
    if (!data?.blind) return "In Service";
    if (data.blind.slipBlindMerged) return "Merged";
    if (data.blind.phase === "Inspection Ready") return "Inspection Ready";
    return "In Service";
  }, [data?.blind, runtimeQuery.data?.runtime.lifecycleStatus]);

  // Check expiry
  const isExpiring = useMemo(() => {
    if (!data?.blind?.expiryDate) return false;
    const expiry = new Date(data.blind.expiryDate);
    const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 30 && daysLeft > 0;
  }, [data?.blind?.expiryDate]);

  if (isLoading || runtimeQuery.isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-destructive">Blind Not Found</h2>
          <p className="text-muted-foreground mt-2">Could not load blind {tag} in project {projectId}.</p>
          <Link href="/projects">
            <Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" />Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { blind, project, phaseTimeline, logs } = data;
  const runtime = runtimeQuery.data;
  const currentPhaseIndex = runtime
    ? runtime.phases.findIndex((phase) => phase.key === runtime.runtime.currentPhaseKey)
    : phaseOrder.indexOf(blind.phase as BlindPhase);
  const displayedPhases = runtime?.phases ?? phaseOrder.map((phase, index) => ({ key: phase, shortLabel: phase, status: index < currentPhaseIndex ? "completed" : index === currentPhaseIndex ? "current" : "pending", color: phaseColors[phase] }));

  return (
    <div className="min-h-screen">
      {/* ─── Breadcrumb ─────────────────────────────────────────────── */}
      {(toggles?.enableBreadcrumb !== 0) && (
        <div className="flex items-center gap-2 px-6 pt-4 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
          <span>/</span>
          <Link href={`/projects/${projectId}`} className="hover:text-foreground transition-colors">{project.name}</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{tag}</span>
        </div>
      )}

      {/* ─── Header Card ───────────────────────────────────────────── */}
      <div className="px-6 pt-3 pb-4">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Left: Tag + Status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 flex-wrap">
                <h1 className="text-3xl lg:text-4xl font-extrabold font-mono tracking-tight text-foreground">{tag}</h1>
                <Badge variant="outline" className={`${statusBadge[blindStatus] || statusBadge["In Service"]} text-xs px-3 py-1`}>
                  {blindStatus}
                </Badge>
                <Badge variant="outline" className={`${priorityBadge[blind.priority]} text-xs px-3 py-1`}>
                  {blind.priority}
                </Badge>
                {isExpiring && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs px-3 py-1 animate-pulse">
                    Expiring Soon
                  </Badge>
                )}
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</span>
                  <p className="font-semibold text-foreground text-sm">{blind.type}</p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Size</span>
                  <p className="font-semibold text-foreground text-sm">{blind.size}</p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Material</span>
                  <p className="font-semibold text-foreground text-sm">{blind.material || "—"}</p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Pressure</span>
                  <p className="font-semibold text-foreground text-sm">{blind.rate || "—"}</p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Flange</span>
                  <p className="font-semibold text-foreground text-sm">{blind.flangeType || "RF"}</p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Phase</span>
                  <p className="font-semibold text-foreground text-sm">{runtime?.currentPhase.shortLabel ?? blind.phase}</p>
                </div>
              </div>

              {/* Phase Progress Bar */}
              <div className="flex items-center gap-0.5 sm:gap-1 mt-4 overflow-x-auto pb-1" aria-label="Canonical workflow progress">
                {displayedPhases.map((phase: any, i: number) => (
                  <div key={phase.key} className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0" title={phase.shortLabel}>
                    <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all ${
                      phase.status === "completed" ? "bg-emerald-500 text-white" :
                      phase.status === "current" ? "bg-primary text-primary-foreground ring-2 sm:ring-4 ring-primary/20" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {phase.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    {i < displayedPhases.length - 1 && (
                      <div className={`h-0.5 w-4 sm:w-6 lg:w-8 ${phase.status === "completed" ? "bg-emerald-500" : "bg-muted"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Owner + Progress Ring */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-right hidden sm:block">
                <p className="font-semibold text-foreground text-sm">{blind.owner}</p>
                <p className="text-xs text-muted-foreground">Phase Owner</p>
              </div>
              {(toggles?.enableProgressRing !== 0) && <ProgressRing percent={progress} />}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 mt-4 pt-4 border-t border-border flex-wrap">
            <Button size="sm" variant="default" className="gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Print</span> Certificate
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Export PDF
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> QR Code
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────────── */}
      <div className="px-6 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start bg-card border border-border rounded-xl p-1 h-auto flex-wrap gap-1 overflow-x-auto">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2.5">
              <ClipboardList className="w-4 h-4" /> Overview
            </TabsTrigger>
            {(toggles?.enableWorkflowTab !== 0) && (
              <TabsTrigger value="workflow" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2.5">
                <Settings2 className="w-4 h-4" /> Workflow
              </TabsTrigger>
            )}
            {(toggles?.enableComplianceTab !== 0) && (
              <TabsTrigger value="compliance" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2.5">
                <Shield className="w-4 h-4" />
                Compliance
                <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />
              </TabsTrigger>
            )}
            {(toggles?.enableFieldActionsTab !== 0) && (
              <TabsTrigger value="field" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2.5">
                <Wrench className="w-4 h-4" />
                Field Actions
                <span className="w-2 h-2 rounded-full bg-amber-400 ml-1" />
              </TabsTrigger>
            )}
            {(toggles?.enableQrMobileTab !== 0) && (
              <TabsTrigger value="qr" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2.5">
                <Smartphone className="w-4 h-4" /> QR & Mobile
              </TabsTrigger>
            )}
            {(toggles?.enableHistoryTab !== 0) && (
              <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2.5">
                <History className="w-4 h-4" /> History
              </TabsTrigger>
            )}
          </TabsList>

          {/* ─── Overview Tab ────────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-6">
            {runtime && policyQuery.data?.showGateReadinessPanel !== 0 && <RuntimeReadinessBanner runtime={runtime} policy={policyQuery.data} onOpenWorkflow={() => setActiveTab("workflow")} />}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Specifications */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-4 h-4 text-primary" /> Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                    <SpecRow label="Flange Type" value={blind.flangeType} />
                    <SpecRow label="Temp Rating" value={blind.tempRating} />
                    <SpecRow label="Gasket Type" value={blind.gasketType} />
                    <SpecRow label="P&ID Ref" value={blind.pidRef} />
                    <SpecRow label="Bolt Size" value={blind.boltSize} />
                    <SpecRow label="ISO Drawing" value={blind.isoDrawing} />
                    <SpecRow label="Torque Value" value={blind.torqueValue} />
                    <SpecRow label="Install Date" value={blind.installDate ? new Date(blind.installDate).toLocaleDateString() : null} />
                    <SpecRow label="Thickness" value={blind.thickness} />
                    <SpecRow label="Expiry Date" value={blind.expiryDate ? new Date(blind.expiryDate).toLocaleDateString() : null} />
                  </div>
                </CardContent>
              </Card>

              {/* Location & Context */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="w-4 h-4 text-primary" /> Location & Context
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <SpecRow label="Area" value={blind.location} />
                    <SpecRow label="Equipment" value={blind.equipment} />
                    <SpecRow label="Line Number" value={blind.lineNumber} />
                    <SpecRow label="Isolation Point" value={blind.isolationPoint} />
                    <SpecRow label="Foreman Approved" value={blind.slipMetalForemanApproved ? "Yes" : "No"} />
                    <SpecRow label="Merged" value={blind.slipBlindMerged ? "Yes" : "No"} />
                  </div>
                  {blind.notes && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm text-foreground">{blind.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            {(toggles?.enableQuickActions !== 0) && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <QuickActionCard icon={<CircleDot className="w-5 h-5" />} title="Advance Phase" desc="Move to next workflow step" onClick={() => setActiveTab("workflow")} />
                  <QuickActionCard icon={<FileText className="w-5 h-5" />} title="Upload Evidence" desc="Attach photos or documents" onClick={() => setActiveTab("compliance")} />
                  <QuickActionCard icon={<ClipboardList className="w-5 h-5" />} title="Start Checklist" desc="Begin inspection checklist" onClick={() => setActiveTab("compliance")} />
                  <QuickActionCard icon={<QrCode className="w-5 h-5" />} title="Generate QR" desc="Create blind QR code" onClick={() => setActiveTab("qr")} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Workflow Tab ─────────────────────────────────────────── */}
          <TabsContent value="workflow" className="mt-6">
            <CanonicalWorkflowTab
              runtime={runtime}
              isLoading={runtimeQuery.isLoading}
              policy={policyQuery.data}
              onChecklistChange={(phaseKey, itemKey, completed) => checklistMutation.mutate({ projectId, blindTag: tag, phaseKey, itemKey, completed })}
              onAdvance={() => { if (!runtime) return; transitionMutation.mutate({ projectId, blindTag: tag, actionKey: runtime.currentPhase.actionKey as WorkflowActionKey, expectedRecordVersion: runtime.runtime.recordVersion }); }}
              onPlaceHold={() => {
                const description = window.prompt("Describe the unsafe condition requiring Stop Work / Safety Hold:");
                if (description?.trim()) holdMutation.mutate({ projectId, blindTag: tag, reasonCode: "FIELD_STOP_WORK", description: description.trim() });
              }}
              onReleaseHold={() => {
                if (!runtime?.activeHold) return;
                const promptLabel = runtime.activeHold.status === "release_pending"
                  ? "Review the submitted corrective action, add an independent approval note, then confirm release:"
                  : "Describe the completed corrective action before requesting Safety Hold release:";
                const correctiveAction = window.prompt(promptLabel, runtime.activeHold.correctiveAction || "");
                if (correctiveAction?.trim()) releaseHoldMutation.mutate({ projectId, blindTag: tag, holdId: runtime.activeHold.id, correctiveAction: correctiveAction.trim() });
              }}
              transitionPending={transitionMutation.isPending}
              checklistPending={checklistMutation.isPending}
              holdPending={holdMutation.isPending}
              releaseHoldPending={releaseHoldMutation.isPending}
            />
          </TabsContent>

          {/* ─── Compliance Tab ───────────────────────────────────────── */}
          <TabsContent value="compliance" className="mt-6">
            <ComplianceTab blind={blind} toggles={toggles} runtime={runtime} />
          </TabsContent>

          {/* ─── Field Actions Tab ────────────────────────────────────── */}
          <TabsContent value="field" className="mt-6">
            <FieldActionsTab projectId={projectId} blindTag={tag} toggles={toggles} runtime={runtime} policy={policyQuery.data} onRefresh={() => runtimeQuery.refetch()} />
          </TabsContent>

          {/* ─── QR & Mobile Tab ──────────────────────────────────────── */}
          <TabsContent value="qr" className="mt-6">
            <QrMobileTab blind={blind} toggles={toggles} />
          </TabsContent>

          {/* ─── History Tab ──────────────────────────────────────────── */}
          <TabsContent value="history" className="mt-6">
            <HistoryTab logs={logs} blind={blind} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Sub-Components ───────────────────────────────────────────────────────

function RuntimeReadinessBanner({ runtime, policy, onOpenWorkflow }: { runtime: any; policy: any; onOpenWorkflow?: () => void }) {
  const hold = runtime.activeHold;
  const ready = runtime.gateReadiness.ready;
  const prominent = policy?.safetyBannerMode !== "compact";
  return (
    <div className={`rounded-2xl border p-4 ${hold ? "border-red-300 bg-red-50" : ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2 ${hold ? "bg-red-100 text-red-700" : ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {hold ? <Ban className="h-5 w-5" /> : ready ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div>
            <div className="font-extrabold text-foreground">{hold ? "SAFETY HOLD — Workflow Frozen" : ready ? "Current phase is ready for submission" : "Action required before phase advancement"}</div>
            {prominent && <div className="mt-1 text-sm text-muted-foreground">{hold ? hold.description : ready ? `${runtime.currentPhase.actionLabel} can be completed by the authorized role.` : `${runtime.gateReadiness.blockingReasons.length} server gate requirement(s) remain incomplete.`}</div>}
          </div>
        </div>
        {onOpenWorkflow && <Button variant={hold ? "destructive" : "outline"} onClick={onOpenWorkflow} className="gap-2"><ShieldAlert className="h-4 w-4" /> Open Workflow Control</Button>}
      </div>
    </div>
  );
}

function CanonicalWorkflowTab({ runtime, isLoading, policy, onChecklistChange, onAdvance, onPlaceHold, onReleaseHold, transitionPending, checklistPending, holdPending, releaseHoldPending }: {
  runtime: any;
  isLoading: boolean;
  policy: any;
  onChecklistChange: (phaseKey: CanonicalPhaseKey, itemKey: string, completed: boolean) => void;
  onAdvance: () => void;
  onPlaceHold: () => void;
  onReleaseHold: () => void;
  transitionPending: boolean;
  checklistPending: boolean;
  holdPending: boolean;
  releaseHoldPending: boolean;
}) {
  if (isLoading || !runtime) return <div className="space-y-4"><Skeleton className="h-36 w-full" /><Skeleton className="h-80 w-full" /></div>;
  const compact = policy?.workflowUiDensity === "compact";
  return (
    <div className="space-y-6">
      {policy?.showGateReadinessPanel !== 0 && <RuntimeReadinessBanner runtime={runtime} policy={policy} />}
      <Card className="border-border overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Canonical 8-Phase Runtime · v{runtime.runtime.workflowVersion}</div><CardTitle className="mt-1 text-xl">{runtime.currentPhase.label}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{runtime.currentPhase.purpose}</p></div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Record v{runtime.runtime.recordVersion}</Badge><Badge className="bg-primary/10 text-primary border-primary/20">{runtime.runtime.lifecycleStatus.replaceAll("_", " ")}</Badge>{policy?.showLegacyPhaseReference === 1 && <Badge variant="outline" className="border-slate-300 text-slate-600">Legacy: {runtime.runtime.legacyPhase}</Badge>}{runtime.runtime.isLocked && <Badge variant="outline" className="gap-1 border-slate-300"><LockKeyhole className="h-3 w-3" /> Locked</Badge>}</div>
          </div>
        </CardHeader>
        <CardContent className={compact ? "p-4" : "p-6"}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {runtime.phases.map((phase: any, index: number) => <div key={phase.key} className={`rounded-xl border p-3 ${phase.status === "current" ? "border-primary bg-primary/5" : phase.status === "completed" ? "border-emerald-200 bg-emerald-50/60" : "border-border bg-card"}`}><div className="flex items-start gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: phase.color }}>{phase.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</div><div><div className="text-xs font-bold text-foreground">{phase.shortLabel}</div><div className="mt-1 text-[11px] capitalize text-muted-foreground">{phase.status.replaceAll("_", " ")}</div></div></div></div>)}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <Card className="border-border">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-primary" /> Current Phase Checklist</CardTitle><p className="text-sm text-muted-foreground">Mandatory items are saved directly to the phase instance and re-evaluated by the server gate.</p></CardHeader>
          <CardContent className="space-y-2">
            {runtime.checklist.map((item: any) => <label key={item.itemKey} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${item.completed ? "border-emerald-200 bg-emerald-50/60" : "border-border hover:border-primary/40"}`}><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-600" checked={item.completed} disabled={checklistPending || runtime.runtime.isLocked || !runtime.permissions.canExecuteCurrentAction} onChange={(event) => onChecklistChange(runtime.runtime.currentPhaseKey, item.itemKey, event.target.checked)} /><div className="flex-1"><div className="text-sm font-medium text-foreground">{item.itemLabel}</div>{item.completedAt && <div className="mt-1 text-[11px] text-muted-foreground">Completed {new Date(item.completedAt).toLocaleString()}</div>}</div>{item.required && <Badge variant="outline" className="text-[10px]">Required</Badge>}</label>)}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-amber-600" /> Gate Readiness</CardTitle></CardHeader><CardContent>{runtime.gateReadiness.ready ? <div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">All current server-side gates passed.</div> : <div className="space-y-2">{runtime.gateReadiness.blockingReasons.map((reason: any, index: number) => <div key={`${reason.code}-${index}`} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><div className="text-xs font-bold text-amber-900">{reason.code.replaceAll("_", " ")}</div><div className="mt-0.5 text-xs text-amber-800">{reason.message}</div></div></div>)}</div>}</CardContent></Card>
          <Card className="border-border"><CardHeader><CardTitle className="text-base">Controlled Actions</CardTitle></CardHeader><CardContent className="space-y-3"><Button className="w-full gap-2" disabled={!runtime.gateReadiness.ready || !runtime.permissions.canExecuteCurrentAction || runtime.runtime.isLocked || transitionPending || Boolean(runtime.activeHold)} onClick={onAdvance}><PlayCircle className="h-4 w-4" />{transitionPending ? "Submitting..." : runtime.currentPhase.actionLabel}</Button><Button variant="destructive" className="w-full gap-2" disabled={!runtime.permissions.canPlaceHold || holdPending || Boolean(runtime.activeHold)} onClick={onPlaceHold}><Ban className="h-4 w-4" />{holdPending ? "Placing Hold..." : "Stop Work / Safety Hold"}</Button>{runtime.activeHold && <div className="rounded-xl border border-red-200 bg-red-50 p-3"><div className="text-xs font-bold text-red-900">{runtime.activeHold.status === "release_pending" ? "Independent release approval pending" : "Safety Hold active"}</div><div className="mt-1 text-xs text-red-800">{runtime.activeHold.correctiveAction || runtime.activeHold.description}</div>{runtime.activeHold.releaseRequestedAt && <div className="mt-1 text-[11px] text-red-700">Release requested {new Date(runtime.activeHold.releaseRequestedAt).toLocaleString()}</div>}<Button variant="outline" className="mt-3 w-full gap-2 border-red-300 bg-white text-red-800 hover:bg-red-100" disabled={!runtime.permissions.canReleaseHold || releaseHoldPending} onClick={onReleaseHold}><ShieldAlert className="h-4 w-4" />{releaseHoldPending ? "Processing..." : runtime.activeHold.status === "release_pending" ? "Approve Independent Hold Release" : "Submit Corrective Action for Release"}</Button>{!runtime.permissions.canReleaseHold && <p className="mt-2 text-[11px] text-red-700">Permission workflow.safety.release is required.</p>}</div>}{!runtime.permissions.canExecuteCurrentAction && <p className="text-xs text-muted-foreground">The current user does not have the required phase permission: {runtime.currentPhase.requiredPermissionKey}</p>}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

function QuickActionCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
      <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

// ─── Workflow Tab ──────────────────────────────────────────────────────────
function WorkflowTab({ phaseTimeline, blind, projectId }: { phaseTimeline: any[]; blind: any; projectId: string }) {
  return (
    <div className="space-y-6">
      {/* Phase Timeline */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Phase Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {phaseTimeline.map((phase, i) => (
              <div key={phase.phase} className="flex items-start gap-3 sm:gap-4">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                    phase.status === "completed" ? "bg-emerald-500 text-white" :
                    phase.status === "current" ? "bg-primary text-primary-foreground ring-2 sm:ring-4 ring-primary/20" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {phase.status === "completed" ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : i + 1}
                  </div>
                  {i < phaseTimeline.length - 1 && (
                    <div className={`w-0.5 h-6 sm:h-8 mt-1 ${phase.status === "completed" ? "bg-emerald-500" : "bg-muted"}`} />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-foreground">{phase.phase}</h4>
                    <Badge variant="outline" className={`text-[10px] ${
                      phase.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      phase.status === "current" ? "bg-primary/10 text-primary border-primary/30" :
                      "bg-muted text-muted-foreground border-border"
                    }`}>
                      {phase.status === "completed" ? "Completed" : phase.status === "current" ? "In Progress" : "Waiting"}
                    </Badge>
                  </div>
                  {phase.approval && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {phase.approval.approved ? (
                        <span className="text-emerald-600">Approved by {phase.approval.approvedByName || "—"}</span>
                      ) : phase.status === "current" ? (
                        <span className="text-amber-600">Awaiting approval</span>
                      ) : null}
                    </div>
                  )}
                  {phase.owners && phase.owners.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Owner: {phase.owners.map((o: any) => o.name || o.email).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Phase Actions */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CircleDot className="w-4 h-4 text-primary" /> Current Phase: {blind.phase}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This blind is currently in the <strong>{blind.phase}</strong> phase. Complete all required checks and approvals to advance to the next phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Compliance Tab ───────────────────────────────────────────────────────
function recordStatusClass(status: string) {
  if (["valid", "active", "accepted", "passed", "authorized", "approved"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["expired", "failed", "rejected", "cancelled"].includes(status)) return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

function dateLabel(value: string | Date | null | undefined) {
  return value ? new Date(value).toLocaleString() : "—";
}

function ComplianceTab({ blind, toggles, runtime }: { blind: any; toggles: any; runtime: any }) {
  const records = runtime?.records;
  const completedChecklist = runtime?.checklist?.filter((item: any) => item.completed).length ?? 0;
  const totalChecklist = runtime?.checklist?.length ?? 0;
  const torqueRecords = records?.torque ?? [];
  const evidence = runtime?.evidence ?? [];
  const leakTest = records?.leakTest;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Checklist Progress" value={`${completedChecklist}/${totalChecklist}`} subtitle="Current phase items" icon={<ClipboardList className="w-5 h-5" />} />
        <MetricCard title="Torque Records" value={String(torqueRecords.length)} subtitle="Installation / reinstatement" icon={<Wrench className="w-5 h-5" />} />
        <MetricCard title="Leak Test" value={leakTest?.status?.replaceAll("_", " ") ?? "Not recorded"} subtitle={leakTest?.noLeakObserved ? "No leakage observed" : "Service test status"} icon={<Shield className="w-5 h-5" />} />
        <MetricCard title="Evidence" value={String(evidence.length)} subtitle="Current phase attachments" icon={<FileText className="w-5 h-5" />} />
      </div>

      {(toggles?.enableSafetyChecklists !== 0) && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> Current Phase Checklist</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {runtime?.checklist?.length ? runtime.checklist.map((item: any) => (
              <div key={item.itemKey} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                <div className="flex items-start gap-2"><CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.completed ? "text-emerald-600" : "text-slate-300"}`} /><div><p className="text-sm font-medium text-foreground">{item.itemLabel}</p>{item.completedAt && <p className="mt-1 text-xs text-muted-foreground">{dateLabel(item.completedAt)}</p>}</div></div>
                <Badge variant="outline" className={item.completed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}>{item.completed ? "Complete" : "Pending"}</Badge>
              </div>
            )) : <p className="py-6 text-center text-sm text-muted-foreground">No checklist instance is available.</p>}
          </CardContent>
        </Card>
      )}

      {(toggles?.enableTorqueRecords !== 0) && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" /> Torque Records</CardTitle></CardHeader>
          <CardContent>
            {torqueRecords.length ? <div className="grid gap-3 md:grid-cols-2">{torqueRecords.map((record: any) => (
              <div key={record.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3"><div className="font-semibold capitalize text-foreground">{record.stage} torque</div><Badge variant="outline" className={recordStatusClass(record.status)}>{record.status}</Badge></div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm"><SpecRow label="Target" value={record.targetTorque ? `${record.targetTorque} ${record.torqueUnit}` : null} /><SpecRow label="Actual" value={record.actualTorque ? `${record.actualTorque} ${record.torqueUnit}` : null} /><SpecRow label="Calibration expiry" value={dateLabel(record.calibrationExpiry)} /></div>
              </div>
            ))}</div> : <p className="py-6 text-center text-sm text-muted-foreground">No torque record has been stored for this blind.</p>}
          </CardContent>
        </Card>
      )}

      {(toggles?.enablePhotoEvidence !== 0) && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Current Phase Evidence</CardTitle></CardHeader>
          <CardContent>{evidence.length ? <div className="space-y-2">{evidence.map((file: any) => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-border p-3 hover:border-primary/40"><div><p className="text-sm font-medium text-foreground">{file.fileName}</p><p className="text-xs text-muted-foreground">{file.category}</p></div><FileText className="h-4 w-4 text-primary" /></a>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">No evidence is attached to the current phase.</p>}</CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Field Actions Tab ────────────────────────────────────────────────────
function FieldActionsTab({ projectId, blindTag, toggles, runtime, policy, onRefresh }: { projectId: string; blindTag: string; toggles: any; runtime: any; policy: any; onRefresh: () => Promise<unknown> | void }) {
  if (!runtime) return <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">Workflow runtime is loading.</div>;
  return <WorkflowOperationsPanel projectId={projectId} blindTag={blindTag} runtime={runtime} policy={policy} toggles={toggles} onRefresh={onRefresh} />;
}

// ─── QR & Mobile Tab ──────────────────────────────────────────────────────
function QrMobileTab({ blind, toggles }: { blind: any; toggles: any }) {
  return (
    <div className="space-y-6">
      {(toggles?.enableQrGeneration !== 0) && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" /> QR Code Generation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-6">
              <div className="w-48 h-48 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-border">
                <QrCode className="w-20 h-20 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground mt-4">Generate a QR code for field verification</p>
              <Button className="mt-3 gap-2"><QrCode className="w-4 h-4" /> Generate QR Token</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(toggles?.enableMobileVerification !== 0) && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" /> Mobile Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Field crews can scan the QR code to access a read-only verification page showing blind status, specifications, and compliance records.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
              <SpecRow label="Active Tokens" value="0" />
              <SpecRow label="Last Scanned" value="Never" />
            </div>
          </CardContent>
        </Card>
      )}

      {(toggles?.enableOfflineAccess !== 0) && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" /> Offline Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Cache blind data locally for offline field access. Syncs automatically when connectivity is restored.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
              <SpecRow label="Cache Status" value="Not Cached" />
              <SpecRow label="Last Synced" value="Never" />
            </div>
            <Button variant="outline" size="sm" className="mt-4">Cache for Offline</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────
function HistoryTab({ logs, blind }: { logs: any[]; blind: any }) {
  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-primary" /> Change Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No history records yet.</p>
          ) : (
            <div className="space-y-3">
              {[...logs].reverse().map((log, i) => (
                <div key={log.id || i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{log.action}</span>
                      <Badge variant="outline" className="text-[10px]">{log.phase}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{log.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      {log.actorName && <span>{log.actorName}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────
function MetricCard({ title, value, subtitle, icon }: { title: string; value: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
