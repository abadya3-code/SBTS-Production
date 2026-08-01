/*
Design Philosophy: Industrial Command Center Minimalism.
The project detail page turns a project card into a focused execution room: project context remains visible while linked blind records, priorities, and phase readiness are reviewed without bouncing between modules.
*/
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ClipboardList, Eye, FileDown, Gauge, Layers3, Plus, Printer, RefreshCw, Settings2, ShieldAlert, ShieldCheck, Tags, Upload, Workflow, X } from "lucide-react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { bulkPasteColumns, bulkPasteExampleRow, parseBulkPaste } from "@shared/blindBulkPaste";
import { buildProjectRegisterPdfSpec } from "@shared/pdfExports";
import { ProjectHeader } from "@/components/dashboard/ProjectHeader";
import { MetricsCards } from "@/components/dashboard/MetricsCards";
import { WorkflowPhases } from "@/components/dashboard/WorkflowPhases";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { BlindsRegistry } from "@/components/dashboard/BlindsRegistry";
import { canonicalWorkflowPhases } from "@shared/workflowSpecification";
import { openSanitizedPrintWindow } from "@/lib/printSecurity";

type BlindPhase = "Broken / Preparation" | "Assembly" | "Tight & Torque" | "Final Tight" | "Inspection Ready";
type BlindPriority = "Low" | "Normal" | "High" | "Critical";
type BlindType = "Slip Blind" | "Drop Spool" | "Isolation";
type ProjectStatus = "Active" | "Completed" | "On Hold" | "Planning" | "Final Review";

type PhaseAssigneeDraft = {
  openId: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  role?: "user" | "admin";
};

type BlindDraft = {
  tag: string;
  type: BlindType;
  size: string;
  rate: string;
  phase: BlindPhase;
  owner: string;
  priority: BlindPriority;
  equipment: string;
  location: string;
  isolationPoint: string;
  slipMetalForemanApproved: boolean;
  slipBlindMerged: boolean;
  notes: string;
};

type PhaseOwnerDraft = {
  phase: BlindPhase;
  phaseColor: string;
  owners: PhaseAssigneeDraft[];
};

type ExportProject = {
  id: string;
  name: string;
  areaCode: string;
  areaName: string;
  status: string;
  description: string | null;
  progress: number;
};

type ExportMetrics = {
  registeredBlinds: number;
  plannedBlinds: number;
  highPriorityBlinds: number;
  criticalBlinds: number;
  inspectionReadyBlinds: number;
};

type ExportBlind = {
  tag: string;
  type: string;
  size: string;
  rate: string | null;
  phase: BlindPhase;
  owner: string;
  priority: BlindPriority;
  equipment: string | null;
  location: string | null;
  isolationPoint: string | null;
  slipMetalForemanApproved: boolean;
  slipBlindMerged: boolean;
  notes: string | null;
};

const phaseOrder: BlindPhase[] = ["Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready"];
const priorityOrder: BlindPriority[] = ["Low", "Normal", "High", "Critical"];
const blindTypeOptions: BlindType[] = ["Slip Blind", "Drop Spool", "Isolation"];

const phaseStyles: Record<BlindPhase, string> = {
  "Broken / Preparation": "bg-amber-50 text-amber-800 ring-amber-100",
  Assembly: "bg-blue-50 text-blue-700 ring-blue-100",
  "Tight & Torque": "bg-violet-50 text-violet-700 ring-violet-100",
  "Final Tight": "bg-cyan-50 text-cyan-700 ring-cyan-100",
  "Inspection Ready": "bg-emerald-50 text-emerald-700 ring-emerald-100",
};

const priorityStyles: Record<BlindPriority, string> = {
  Low: "bg-slate-50 text-slate-600 ring-slate-200",
  Normal: "bg-blue-50 text-blue-700 ring-blue-100",
  High: "bg-amber-50 text-amber-800 ring-amber-100",
  Critical: "bg-red-50 text-red-700 ring-red-100",
};

const statusStyles: Record<ProjectStatus, string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Completed: "bg-blue-50 text-blue-700 ring-blue-100",
  "On Hold": "bg-amber-50 text-amber-700 ring-amber-100",
  Planning: "bg-slate-100 text-slate-700 ring-slate-200",
  "Final Review": "bg-cyan-50 text-cyan-700 ring-cyan-100",
};

