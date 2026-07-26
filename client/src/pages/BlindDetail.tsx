/*
Design Philosophy: Industrial Command Center Minimalism.
The blind detail page is the operational cockpit for a single blind: fixed header identity, left-side workflow phase track, right-side audit log, electronic phase approvals, and a controlled update panel for field execution changes.
*/
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BadgeCheck, BadgeX, CheckCircle2, CircleDot, ClipboardList, FileSignature, Gauge, Save, ShieldCheck, TimerReset, Award } from "lucide-react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type BlindPhase = "Broken / Preparation" | "Assembly" | "Tight & Torque" | "Final Tight" | "Inspection Ready";
type BlindPriority = "Low" | "Normal" | "High" | "Critical";

type UpdateDraft = {
  phase: BlindPhase;
  priority: BlindPriority;
  owner: string;
  slipMetalForemanApproved: boolean;
  slipBlindMerged: boolean;
  notes: string;
};

const phaseOrder: BlindPhase[] = ["Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready"];
const priorityOrder: BlindPriority[] = ["Low", "Normal", "High", "Critical"];

const priorityStyles: Record<BlindPriority, string> = {
  Low: "bg-slate-50 text-slate-600 ring-slate-200",
  Normal: "bg-blue-50 text-blue-700 ring-blue-100",
  High: "bg-amber-50 text-amber-800 ring-amber-100",
  Critical: "bg-red-50 text-red-700 ring-red-100",
};

function initials(name: string | null | undefined) {
  const tokens = (name ?? "System").trim().split(/\s+/).filter(Boolean);
  return (tokens.slice(0, 2).map((token) => token[0]).join("") || "S").toUpperCase();
}

function canEditPhase(owners: Array<{ openId: string; name: string; email?: string | null }> | undefined, user: { openId?: string; name?: string | null; email?: string | null; role?: string } | null | undefined) {
  if (user?.role === "admin") return true;
  if (!owners || owners.length === 0) return true;
  const userTokens = [user?.openId, user?.name, user?.email].map((token) => token?.trim().toLowerCase()).filter((token): token is string => Boolean(token));
  return owners.some((owner) => [owner.openId, owner.name, owner.email ?? ""].map((token) => token.trim().toLowerCase()).some((token) => token && userTokens.includes(token)));
}

