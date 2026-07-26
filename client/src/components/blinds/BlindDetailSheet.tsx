/*
  BlindDetailSheet.tsx
  ─────────────────────────────────────────────────────────────────────────────
  Slide-in sheet that shows full details for a single Slip Blind:
    • Header: tag, project, status badges
    • Info grid: type, size, rate, phase, priority, owner, equipment, location
    • Workflow phase timeline with approval status
    • Workflow change log
    • Survey history for this specific blind
*/

import { useMemo } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  MapPin,
  Package,
  Shield,
  User,
  XCircle,
  Activity,
  Wrench,
  FileText,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlindDetailSheetProps {
  open: boolean;
  onClose: () => void;
  tag: string | null;
  projectId: string | null;
  /** Derived slip status from parent table row */
  slipStatus?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PHASE_ORDER = [
  "Broken / Preparation",
  "Assembly",
  "Tight & Torque",
  "Final Tight",
  "Inspection Ready",
];

const SLIP_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  in_service: {
    label: "In Service",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  removed: {
    label: "Removed",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <XCircle className="h-3 w-3" />,
  },
  merged: {
    label: "Merged",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Layers className="h-3 w-3" />,
  },
  unknown: {
    label: "Unknown",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

const PHASE_STATUS_CONFIG = {
  completed: { color: "bg-emerald-500", ring: "ring-emerald-200", label: "Completed" },
  current: { color: "bg-cyan-500", ring: "ring-cyan-200", label: "In Progress" },
  waiting: { color: "bg-slate-300", ring: "ring-slate-100", label: "Waiting" },
};

const CONDITION_CONFIG: Record<string, { label: string; color: string }> = {
  good: { label: "Good", color: "text-emerald-700 bg-emerald-50" },
  fair: { label: "Fair", color: "text-yellow-700 bg-yellow-50" },
  damaged: { label: "Damaged", color: "text-red-700 bg-red-50" },
  missing: { label: "Missing", color: "text-slate-700 bg-slate-100" },
};

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2">
      {icon && <span className="mt-0.5 text-slate-400 shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-800 break-words">{value ?? <span className="text-slate-400 italic">—</span>}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = SLIP_STATUS_CONFIG[status] ?? SLIP_STATUS_CONFIG.unknown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    Critical: "bg-red-100 text-red-800 border-red-200",
    High: "bg-orange-100 text-orange-800 border-orange-200",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Low: "bg-green-100 text-green-800 border-green-200",
    Normal: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${map[priority] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {priority}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BlindDetailSheet({ open, onClose, tag, projectId, slipStatus }: BlindDetailSheetProps) {
  const [, navigate] = useLocation();

  const { data, isLoading, error } = trpc.slipBlinds.blindDetail.useQuery(
    { projectId: projectId!, tag: tag! },
    {
      enabled: open && !!tag && !!projectId,
      staleTime: 30_000,
    }
  );

  const derivedSlipStatus = useMemo(() => {
    if (slipStatus) return slipStatus;
    if (!data?.blind) return "in_service";
    if (data.blind.slipBlindMerged) return "merged";
    if (data.blind.slipMetalForemanApproved) return "removed";
    return "in_service";
  }, [slipStatus, data]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col"
      >
        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          </div>
        )}

        {/* ── Error ── */}
        {error && !isLoading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500 px-8 text-center">
            <AlertTriangle className="h-10 w-10 text-red-400" />
            <p className="font-semibold">Failed to load blind details</p>
            <p className="text-sm">{error.message}</p>
          </div>
        )}

        {/* ── Not found ── */}
        {!isLoading && !error && !data && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500 px-8 text-center">
            <Package className="h-10 w-10 opacity-30" />
            <p className="font-semibold">Blind not found</p>
            <p className="text-sm">Tag: {tag}</p>
          </div>
        )}

        {/* ── Content ── */}
        {data && !isLoading && (
          <>
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-none">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                      Slip Blind
                    </span>
                  </div>
                  <SheetTitle className="text-2xl font-extrabold text-white font-mono tracking-tight">
                    {data.blind.tag}
                  </SheetTitle>
                  <p className="mt-1 text-sm text-slate-300 truncate">{data.project.name}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={derivedSlipStatus} />
                  <PriorityBadge priority={data.blind.priority} />
                </div>
              </div>

              {/* Quick stats row */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/10 px-3 py-2 text-center">
                  <p className="text-[10px] text-slate-300 uppercase tracking-wider">Phase</p>
                  <p className="text-xs font-bold text-white truncate mt-0.5">{data.blind.phase}</p>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2 text-center">
                  <p className="text-[10px] text-slate-300 uppercase tracking-wider">Type</p>
                  <p className="text-xs font-bold text-white truncate mt-0.5">{data.blind.type}</p>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2 text-center">
                  <p className="text-[10px] text-slate-300 uppercase tracking-wider">Size</p>
                  <p className="text-xs font-bold text-white truncate mt-0.5">{data.blind.size}</p>
                </div>
              </div>

              {/* Navigate to full detail */}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5"
                onClick={() => {
                  navigate(`/projects/${projectId}/blinds/${tag}`);
                  onClose();
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Full Detail Page
              </Button>
            </SheetHeader>

            {/* Tabs */}
            <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 mt-4 mb-0 bg-slate-100 shrink-0">
                <TabsTrigger value="info" className="gap-1.5 text-xs">
                  <Package className="h-3.5 w-3.5" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1.5 text-xs">
                  <Activity className="h-3.5 w-3.5" />
                  Workflow
                  {data.phaseTimeline.length > 0 && (
                    <span className="ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {data.phaseTimeline.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="logs" className="gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  Change Log
                  {data.logs.length > 0 && (
                    <span className="ml-1 rounded-full bg-slate-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {data.logs.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="surveys" className="gap-1.5 text-xs">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Surveys
                  {data.surveyHistory.length > 0 && (
                    <span className="ml-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {data.surveyHistory.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* ── Details Tab ── */}
              <TabsContent value="info" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                      Blind Information
                    </p>
                    <div className="grid grid-cols-2 gap-x-6 divide-y divide-slate-100">
                      <InfoRow label="Tag" value={<span className="font-mono font-extrabold">{data.blind.tag}</span>} icon={<Package className="h-3.5 w-3.5" />} />
                      <InfoRow label="Project" value={data.project.name} icon={<FileText className="h-3.5 w-3.5" />} />
                      <InfoRow label="Type" value={data.blind.type} icon={<Wrench className="h-3.5 w-3.5" />} />
                      <InfoRow label="Size" value={data.blind.size} />
                      <InfoRow label="Rate / Class" value={data.blind.rate} />
                      <InfoRow label="Owner" value={data.blind.owner} icon={<User className="h-3.5 w-3.5" />} />
                      <InfoRow label="Equipment" value={data.blind.equipment} />
                      <InfoRow label="Location" value={data.blind.location} icon={<MapPin className="h-3.5 w-3.5" />} />
                      <InfoRow label="Isolation Point" value={data.blind.isolationPoint} />
                      <InfoRow
                        label="Foreman Approved"
                        value={
                          data.blind.slipMetalForemanApproved ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                            </span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )
                        }
                      />
                      <InfoRow
                        label="Merged"
                        value={
                          data.blind.slipBlindMerged ? (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                              <Layers className="h-3.5 w-3.5" /> Yes
                            </span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )
                        }
                      />
                    </div>

                    {data.blind.notes && (
                      <>
                        <Separator className="my-4" />
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Notes</p>
                        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-200">
                          {data.blind.notes}
                        </p>
                      </>
                    )}

                    <Separator className="my-4" />
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Slip Status</p>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={derivedSlipStatus} />
                      {data.blind.slipMetalForemanApproved && (
                        <span className="text-xs text-slate-500">Foreman sign-off recorded</span>
                      )}
                    </div>

                    <div className="pb-6" />
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* ── Workflow Timeline Tab ── */}
              <TabsContent value="timeline" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full px-6 py-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                    Phase Timeline
                  </p>
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-200" />

                    <div className="space-y-4">
                      {data.phaseTimeline.map((phase) => {
                        const cfg = PHASE_STATUS_CONFIG[phase.status];
                        return (
                          <div key={phase.phase} className="relative flex gap-4 pl-10">
                            {/* Dot */}
                            <div
                              className={`absolute left-0 top-1 h-7 w-7 rounded-full flex items-center justify-center ring-4 ${cfg.color} ${cfg.ring} shrink-0`}
                            >
                              {phase.status === "completed" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                              ) : phase.status === "current" ? (
                                <Activity className="h-3.5 w-3.5 text-white" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                              )}
                            </div>

                            {/* Content */}
                            <div
                              className={`flex-1 rounded-xl border p-3 ${
                                phase.status === "current"
                                  ? "border-cyan-200 bg-cyan-50"
                                  : phase.status === "completed"
                                  ? "border-emerald-100 bg-emerald-50/40"
                                  : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{phase.phase}</p>
                                  <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${
                                    phase.status === "current" ? "text-cyan-600" :
                                    phase.status === "completed" ? "text-emerald-600" : "text-slate-400"
                                  }`}>
                                    {cfg.label}
                                  </p>
                                </div>
                                {phase.approval?.approved && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Approved
                                  </span>
                                )}
                              </div>

                              {/* Approval details */}
                              {phase.approval?.approved && (
                                <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                                  {phase.approval.approvedByName && (
                                    <p className="flex items-center gap-1">
                                      <User className="h-3 w-3 text-slate-400" />
                                      {phase.approval.approvedByName}
                                    </p>
                                  )}
                                  {phase.approval.approvedAt && (
                                    <p className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3 text-slate-400" />
                                      {new Date(phase.approval.approvedAt).toLocaleString()}
                                    </p>
                                  )}
                                  {phase.approval.note && (
                                    <p className="italic text-slate-500 mt-1">"{phase.approval.note}"</p>
                                  )}
                                </div>
                              )}

                              {/* Phase owners */}
                              {phase.owners.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {phase.owners.map((o) => (
                                    <span key={o.openId} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                                      <User className="h-2.5 w-2.5" />
                                      {o.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="pb-6" />
                </ScrollArea>
              </TabsContent>

              {/* ── Change Log Tab ── */}
              <TabsContent value="logs" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full px-6 py-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                    Change History ({data.logs.length} entries)
                  </p>

                  {data.logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <Clock className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm font-semibold">No change log entries</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-200" />
                      <div className="space-y-3">
                        {[...data.logs].reverse().map((log, idx) => (
                          <div key={String(log.id) + idx} className="relative flex gap-4 pl-10">
                            <div className="absolute left-0 top-1 h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                              <Activity className="h-3.5 w-3.5 text-slate-500" />
                            </div>
                            <div className="flex-1 rounded-xl border border-slate-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-800">{log.action}</p>
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  {log.phase}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-slate-600 leading-relaxed">{log.message}</p>
                              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
                                {log.actorName && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-2.5 w-2.5" />
                                    {log.actorName}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {new Date(log.createdAt).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pb-6" />
                </ScrollArea>
              </TabsContent>

              {/* ── Survey History Tab ── */}
              <TabsContent value="surveys" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full px-6 py-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                    Survey History for {tag} ({data.surveyHistory.length} entries)
                  </p>

                  {data.surveyHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <ClipboardList className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm font-semibold">No surveys recorded for this blind</p>
                      <p className="text-xs mt-1 text-center">
                        Conduct a periodic survey from the Blinds page to start tracking
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...data.surveyHistory].reverse().map((sv, idx) => {
                        const condCfg = CONDITION_CONFIG[sv.physicalCondition] ?? CONDITION_CONFIG.good;
                        const statusCfg = SLIP_STATUS_CONFIG[sv.slipStatus] ?? SLIP_STATUS_CONFIG.unknown;
                        return (
                          <div
                            key={sv.surveyId + "-" + idx}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            {/* Survey header */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-cyan-600" />
                                  {sv.surveyDate || "—"}
                                </p>
                                {sv.conductedByName && (
                                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {sv.conductedByName}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusCfg.color}`}>
                                  {statusCfg.icon}
                                  {statusCfg.label}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${condCfg.color}`}>
                                  {condCfg.label}
                                </span>
                              </div>
                            </div>

                            {/* Survey details */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-lg bg-slate-50 px-3 py-2">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Foreman Approved</p>
                                <p className={`font-semibold mt-0.5 ${sv.foremanApproved ? "text-emerald-700" : "text-slate-500"}`}>
                                  {sv.foremanApproved ? "✓ Yes" : "No"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-3 py-2">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Physical Condition</p>
                                <p className={`font-semibold mt-0.5 ${condCfg.color.split(" ")[0]}`}>
                                  {condCfg.label}
                                </p>
                              </div>
                              {sv.location && (
                                <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Location</p>
                                  <p className="font-medium text-slate-700 mt-0.5">{sv.location}</p>
                                </div>
                              )}
                            </div>

                            {sv.notes && (
                              <p className="mt-2 text-xs text-slate-600 italic border-t border-slate-100 pt-2">
                                "{sv.notes}"
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="pb-6" />
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
