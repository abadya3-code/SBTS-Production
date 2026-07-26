import { useEffect, useState } from "react";
import { Activity, ClipboardCheck, FileWarning, Pencil, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Kind = "defect" | "punch" | "ndt" | null;
const severity = ["low", "medium", "high", "critical"] as const;
const defectStatuses = ["open", "under_review", "accepted_as_is", "repair_required", "closed", "transferred", "cancelled"] as const;
const punchStatuses = ["open", "in_progress", "ready_for_verification", "closed", "transferred", "cancelled"] as const;
const ndtStatuses = ["planned", "in_progress", "passed", "failed", "retest_required", "cancelled"] as const;

function badge(status: string) {
  if (["closed", "accepted_as_is", "transferred", "passed", "cancelled"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["critical", "failed", "repair_required", "retest_required"].includes(status)) return "border-red-200 bg-red-50 text-red-800";
  if (["under_review", "ready_for_verification", "in_progress"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-border bg-muted/40 text-muted-foreground";
}

export function QualityGovernancePanel({ projectId, blindTag, currentPhaseKey, permissions, onRuntimeRefresh }: { projectId: string; blindTag: string; currentPhaseKey: string; permissions: any; onRuntimeRefresh: () => Promise<unknown> | void }) {
  const query = trpc.workflowRuntime.quality.forBlind.useQuery({ projectId, blindTag });
  const [kind, setKind] = useState<Kind>(null);
  const [editing, setEditing] = useState<any>(null);
  const open = (next: Kind, record?: any) => { setKind(next); setEditing(record ?? null); };
  const close = () => { setKind(null); setEditing(null); };
  const refresh = async () => { await query.refetch(); await onRuntimeRefresh(); };
  const defect = trpc.workflowRuntime.quality.saveDefect.useMutation({ onSuccess: async () => { toast.success("Defect notification saved."); close(); await refresh(); }, onError: (error) => toast.error(error.message) });
  const punch = trpc.workflowRuntime.quality.savePunch.useMutation({ onSuccess: async () => { toast.success("Punch item saved."); close(); await refresh(); }, onError: (error) => toast.error(error.message) });
  const ndt = trpc.workflowRuntime.quality.saveNdt.useMutation({ onSuccess: async () => { toast.success("NDT record saved."); close(); await refresh(); }, onError: (error) => toast.error(error.message) });
  const quality = query.data;
  const canWork = currentPhaseKey === "internalInspection";
  return <Card className="overflow-hidden border-border">
    <CardHeader className="border-b border-border/70 bg-muted/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4 text-blue-700" /> Defect, Punch & NDT Control</CardTitle><CardDescription>Controlled inspection quality records enforced by the Ready for Closure gate.</CardDescription></div>
        <Badge variant="outline" className={quality?.readiness.ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}>{quality?.readiness.ready ? "Quality gate ready" : "Quality actions required"}</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-5 p-4">
      {!quality?.readiness.ready && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{quality?.readiness.blockingReasons.map((reason: string) => <p key={reason}>• {reason}</p>)}</div>}
      <RecordSection title="Defect Notifications" icon={<FileWarning className="h-4 w-4 text-red-600" />} records={quality?.defects ?? []} numberKey="defectNumber" titleKey="title" statusKey="status" onAdd={canWork && permissions.canRecordDefect ? () => open("defect") : undefined} canEdit={canWork && (permissions.canRecordDefect || permissions.canReviewDefect)} onEdit={(record: any) => open("defect", record)} />
      <RecordSection title="Punch Items" icon={<ShieldCheck className="h-4 w-4 text-amber-600" />} records={quality?.punches ?? []} numberKey="punchNumber" titleKey="title" statusKey="status" onAdd={canWork && permissions.canManagePunch ? () => open("punch") : undefined} canEdit={canWork && (permissions.canManagePunch || permissions.canVerifyPunch)} onEdit={(record: any) => open("punch", record)} />
      <RecordSection title="NDT Records" icon={<Activity className="h-4 w-4 text-violet-600" />} records={quality?.ndt ?? []} numberKey="ndtNumber" titleKey="method" statusKey="status" onAdd={canWork && permissions.canRecordNdt ? () => open("ndt") : undefined} canEdit={canWork && (permissions.canRecordNdt || permissions.canReviewNdt)} onEdit={(record: any) => open("ndt", record)} />
    </CardContent>
    <QualityDialog kind={kind} record={editing} defects={quality?.defects ?? []} pending={defect.isPending || punch.isPending || ndt.isPending} onClose={close} onSave={(value: any) => {
      if (kind === "defect") defect.mutate({ ...value, projectId, blindTag, id: editing?.id, expectedRecordVersion: editing?.recordVersion });
      if (kind === "punch") punch.mutate({ ...value, projectId, blindTag, id: editing?.id, expectedRecordVersion: editing?.recordVersion });
      if (kind === "ndt") ndt.mutate({ ...value, projectId, blindTag, id: editing?.id, expectedRecordVersion: editing?.recordVersion });
    }} />
  </Card>;
}

function RecordSection({ title, icon, records, numberKey, titleKey, statusKey, onAdd, canEdit, onEdit }: any) {
  return <div className="space-y-2"><div className="flex items-center justify-between"><h4 className="flex items-center gap-2 text-sm font-bold text-foreground">{icon}{title}</h4>{onAdd && <Button size="sm" variant="outline" className="gap-2" onClick={onAdd}><Plus className="h-3.5 w-3.5" /> Add</Button>}</div>{records.length ? <div className="grid gap-2 lg:grid-cols-2">{records.map((record: any) => <div key={record.id} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{record[numberKey]}</p><p className="mt-1 text-sm font-bold text-foreground">{record[titleKey]}</p></div><Badge variant="outline" className={badge(record[statusKey])}>{String(record[statusKey]).replaceAll("_", " ")}</Badge></div>{record.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{record.description}</p>}{canEdit && <Button size="sm" variant="ghost" className="mt-2 gap-2" onClick={() => onEdit(record)}><Pencil className="h-3.5 w-3.5" /> Review / Update</Button>}</div>)}</div> : <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No records.</div>}</div>;
}

function QualityDialog({ kind, record, defects, pending, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (!kind) return;
    if (kind === "defect") setForm({ title: record?.title || "", description: record?.description || "", severity: record?.severity || "medium", status: record?.status || "open", disposition: record?.disposition || "", requiresRepair: record?.requiresRepair === 1, requiresNdt: record?.requiresNdt === 1, assignedToOpenId: record?.assignedToOpenId || "", dueAt: toLocal(record?.dueAt) });
    if (kind === "punch") setForm({ defectId: record?.defectId ? String(record.defectId) : "none", title: record?.title || "", description: record?.description || "", category: record?.category || "", severity: record?.severity || "medium", mandatory: record ? record.mandatory === 1 : true, status: record?.status || "open", ownerOpenId: record?.ownerOpenId || "", targetDate: toLocal(record?.targetDate), verificationNotes: record?.verificationNotes || "", transferReference: record?.transferReference || "" });
    if (kind === "ndt") setForm({ defectId: record?.defectId ? String(record.defectId) : "none", method: record?.method || "VT", procedureReference: record?.procedureReference || "", acceptanceCriteria: record?.acceptanceCriteria || "", status: record?.status || "planned", result: record?.result || "", reportNumber: record?.reportNumber || "", performedAt: toLocal(record?.performedAt) });
  }, [kind, record]);
  if (!kind) return null;
  const save = () => {
    if (kind === "defect") onSave({ ...form, disposition: form.disposition || null, assignedToOpenId: form.assignedToOpenId || null, dueAt: form.dueAt ? new Date(form.dueAt) : null });
    if (kind === "punch") onSave({ ...form, defectId: form.defectId === "none" ? null : Number(form.defectId), description: form.description || null, category: form.category || null, ownerOpenId: form.ownerOpenId || null, targetDate: form.targetDate ? new Date(form.targetDate) : null, verificationNotes: form.verificationNotes || null, transferReference: form.transferReference || null });
    if (kind === "ndt") onSave({ ...form, defectId: form.defectId === "none" ? null : Number(form.defectId), procedureReference: form.procedureReference || null, acceptanceCriteria: form.acceptanceCriteria || null, result: form.result || null, reportNumber: form.reportNumber || null, performedAt: form.performedAt ? new Date(form.performedAt) : null });
  };
  return <Dialog open onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{record ? "Update" : "Create"} {kind === "defect" ? "Defect Notification" : kind === "punch" ? "Punch Item" : "NDT Record"}</DialogTitle><DialogDescription>Every change is versioned and enforced by role-specific backend permissions.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
    {kind === "defect" && <><Field label="Title"><Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><SelectField label="Severity" value={form.severity} options={severity} onChange={(value) => setForm({ ...form, severity: value })} /><Field label="Description" full><Textarea rows={4} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field><SelectField label="Status" value={form.status} options={defectStatuses} onChange={(value) => setForm({ ...form, status: value })} /><Field label="Assigned Open ID"><Input value={form.assignedToOpenId || ""} onChange={(e) => setForm({ ...form, assignedToOpenId: e.target.value })} /></Field><Field label="Disposition" full><Textarea rows={3} value={form.disposition || ""} onChange={(e) => setForm({ ...form, disposition: e.target.value })} /></Field><Check label="Repair required" checked={form.requiresRepair} onChange={(value) => setForm({ ...form, requiresRepair: value })} /><Check label="NDT required" checked={form.requiresNdt} onChange={(value) => setForm({ ...form, requiresNdt: value })} /></>}
    {kind === "punch" && <><Field label="Title"><Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><SelectField label="Linked defect" value={form.defectId} options={["none", ...defects.map((row: any) => String(row.id))]} labels={Object.fromEntries(defects.map((row: any) => [String(row.id), `${row.defectNumber} · ${row.title}`]))} onChange={(value) => setForm({ ...form, defectId: value })} /><SelectField label="Severity" value={form.severity} options={severity} onChange={(value) => setForm({ ...form, severity: value })} /><SelectField label="Status" value={form.status} options={punchStatuses} onChange={(value) => setForm({ ...form, status: value })} /><Field label="Description" full><Textarea rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field><Field label="Verification notes" full><Textarea rows={3} value={form.verificationNotes || ""} onChange={(e) => setForm({ ...form, verificationNotes: e.target.value })} /></Field><Field label="Transfer reference"><Input value={form.transferReference || ""} onChange={(e) => setForm({ ...form, transferReference: e.target.value })} /></Field><Check label="Mandatory" checked={form.mandatory} onChange={(value) => setForm({ ...form, mandatory: value })} /></>}
    {kind === "ndt" && <><SelectField label="Linked defect" value={form.defectId} options={["none", ...defects.map((row: any) => String(row.id))]} labels={Object.fromEntries(defects.map((row: any) => [String(row.id), `${row.defectNumber} · ${row.title}`]))} onChange={(value) => setForm({ ...form, defectId: value })} /><Field label="Method"><Input value={form.method || ""} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="VT / PT / MT / UT / RT" /></Field><SelectField label="Status" value={form.status} options={ndtStatuses} onChange={(value) => setForm({ ...form, status: value })} /><Field label="Report number"><Input value={form.reportNumber || ""} onChange={(e) => setForm({ ...form, reportNumber: e.target.value })} /></Field><Field label="Procedure reference"><Input value={form.procedureReference || ""} onChange={(e) => setForm({ ...form, procedureReference: e.target.value })} /></Field><Field label="Acceptance criteria"><Input value={form.acceptanceCriteria || ""} onChange={(e) => setForm({ ...form, acceptanceCriteria: e.target.value })} /></Field><Field label="Result" full><Textarea rows={4} value={form.result || ""} onChange={(e) => setForm({ ...form, result: e.target.value })} /></Field></>}
  </div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !(form.title || form.method)} onClick={save}>{pending ? "Saving..." : "Save Controlled Record"}</Button></DialogFooter></DialogContent></Dialog>;
}
function toLocal(value: unknown) { if (!value) return ""; const date = new Date(value as any); return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function Field({ label, children, full }: any) { return <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}><Label>{label}</Label>{children}</div>; }
function Check({ label, checked, onChange }: any) { return <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"><Checkbox checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} />{label}</label>; }
function SelectField({ label, value, options, labels = {}, onChange }: any) { return <Field label={label}><Select value={value || options[0]} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((option: string) => <SelectItem key={option} value={option}>{labels[option] || option.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></Field>; }