export default function BlindDetail() {
  const [isAreaBlindRoute, areaParams] = useRoute("/areas/:areaId/projects/:projectId/blinds/:tag");
  const [, projectParams] = useRoute("/projects/:projectId/blinds/:tag");
  const projectId = isAreaBlindRoute ? areaParams?.projectId : projectParams?.projectId;
  const areaId = isAreaBlindRoute ? areaParams?.areaId : undefined;
  const tag = decodeURIComponent(isAreaBlindRoute ? areaParams?.tag ?? "" : projectParams?.tag ?? "");
  const backHref = areaId ? `/areas/${areaId}/projects/${projectId}` : `/projects/${projectId}`;
  const utils = trpc.useUtils();
  const { user } = useAuth();

  const detailQuery = trpc.projects.blindDetail.useQuery({ projectId: projectId ?? "", tag }, { enabled: Boolean(projectId && tag) });
  const updateBlind = trpc.projects.updateBlind.useMutation({
    onSuccess: async () => {
      toast.success("Blind detail updated and logged.");
      if (projectId && tag) await utils.projects.blindDetail.invalidate({ projectId, tag });
      if (projectId) await utils.projects.detail.invalidate({ id: projectId });
    },
    onError: (error) => toast.error(error.message),
  });
  const approveBlindPhase = trpc.projects.approveBlindPhase.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(variables.approved ? `${variables.phase} approved electronically.` : `${variables.phase} approval revoked.`);
      if (projectId && tag) await utils.projects.blindDetail.invalidate({ projectId, tag });
      if (projectId) await utils.projects.detail.invalidate({ id: projectId });
    },
    onError: (error) => toast.error(error.message),
  });

  const detail = detailQuery.data;
  const blind = detail?.blind;
  const currentPhaseOwners = useMemo(() => detail?.settings.phaseOwners.find((owner) => owner.phase === blind?.phase)?.owners ?? [], [detail?.settings.phaseOwners, blind?.phase]);
  const canUpdateCurrentPhase = canEditPhase(currentPhaseOwners, user);

  const [draft, setDraft] = useState<UpdateDraft | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!blind) return;
    setDraft({
      phase: blind.phase as BlindPhase,
      priority: blind.priority as BlindPriority,
      owner: blind.owner,
      slipMetalForemanApproved: Boolean(blind.slipMetalForemanApproved),
      slipBlindMerged: Boolean(blind.slipBlindMerged),
      notes: blind.notes ?? "",
    });
  }, [blind]);

  useEffect(() => {
    if (!detail) return;
    setApprovalNotes(Object.fromEntries(detail.phaseTimeline.map((phase) => [phase.phase, phase.approval.note ?? ""])));
  }, [detail]);

  const submitUpdate = () => {
    if (!projectId || !blind || !draft) return;
    updateBlind.mutate({
      projectId,
      tag: blind.tag,
      phase: draft.phase,
      priority: draft.priority,
      owner: draft.owner,
      slipMetalForemanApproved: draft.slipMetalForemanApproved,
      slipBlindMerged: draft.slipBlindMerged,
      notes: draft.notes,
    });
  };

  const submitApproval = (phase: BlindPhase, approved: boolean) => {
    if (!projectId || !blind) return;
    approveBlindPhase.mutate({
      projectId,
      tag: blind.tag,
      phase,
      approved,
      note: approvalNotes[phase]?.trim() || null,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Blind operational detail"
        title={blind ? blind.tag : "Blind details"}
        description={detail ? `${detail.project.id} · ${detail.project.name}. Review blind data, workflow status, electronic approvals, and event log from one focused page.` : "Load a single blind to review workflow phases and audit events."}
        actions={<div className="flex gap-2"><Link href={backHref} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Back to project</Link>{blind && detail && <a href={`/certificate/${detail.project.id}/${encodeURIComponent(blind.tag)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-700"><Award className="h-4 w-4" /> View Certificate</a>}</div>}
      />

      {detailQuery.isLoading && <div className="sbts-card p-8"><div className="h-5 w-56 animate-pulse rounded-full bg-slate-200" /><div className="mt-6 grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-3xl bg-slate-100" />)}</div></div>}

      {detailQuery.isError && <div className="sbts-card border-red-100 bg-red-50/80 p-6"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" /><div><h3 className="font-extrabold text-red-950">Blind detail could not be loaded</h3><p className="mt-1 text-sm font-medium text-red-700">Retry after confirming project connectivity and the blind tag.</p></div></div></div>}

      {!detailQuery.isLoading && !detailQuery.isError && !detail && <div className="sbts-card border-amber-100 bg-amber-50/80 p-6"><h3 className="font-extrabold text-amber-950">Blind not found</h3><p className="mt-1 text-sm font-medium text-amber-800">The selected blind tag is not linked to this project.</p></div>}

      {detail && blind && draft && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="sbts-card p-5"><div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Project</div><div className="mt-2 text-xl font-extrabold text-slate-950">{detail.project.id}</div><div className="mt-1 text-xs font-bold text-slate-500">{detail.project.areaCode} · {detail.project.areaName}</div></div>
            <div className="sbts-card p-5"><div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Type / size</div><div className="mt-2 text-xl font-extrabold text-slate-950">{blind.type}</div><div className="mt-1 text-xs font-bold text-slate-500">{blind.size}{blind.rate ? ` · Rate ${blind.rate}` : ""}</div></div>
            <div className="sbts-card p-5"><div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Current phase</div><div className="mt-2 text-xl font-extrabold text-slate-950">{blind.phase}</div><div className="mt-1 text-xs font-bold text-slate-500">Owner: {blind.owner}</div></div>
            <div className="sbts-card p-5"><div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Priority</div><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${priorityStyles[blind.priority as BlindPriority]}`}>{blind.priority}</span><div className="mt-3 text-xs font-bold text-slate-500">Updated {new Date(blind.updatedAt).toLocaleString()}</div></div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="sbts-card overflow-hidden p-0">
              <div className="border-b border-slate-100 p-6"><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-cyan-700"><Gauge className="h-4 w-4" /> Workflow phases</div><h2 className="mt-2 text-xl font-extrabold text-slate-950">Current execution path</h2></div>
              <div className="space-y-3 p-5">
                {detail.phaseTimeline.map((phase) => {
                  const Icon = phase.status === "completed" ? CheckCircle2 : phase.status === "current" ? CircleDot : TimerReset;
                  const phaseAllowed = phase.canApprove && canEditPhase(phase.owners, user);
                  const pendingThisPhase = approveBlindPhase.isPending && approveBlindPhase.variables?.phase === phase.phase;
                  return (
                    <div key={phase.phase} className="rounded-3xl border bg-white p-4 shadow-sm" style={{ borderColor: `${phase.color}33`, background: phase.status === "current" ? `${phase.color}12` : "white" }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: phase.color }}><Icon className="h-5 w-5" /></div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-950">{phase.phase}</div>
                            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{phase.status === "completed" ? "Completed" : phase.status === "current" ? "Current status" : "Waiting"}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-slate-100">{phase.count} records</span>
                              {phase.approval.approved ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-100"><BadgeCheck className="h-3.5 w-3.5" /> Approved</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 ring-1 ring-amber-100"><FileSignature className="h-3.5 w-3.5" /> Pending sign-off</span>}
                            </div>
                            {phase.approval.approved && <div className="mt-2 text-xs font-bold text-slate-500">Approved by {phase.approval.approvedByName ?? "Unknown"}{phase.approval.approvedAt ? ` · ${new Date(phase.approval.approvedAt).toLocaleString()}` : ""}</div>}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                        <Textarea value={approvalNotes[phase.phase] ?? ""} disabled={!phaseAllowed || pendingThisPhase} onChange={(event) => setApprovalNotes((current) => ({ ...current, [phase.phase]: event.target.value }))} placeholder="Optional electronic approval note" className="min-h-20 bg-white" />
                        <div className="flex flex-col gap-2">
                          <Button type="button" onClick={() => submitApproval(phase.phase, true)} disabled={!phaseAllowed || phase.approval.approved || pendingThisPhase} className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"><BadgeCheck className="h-4 w-4" /> Approve</Button>
                          <Button type="button" variant="outline" onClick={() => submitApproval(phase.phase, false)} disabled={!phaseAllowed || !phase.approval.approved || pendingThisPhase} className="rounded-2xl bg-white text-slate-700 hover:bg-slate-50"><BadgeX className="h-4 w-4" /> Revoke</Button>
                        </div>
                      </div>
                      {!phaseAllowed && <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500 ring-1 ring-slate-100">Approval is available only when the blind has reached this phase and your account is assigned to the phase, or has administrator access.</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sbts-card overflow-hidden p-0">
              <div className="border-b border-slate-100 p-6"><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500"><ClipboardList className="h-4 w-4 text-cyan-700" /> Activity log</div><h2 className="mt-2 text-xl font-extrabold text-slate-950">Blind execution log</h2></div>
              <div className="max-h-[640px] space-y-4 overflow-auto p-5">
                {detail.logs.map((log) => (
                  <article key={String(log.id)} className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xs font-extrabold text-white">{initials(log.actorName)}</div>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-extrabold text-slate-950">{log.action}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-slate-500 ring-1 ring-slate-200">{log.phase}</span></div><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{log.message}</p><div className="mt-2 text-xs font-bold text-slate-500">{log.actorName ?? "System"} · {new Date(log.createdAt).toLocaleString()}</div></div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="sbts-card p-6"><div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Blind identity</div><dl className="mt-4 grid gap-3 text-sm"><div className="rounded-2xl bg-slate-50 p-3"><dt className="font-extrabold text-slate-500">Equipment</dt><dd className="mt-1 font-bold text-slate-950">{blind.equipment ?? "Not specified"}</dd></div><div className="rounded-2xl bg-slate-50 p-3"><dt className="font-extrabold text-slate-500">Location</dt><dd className="mt-1 font-bold text-slate-950">{blind.location ?? "Not specified"}</dd></div><div className="rounded-2xl bg-slate-50 p-3"><dt className="font-extrabold text-slate-500">Isolation point</dt><dd className="mt-1 font-bold text-slate-950">{blind.isolationPoint ?? "Not specified"}</dd></div></dl></div>
            <div className="sbts-card p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-xs font-extrabold uppercase tracking-[0.22em] text-cyan-700">Controlled update</div><h2 className="mt-2 text-xl font-extrabold text-slate-950">Workflow phase work area</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-600">This page controls the blind work record. Specialty assignment and color configuration remain in project settings.</p></div><Button type="button" onClick={submitUpdate} disabled={updateBlind.isPending || !canUpdateCurrentPhase} className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800"><Save className="h-4 w-4" /> Save update</Button></div>
              {!canUpdateCurrentPhase && <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800 ring-1 ring-amber-100">Your account can view this blind, but only the assigned phase owners or administrators can update the current phase.</div>}
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Workflow phase</Label><Select value={draft.phase} onValueChange={(value) => setDraft({ ...draft, phase: value as BlindPhase })} disabled={!canUpdateCurrentPhase}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent>{phaseOrder.map((phase) => <SelectItem key={phase} value={phase}>{phase}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Priority</Label><Select value={draft.priority} onValueChange={(value) => setDraft({ ...draft, priority: value as BlindPriority })} disabled={!canUpdateCurrentPhase}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent>{priorityOrder.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div>
                {blind.type === "Slip Blind" && <div className="md:col-span-2 rounded-2xl bg-cyan-50/70 p-4 ring-1 ring-cyan-100"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-700" /><div><div className="font-extrabold text-slate-950">Slip Blind gate</div><p className="mt-1 text-xs font-bold leading-5 text-slate-600">Project setting is {detail.settings.slipBlindGateRequired ? "active: Foreman Metal approval and merged confirmation are mandatory." : "inactive: gate confirmations are tracked but not mandatory."}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-bold text-slate-700 ring-1 ring-cyan-100"><Checkbox checked={draft.slipMetalForemanApproved} disabled={!canUpdateCurrentPhase} onCheckedChange={(checked) => setDraft({ ...draft, slipMetalForemanApproved: checked === true })} /> Foreman Metal approval</label><label className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-bold text-slate-700 ring-1 ring-cyan-100"><Checkbox checked={draft.slipBlindMerged} disabled={!canUpdateCurrentPhase} onCheckedChange={(checked) => setDraft({ ...draft, slipBlindMerged: checked === true })} /> Slip Blind merged</label></div></div>}
                <div className="space-y-2 md:col-span-2"><Label>Operational notes</Label><Textarea value={draft.notes} disabled={!canUpdateCurrentPhase} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Add execution notes, hold points, or certificate comments" /></div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