const defaultBlindDraft: BlindDraft = {
  tag: "",
  type: "Slip Blind",
  size: "",
  rate: "",
  phase: "Broken / Preparation",
  owner: "Project phase owner",
  priority: "Normal",
  equipment: "",
  location: "",
  isolationPoint: "",
  slipMetalForemanApproved: false,
  slipBlindMerged: false,
  notes: "",
};

const defaultPhaseOwners: PhaseOwnerDraft[] = phaseOrder.map((phase) => ({ phase, phaseColor: "#0e7490", owners: [] }));

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="sbts-card p-5">
            <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 h-8 w-20 animate-pulse rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="sbts-card p-6">
        <div className="h-5 w-56 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-5 h-44 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    </div>
  );
}

function clampProgress(value: number) {
  return Math.min(100, Math.max(0, value));
}

function normalizePhase(value: string): BlindPhase {
  const normalized = value.trim().toLowerCase();
  const match = phaseOrder.find((phase) => phase.toLowerCase() === normalized || phase.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized.replace(/[^a-z0-9]/g, ""));
  return match ?? "Broken / Preparation";
}

function normalizeBlindType(value: string): BlindType {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const match = blindTypeOptions.find((type) => type.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
  return match ?? "Slip Blind";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "U").toUpperCase();
}

function draftFromBlind(blind: BlindDraft & { tag: string }) {
  return {
    tag: blind.tag,
    type: normalizeBlindType(blind.type),
    size: blind.size,
    rate: blind.rate ?? "",
    phase: blind.phase,
    owner: blind.owner,
    priority: blind.priority,
    equipment: blind.equipment ?? "",
    location: blind.location ?? "",
    isolationPoint: blind.isolationPoint ?? "",
    slipMetalForemanApproved: Boolean(blind.slipMetalForemanApproved),
    slipBlindMerged: Boolean(blind.slipBlindMerged),
    notes: blind.notes ?? "",
  };
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] ?? char));
}

function buildProjectRegisterHtml(project: ExportProject, blinds: ExportBlind[], metrics: ExportMetrics) {
  const generatedAt = new Date().toLocaleString();
  const rows = blinds.map((blind, index) => `
    <tr>
      <td>${index + 1}</td><td><strong>${escapeHtml(blind.tag)}</strong><br/><span>${escapeHtml(blind.equipment || "No equipment")}</span></td>
      <td>${escapeHtml(blind.type)}<br/><span>${escapeHtml(blind.size)}${blind.rate ? ` · Rate ${escapeHtml(blind.rate)}` : ""}</span></td><td>${escapeHtml(blind.phase)}</td>
      <td>${escapeHtml(blind.priority)}</td><td>${escapeHtml(blind.owner)}</td><td>${escapeHtml(blind.isolationPoint || "Not specified")}</td>
      <td>${blind.type === "Slip Blind" ? `${blind.slipMetalForemanApproved ? "Foreman approved" : "Foreman pending"} / ${blind.slipBlindMerged ? "Merged" : "Not merged"}` : "N/A"}</td><td>${escapeHtml(blind.notes || "")}</td>
    </tr>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(project.id)} Blind Register</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; color:#0f172a; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:24px; border-bottom:3px solid #0e7490; padding-bottom:14px; margin-bottom:18px; }
    .eyebrow { font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#0e7490; font-weight:800; }
    h1 { margin:6px 0 0; font-size:26px; } .meta { text-align:right; font-size:12px; line-height:1.7; color:#475569; }
    .cards { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin:16px 0; }
    .card { border:1px solid #cbd5e1; border-radius:12px; padding:10px; } .card b { display:block; font-size:20px; margin-top:4px; }
    table { width:100%; border-collapse:collapse; font-size:11px; } th { background:#0f172a; color:#fff; text-align:left; padding:8px; }
    td { border-bottom:1px solid #e2e8f0; padding:8px; vertical-align:top; } span { color:#64748b; font-size:10px; }
    .signatures { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:26px; break-inside:avoid; }
    .signature { border-top:1px solid #334155; padding-top:8px; font-size:12px; color:#334155; min-height:48px; }
  </style></head><body><section class="header"><div><div class="eyebrow">SBTS project blind register</div><h1>${escapeHtml(project.name)}</h1><p>${escapeHtml(project.id)} · ${escapeHtml(project.areaCode)} · ${escapeHtml(project.areaName)}</p></div><div class="meta"><strong>Status:</strong> ${escapeHtml(project.status)}<br/><strong>Progress:</strong> ${escapeHtml(project.progress)}%<br/><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div></section><div class="cards"><div class="card">Planned<b>${metrics.plannedBlinds}</b></div><div class="card">Registered<b>${metrics.registeredBlinds}</b></div><div class="card">High Priority<b>${metrics.highPriorityBlinds}</b></div><div class="card">Critical<b>${metrics.criticalBlinds}</b></div><div class="card">Inspection Ready<b>${metrics.inspectionReadyBlinds}</b></div></div><table><thead><tr><th>#</th><th>Blind Tag</th><th>Type / Size</th><th>Phase</th><th>Priority</th><th>Phase Owner</th><th>Isolation Point</th><th>Slip Gate</th><th>Notes</th></tr></thead><tbody>${rows || "<tr><td colspan='9'>No blind records.</td></tr>"}</tbody></table><div class="signatures"><div class="signature">Operator / Technician</div><div class="signature">T&I Engineer</div><div class="signature">QC Inspector</div><div class="signature">Inspection Authority</div></div></body></html>`;
}

function downloadProjectRegisterPdf(project: ExportProject, blinds: ExportBlind[], metrics: ExportMetrics) {
  const spec = buildProjectRegisterPdfSpec(project, blinds, metrics);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(spec.title, 12, 10);
  doc.setFontSize(10);
  doc.text(spec.subtitle, 12, 17);

  autoTable(doc, {
    startY: 30,
    head: spec.summaryHead,
    body: spec.summaryBody,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [14, 116, 144] },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: spec.blindHead,
    body: spec.blindRows,
    theme: "striped",
    styles: { fontSize: 7.2, cellPadding: 1.8, overflow: "linebreak" },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 32 }, 2: { cellWidth: 32 }, 8: { cellWidth: 50 } },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(spec.footerText, 12, 202);
    },
  });
  doc.save(spec.filename);
}

function printHtml(html: string) {
  openSanitizedPrintWindow(html, {
    onBlocked: () => toast.error("Browser blocked the print window. Allow popups and try again."),
  });
}

function FieldGrid({ draft, setDraft, lockTag = false }: { draft: BlindDraft; setDraft: (draft: BlindDraft) => void; lockTag?: boolean }) {
  const isSlipBlind = draft.type === "Slip Blind";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="blind-tag">Blind tag</Label>
          <Input id="blind-tag" value={draft.tag} disabled={lockTag} onChange={(event) => setDraft({ ...draft, tag: event.target.value })} placeholder="BLD-1401" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blind-type">Blind type</Label>
          <Select value={draft.type} onValueChange={(value) => {
            const type = value as BlindType;
            setDraft({ ...draft, type, slipMetalForemanApproved: type === "Slip Blind" ? draft.slipMetalForemanApproved : false, slipBlindMerged: type === "Slip Blind" ? draft.slipBlindMerged : false });
          }}>
            <SelectTrigger id="blind-type"><SelectValue /></SelectTrigger>
            <SelectContent>{blindTypeOptions.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 md:grid-cols-2 md:col-span-2">
          <div className="space-y-2">
            <Label htmlFor="blind-size">Size</Label>
            <Input id="blind-size" value={draft.size} onChange={(event) => setDraft({ ...draft, size: event.target.value })} placeholder="12 in" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blind-rate">Rate</Label>
            <Input id="blind-rate" value={draft.rate} onChange={(event) => setDraft({ ...draft, rate: event.target.value })} placeholder="150# / 300# / 600#" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={draft.priority} onValueChange={(value) => setDraft({ ...draft, priority: value as BlindPriority })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{priorityOrder.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipment-number">Equipment</Label>
          <Input id="equipment-number" value={draft.equipment} onChange={(event) => setDraft({ ...draft, equipment: event.target.value })} placeholder="Pump P-101 / Vessel V-204 / Line 6-FW-102" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blind-location">Location</Label>
          <Input id="blind-location" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Train inlet header" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="isolation-point">Isolation point</Label>
          <Input id="isolation-point" value={draft.isolationPoint} onChange={(event) => setDraft({ ...draft, isolationPoint: event.target.value })} placeholder="Upstream ESDV-401" />
        </div>
      </div>

      {isSlipBlind && (
        <div className="rounded-2xl bg-cyan-50/70 p-4 ring-1 ring-cyan-100">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-700" />
            <div>
              <div className="text-sm font-extrabold text-slate-950">Slip Blind conditional approval</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">The record can be created normally. Metal Foreman approval is generated automatically as a conditional step during Final Approval & Return to Service and is enforced by the server workflow engine.</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="blind-notes">Notes</Label>
        <Textarea id="blind-notes" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Execution notes, safety holds, torque reference, or certificate comments" />
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const [isAreaProjectRoute, areaProjectParams] = useRoute("/areas/:areaId/projects/:projectId");
  const [, projectParams] = useRoute("/projects/:projectId");
  const projectId = isAreaProjectRoute ? areaProjectParams?.projectId : projectParams?.projectId;
  const areaId = isAreaProjectRoute ? areaProjectParams?.areaId : undefined;
  const backHref = areaId ? `/areas/${areaId}/projects` : "/projects";
  const utils = trpc.useUtils();
  const { user } = useAuth();

  const [singleOpen, setSingleOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);
  const [blindDraft, setBlindDraft] = useState<BlindDraft>(defaultBlindDraft);
  const [editingDraft, setEditingDraft] = useState<BlindDraft>(defaultBlindDraft);
  const [bulkText, setBulkText] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<PhaseOwnerDraft[]>(defaultPhaseOwners);
  const [slipBlindGateRequiredDraft, setSlipBlindGateRequiredDraft] = useState(true);

  const detailQuery = trpc.projects.detail.useQuery({ id: projectId ?? "" }, { enabled: Boolean(projectId) });
  const assignableUsersQuery = trpc.projects.settings.assignableUsers.useQuery(undefined, { enabled: settingsOpen });
  const detail = detailQuery.data;
  const project = detail?.project;
  const blinds = detail?.blinds ?? [];
  const metrics = detail?.metrics;
  const progress = project ? clampProgress(project.progress) : 0;
  const registeredPercentage = metrics && metrics.plannedBlinds > 0 ? Math.round((metrics.registeredBlinds / metrics.plannedBlinds) * 100) : 0;

  const phaseOwners = useMemo(() => detail?.settings.phaseOwners ?? defaultPhaseOwners.map((owner) => ({ ...owner, projectId: projectId ?? "", ownerName: "Unassigned", ownerRole: "unassigned", updatedAt: null })), [detail?.settings.phaseOwners, projectId]);
  const slipBlindGateRequired = detail?.settings.slipBlindGateRequired ?? true;
  const phaseOwnerByPhase = useMemo(() => new Map(phaseOwners.map((owner) => [owner.phase, owner])), [phaseOwners]);
  const bulkPreview = useMemo(() => parseBulkPaste(bulkText), [bulkText]);
  const assignableUsers = assignableUsersQuery.data ?? [];
  const canManageSettings = user?.role === "admin";

  const canEditPhase = (phase: BlindPhase) => {
    if (user?.role === "admin") return true;
    const owner = phaseOwnerByPhase.get(phase);
    if (!owner) return true;
    const owners = owner.owners ?? [];
    if (owners.length === 0) return true;
    const userTokens = [user?.openId, user?.name, user?.email].map((token) => token?.trim().toLowerCase()).filter((token): token is string => Boolean(token));
    return owners.some((assignee) => [assignee.openId, assignee.name, assignee.email ?? ""].map((token) => token.trim().toLowerCase()).some((token) => token && userTokens.includes(token)));
  };

  const canAddCurrentBlind = canEditPhase("Broken / Preparation");
  const canSaveEditingBlind = canEditPhase(editingDraft.phase);
  const canImportBulk = canEditPhase("Broken / Preparation");

  const invalidateProject = async () => {
    if (!projectId) return;
    await utils.projects.detail.invalidate({ id: projectId });
  };

  const addBlindMutation = trpc.projects.addBlind.useMutation({
    onSuccess: async () => {
      toast.success("Blind record added to the project.");
      setSingleOpen(false);
      setBlindDraft(defaultBlindDraft);
      await invalidateProject();
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkAddMutation = trpc.projects.bulkAddBlinds.useMutation({
    onSuccess: async (result) => {
      toast.success(`${result.count} blind records imported from the pasted table.`);
      setBulkOpen(false);
      setBulkText("");
      await invalidateProject();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateBlindMutation = trpc.projects.updateBlind.useMutation({
    onSuccess: async () => {
      toast.success("Blind record updated.");
      setEditingOpen(false);
      await invalidateProject();
    },
    onError: (error) => toast.error(error.message),
  });

  const settingsMutation = trpc.projects.settings.update.useMutation({
    onSuccess: async () => {
      toast.success("Project settings saved.");
      setSettingsOpen(false);
      await invalidateProject();
    },
    onError: (error) => toast.error(error.message),
  });

  const openSettings = () => {
    setSettingsDraft(phaseOwners.map((owner) => ({ phase: owner.phase as BlindPhase, phaseColor: owner.phaseColor ?? "#0e7490", owners: owner.owners ?? [] })));
    setSlipBlindGateRequiredDraft(slipBlindGateRequired);
    setSettingsOpen(true);
  };

  const openEditBlind = (blind: BlindDraft) => {
    setEditingDraft(draftFromBlind(blind));
    setEditingOpen(true);
  };

  const submitSingle = () => {
    if (!projectId) return;
    if (!canAddCurrentBlind) {
      toast.error("You can only add blinds when you are assigned to the preparation phase.");
      return;
    }
    addBlindMutation.mutate({ ...blindDraft, projectId });
  };

  const submitBulk = () => {
    if (!projectId) return;
    if (bulkPreview.errors.length > 0) {
      toast.error("Fix required columns before importing.");
      return;
    }
    if (bulkPreview.parsed.length === 0) {
      toast.error("Paste at least one valid row from Excel.");
      return;
    }
    if (!canImportBulk) {
      toast.error("Bulk import is limited to users assigned to the preparation phase.");
      return;
    }
    bulkAddMutation.mutate({ projectId, blinds: bulkPreview.parsed });
  };

  const submitEdit = () => {
    if (!projectId) return;
    if (!canSaveEditingBlind) {
      toast.error("You cannot move or update this blind into a phase owned by another user.");
      return;
    }
    updateBlindMutation.mutate({ ...editingDraft, projectId });
  };

  const addAssigneeToPhase = (phase: BlindPhase, assignee: PhaseAssigneeDraft) => {
    setSettingsDraft((current) => current.map((item) => {
      if (item.phase !== phase) return item;
      if (item.owners.some((owner) => owner.openId === assignee.openId)) return item;
      return { ...item, owners: [...item.owners, { openId: assignee.openId, name: assignee.name, email: assignee.email ?? null, avatarUrl: assignee.avatarUrl ?? null }] };
    }));
  };

  const removeAssigneeFromPhase = (phase: BlindPhase, openId: string) => {
    setSettingsDraft((current) => current.map((item) => item.phase === phase ? { ...item, owners: item.owners.filter((owner) => owner.openId !== openId) } : item));
  };

  const submitSettings = () => {
    if (!projectId) return;
    settingsMutation.mutate({ projectId, slipBlindGateRequired: slipBlindGateRequiredDraft, phaseOwners: settingsDraft.map((item) => ({ phase: item.phase, phaseColor: item.phaseColor, owners: item.owners })) });
  };

  const exportProjectRegister = () => {
    if (!project || !metrics) return;
    downloadProjectRegisterPdf(project, blinds as ExportBlind[], metrics);
    toast.success("Controlled project blind register exported as PDF.");
  };

  const printProjectRegister = () => {
    if (!project || !metrics) return;
    printHtml(buildProjectRegisterHtml(project, blinds as ExportBlind[], metrics));
  };

  const openTagPrintCenter = () => {
    if (!project) return;
    window.open(`/tags/print/${encodeURIComponent(project.id)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project execution detail"
        title={project ? project.name : "Project details"}
        description={project ? `${project.id} · ${project.areaCode} · ${project.areaName}. Review linked blind records, priority exposure, phase owners, and export-ready packages from one operational view.` : "Load a project to review its linked blind records, execution status, and readiness indicators."}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href={backHref} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" /> {areaId ? "Area projects" : "Projects"}
            </Link>
            <Button type="button" onClick={() => { setBlindDraft(defaultBlindDraft); setSingleOpen(true); }} className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800" disabled={!projectId}>
              <Plus className="h-4 w-4" /> Add blind
            </Button>
            <Button type="button" onClick={() => setBulkOpen(true)} variant="outline" className="rounded-2xl bg-white" disabled={!projectId}>
              <Upload className="h-4 w-4" /> Bulk paste
            </Button>
          </div>
        }
      />

      {detailQuery.isLoading && <DetailSkeleton />}

      {detailQuery.isError && (
        <div className="sbts-card border-red-100 bg-red-50/80 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <h3 className="text-base font-extrabold text-red-950">Project detail could not be loaded</h3>
                <p className="mt-1 text-sm font-medium text-red-700">The project detail API did not respond successfully. Retry after confirming database connectivity.</p>
              </div>
            </div>
            <button onClick={() => detailQuery.refetch()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-800">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        </div>
      )}

      {!detailQuery.isLoading && !detailQuery.isError && !detail && (
        <div className="sbts-card border-amber-100 bg-amber-50/80 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <h3 className="text-base font-extrabold text-amber-950">Project not found</h3>
                <p className="mt-1 text-sm font-medium text-amber-800">The requested project identifier is invalid, archived, or no longer exists. Return to the project list and select an active record.</p>
              </div>
            </div>
            <Link href={backHref} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-amber-800">
              <ArrowLeft className="h-4 w-4" /> Back to projects
            </Link>
          </div>
        </div>
      )}

      {detail && project && metrics && (
        <>
          {/* Project Header Component */}
          <ProjectHeader
            projectId={project.id}
            projectName={project.name}
            areaName={project.areaName}
            status={project.status as ProjectStatus}
            progress={progress}
            description={project.description ?? undefined}
            onEdit={openSettings}
          />

          {/* Metrics Cards Component */}
          {/* Metrics Cards Component - Displays key project metrics */}
          {/* Note: Trend percentages are calculated from real metrics, not hardcoded */}
          <MetricsCards
            registeredBlinds={metrics.registeredBlinds}
            plannedBlinds={metrics.plannedBlinds}
            highPriorityBlinds={metrics.highPriorityBlinds}
            criticalBlinds={metrics.criticalBlinds}
            inspectionReadyBlinds={metrics.inspectionReadyBlinds}
          />

          {/* Workflow Phases Component */}
          <WorkflowPhases
            phases={canonicalWorkflowPhases.map((phase) => {
              const count = blinds.filter((blind) => blind.workflowPhaseKey === phase.key).length;
              return {
                phase: phase.label,
                shortLabel: phase.shortLabel,
                color: phase.color,
                count,
                progress: Math.round(count / Math.max(1, metrics.registeredBlinds) * 100),
                owners: [],
                ownerRole: phase.ownerRoleKey.replace(/([a-z])([A-Z])/g, "$1 $2"),
                isCritical: phase.critical,
              };
            })}
            onPhaseClick={(phase) => {
              toast.info(`${phase} is controlled through each Blind Detail runtime record.`);
            }}
          />

          {/* Quick Actions Component */}
          <QuickActions
            onAddBlind={() => {
              setBlindDraft(defaultBlindDraft);
              setSingleOpen(true);
            }}
            onBulkPaste={() => setBulkOpen(true)}
            onPrint={printProjectRegister}
            onExport={exportProjectRegister}
            onRefresh={() => detailQuery.refetch()}
            isLoading={detailQuery.isRefetching}
          />

          {/* Blinds Registry Component */}
          <BlindsRegistry
            blinds={blinds.map((blind) => ({
              id: blind.tag,
              tag: blind.tag,
              type: blind.type as BlindType,
              size: blind.size,
              rate: blind.rate,
              phase: blind.workflowPhaseLabel ?? blind.phase,
              legacyPhase: blind.phase,
              lifecycleStatus: blind.workflowLifecycleStatus ?? null,
              workflowLocked: blind.workflowLocked ?? false,
              owner: blind.owner,
              priority: blind.priority as BlindPriority,
              equipment: blind.equipment,
              location: blind.location,
            }))}
            isLoading={detailQuery.isLoading}
            onView={(blindId) => {
              const detailHref = areaId ? `/areas/${areaId}/projects/${project.id}/blinds/${encodeURIComponent(blindId)}` : `/projects/${project.id}/blinds/${encodeURIComponent(blindId)}`;
              window.location.href = detailHref;
            }}
            onEdit={(blindId) => {
              const blind = blinds.find((b) => b.tag === blindId);
              if (blind) openEditBlind(blind as BlindDraft);
            }}
          />

          {/* Recent Activity Component - Placeholder for future activity log integration */}
          {/* <RecentActivity
            activities={[]}
            limit={5}
          /> */}

          {/* Legacy Sections - Preserved for backward compatibility */}
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="sbts-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Print and export center</div>
                  <h2 className="mt-2 text-xl font-extrabold text-slate-950">Project register and controlled tags</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600">Export the operational register here. Individual certificates remain immutable and verification-controlled, while physical tags use the saved layout and active secure QR URLs.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={exportProjectRegister}><FileDown className="h-4 w-4" /> Export project register</Button>
                  <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={printProjectRegister}><Printer className="h-4 w-4" /> Print project register</Button>
                  <Button type="button" className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={openTagPrintCenter}><Tags className="h-4 w-4" /> Open tag print center</Button>
                </div>
              </div>
            </div>
            <div className="sbts-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Project settings</div>
                  <h2 className="mt-2 text-lg font-extrabold text-slate-950">Workflow settings</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600">Review legacy phase-owner compatibility settings while the canonical eight-phase runtime remains authoritative.</p>
                </div>
                <Button type="button" onClick={openSettings} disabled={!canManageSettings} className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800"><Settings2 className="h-4 w-4" /> Settings</Button>
              </div>
              {!canManageSettings && <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800 ring-1 ring-amber-100">Only administrators can change phase-owner settings. Other users can view assignments and update only their assigned phase.</div>}
            </div>
          </section>
        </>
      )}

      <Dialog open={singleOpen} onOpenChange={setSingleOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Add a single blind</DialogTitle><DialogDescription>Create one independent blind record linked to this project.</DialogDescription></DialogHeader>
          <FieldGrid draft={blindDraft} setDraft={setBlindDraft} />
          {!canAddCurrentBlind && <div className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800 ring-1 ring-amber-100">This phase is assigned to another owner, so your current account can only view it.</div>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setSingleOpen(false)}>Cancel</Button><Button type="button" onClick={submitSingle} disabled={addBlindMutation.isPending || !canAddCurrentBlind}>Save blind</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingOpen} onOpenChange={setEditingOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Edit blind record</DialogTitle><DialogDescription>Only configured phase assignees or administrators can update the current workflow phase. The phase itself remains controlled by workflow progress, not by Add Blind.</DialogDescription></DialogHeader>
          <FieldGrid draft={editingDraft} setDraft={setEditingDraft} lockTag />
          {!canSaveEditingBlind && <div className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800 ring-1 ring-amber-100">This workflow phase is assigned to another person. Ask an administrator to update Project phase owners if you need access.</div>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setEditingOpen(false)}>Cancel</Button><Button type="button" onClick={submitEdit} disabled={updateBlindMutation.isPending || !canSaveEditingBlind}>Update blind</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Bulk add blinds from Excel</DialogTitle><DialogDescription>Paste rows copied from Excel. Column order remains compatible with the existing Excel template. Legacy Slip Blind approval columns are imported as historical metadata only; the canonical final approval chain is generated by the server workflow.</DialogDescription></DialogHeader>
          <div className="rounded-2xl bg-cyan-50/70 p-4 ring-1 ring-cyan-100">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-700">Paste format guide</div>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">Use one row per blind. Copy directly from Excel using this exact column order; the example below is visual guidance and can be loaded into the paste box for a quick test.</p>
              </div>
              <Button type="button" variant="outline" className="shrink-0 rounded-xl bg-white" onClick={() => setBulkText(bulkPasteExampleRow)}>Load example</Button>
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl bg-white ring-1 ring-cyan-100">
              <Table>
                <TableHeader><TableRow>{bulkPasteColumns.map((column) => <TableHead key={column} className="whitespace-nowrap text-[11px]">{column}</TableHead>)}</TableRow></TableHeader>
                <TableBody><TableRow>{bulkPasteExampleRow.split("\t").map((cell, index) => <TableCell key={`${cell}-${index}`} className="whitespace-nowrap text-xs font-semibold text-slate-700">{cell}</TableCell>)}</TableRow></TableBody>
              </Table>
            </div>
          </div>
          <Textarea className="min-h-44 font-mono text-xs" value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={bulkPasteExampleRow} />
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex items-center justify-between gap-3"><div className="text-sm font-extrabold text-slate-950">Preview: {bulkPreview.parsed.length} valid rows</div>{bulkPreview.errors.length > 0 && <div className="text-xs font-bold text-red-600">{bulkPreview.errors.length} row issues</div>}</div>
            {bulkPreview.errors.length > 0 && <div className="mt-3 space-y-1 text-xs font-semibold text-red-700">{bulkPreview.errors.slice(0, 4).map((error) => <div key={error}>{error}</div>)}</div>}
            {bulkPreview.parsed.length > 0 && !canImportBulk && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800 ring-1 ring-amber-100">Bulk creation starts every Blind in the preparation workflow phase. Only users assigned to that phase, or administrators, can import new rows.</div>}
            {bulkPreview.parsed.length > 0 && <div className="mt-4 max-h-56 overflow-auto rounded-xl bg-white ring-1 ring-slate-100"><Table><TableHeader><TableRow><TableHead>Tag</TableHead><TableHead>Type</TableHead><TableHead>Size</TableHead><TableHead>Rate</TableHead><TableHead>Equipment</TableHead><TableHead>Legacy metadata</TableHead></TableRow></TableHeader><TableBody>{bulkPreview.parsed.slice(0, 8).map((blind) => <TableRow key={blind.tag}><TableCell>{blind.tag}</TableCell><TableCell>{blind.type}</TableCell><TableCell>{blind.size}</TableCell><TableCell>{blind.rate || "—"}</TableCell><TableCell>{blind.equipment || "—"}</TableCell><TableCell>{blind.type === "Slip Blind" ? `${blind.slipMetalForemanApproved ? "Prior approval recorded" : "No prior approval"} / ${blind.slipBlindMerged ? "Merged flag" : "No merge flag"}` : "N/A"}</TableCell></TableRow>)}</TableBody></Table></div>}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button><Button type="button" onClick={submitBulk} disabled={bulkAddMutation.isPending || !canImportBulk}>Import rows</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Project workflow settings</DialogTitle><DialogDescription>Maintain the five-phase compatibility assignments used by legacy reports. Canonical eight-phase permissions and conditional approvals are controlled in Workflow & Safety Settings.</DialogDescription></DialogHeader>
          <div className="mb-4 rounded-2xl bg-cyan-50/70 p-4 ring-1 ring-cyan-100">
            <label className="flex items-start gap-3">
              <Checkbox checked={slipBlindGateRequiredDraft} disabled={!canManageSettings} onCheckedChange={(checked) => setSlipBlindGateRequiredDraft(checked === true)} />
              <span><span className="block text-sm font-extrabold text-slate-950">Legacy Slip Blind metadata flag</span><span className="mt-1 block text-xs font-bold leading-5 text-slate-600">Compatibility only. It no longer blocks record creation; the runtime adds Metal Foreman as a conditional final approval when configured globally.</span></span>
            </label>
          </div>
          <div className="space-y-3">
            {settingsDraft.map((owner) => {
              const availableForPhase = assignableUsers.filter((candidate) => !owner.owners.some((selected) => selected.openId === candidate.openId));
              return (
                <div key={owner.phase} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Workflow phase</div>
                      <div className="mt-2 font-extrabold text-slate-950">{owner.phase}</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">Only selected workers can update this phase. Specialty configuration belongs here, not inside the work screen.</p>
                      <label className="mt-3 flex items-center gap-2 text-xs font-extrabold text-slate-600">Phase color
                        <input type="color" value={owner.phaseColor} disabled={!canManageSettings} onChange={(event) => setSettingsDraft((current) => current.map((item) => item.phase === owner.phase ? { ...item, phaseColor: event.target.value } : item))} className="h-9 w-14 rounded-xl border border-slate-200 bg-white p-1" />
                      </label>
                    </div>
                    <Select disabled={!canManageSettings || availableForPhase.length === 0} onValueChange={(openId) => {
                      const assignee = assignableUsers.find((candidate) => candidate.openId === openId);
                      if (assignee) addAssigneeToPhase(owner.phase, assignee);
                    }}>
                      <SelectTrigger className="w-full bg-white lg:w-72"><SelectValue placeholder={availableForPhase.length ? "Add signed-in person" : "No more users"} /></SelectTrigger>
                      <SelectContent>{availableForPhase.map((candidate) => <SelectItem key={candidate.openId} value={candidate.openId}>{candidate.name}{candidate.email ? ` · ${candidate.email}` : ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {owner.owners.length === 0 && <div className="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-500 ring-1 ring-slate-200">No dedicated assignee yet</div>}
                    {owner.owners.map((assignee) => (
                      <div key={assignee.openId} className="flex items-center gap-2 rounded-full bg-white px-2 py-1.5 ring-1 ring-slate-200">
                        <Avatar className="h-8 w-8">
                          {assignee.avatarUrl && <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />}
                          <AvatarFallback className="text-[10px] font-extrabold">{initials(assignee.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="max-w-40 truncate text-xs font-extrabold text-slate-950">{assignee.name}</div>
                          {assignee.email && <div className="max-w-40 truncate text-[10px] font-semibold text-slate-500">{assignee.email}</div>}
                        </div>
                        {canManageSettings && <Button type="button" variant="ghost" size="sm" className="h-7 w-7 rounded-full p-0" onClick={() => removeAssigneeFromPhase(owner.phase, assignee.openId)}><X className="h-3.5 w-3.5" /></Button>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button type="button" onClick={submitSettings} disabled={settingsMutation.isPending || !canManageSettings}>Save settings</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
