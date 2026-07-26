import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  FileText,
  Gauge,
  Layers3,
  LockKeyhole,
  Pencil,
  Shield,
  TestTube2,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InspectionActivitiesPanel } from "@/components/workflow/InspectionActivitiesPanel";
import { QualityGovernancePanel } from "@/components/workflow/QualityGovernancePanel";
import { CertificateGovernancePanel } from "@/components/workflow/CertificateGovernancePanel";

type WorkflowOperationsPanelProps = {
  projectId: string;
  blindTag: string;
  runtime: any;
  policy: any;
  toggles?: any;
  onRefresh: () => Promise<unknown> | void;
};

type EditorKind = "permit" | "loto" | "gas" | "torque" | "leak" | "entry" | "approval" | "evidence" | null;

const statusOptions = ["draft", "active", "valid", "expired", "closed", "cancelled", "rejected"] as const;
const torqueStatuses = ["draft", "submitted", "accepted", "rejected"] as const;
const leakStatuses = ["draft", "in_progress", "passed", "failed", "cancelled"] as const;

function toLocalDateTime(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function optionalDate(value: string): Date | null {
  return value ? new Date(value) : null;
}

function optionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusClass(status: string) {
  if (["active", "valid", "accepted", "passed", "authorized", "approved", "closed"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (["rejected", "failed", "expired", "cancelled"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-800";
  }
  if (["submitted", "ready", "in_progress", "pending"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

function SectionHeader({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <CardHeader className="border-b border-border/70 bg-muted/20 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
        {action}
      </div>
    </CardHeader>
  );
}

export function WorkflowOperationsPanel({ projectId, blindTag, runtime, policy, toggles, onRefresh }: WorkflowOperationsPanelProps) {
  const [editor, setEditor] = useState<EditorKind>(null);
  const [editing, setEditing] = useState<any>(null);
  const records = runtime?.records ?? {};
  const permissions = runtime?.permissions ?? {};

  const refresh = async () => { await onRefresh(); };
  const open = (kind: EditorKind, record?: any) => { setEditing(record ?? null); setEditor(kind); };
  const close = () => { setEditor(null); setEditing(null); };

  const permitMutation = trpc.workflowRuntime.permit.save.useMutation({
    onSuccess: async () => { toast.success("Permit record saved."); close(); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const lotoMutation = trpc.workflowRuntime.loto.save.useMutation({
    onSuccess: async () => { toast.success("LOTO record saved."); close(); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const gasMutation = trpc.workflowRuntime.gasTest.create.useMutation({
    onSuccess: async () => { toast.success("Gas-test record saved and evaluated against plant limits."); close(); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const torqueMutation = trpc.workflowRuntime.torque.save.useMutation({
    onSuccess: async () => { toast.success("Torque record saved."); close(); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const leakMutation = trpc.workflowRuntime.leakTest.save.useMutation({
    onSuccess: async () => { toast.success("Leak/service-test record saved."); close(); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const entryMutation = trpc.workflowRuntime.isolationPackage.entryReadiness.useMutation({
    onSuccess: async () => { toast.success("Entry-readiness record saved."); close(); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const approvalMutation = trpc.workflowRuntime.approval.record.useMutation({
    onSuccess: async () => { toast.success("Approval decision recorded."); close(); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const evidenceUploadMutation = trpc.workflowRuntime.evidence.upload.useMutation({
    onSuccess: async () => { toast.success("Evidence uploaded to the current phase."); close(); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const evidenceRemoveMutation = trpc.workflowRuntime.evidence.remove.useMutation({
    onSuccess: async () => { toast.success("Evidence removed."); await refresh(); },
    onError: (error) => toast.error(error.message),
  });

  const installationTorque = (records.torque ?? []).find((row: any) => row.stage === "installation");
  const reinstatementTorque = (records.torque ?? []).find((row: any) => row.stage === "reinstatement");
  const latestEntryByPackage = useMemo(() => {
    const map = new Map<string, any>();
    for (const row of records.entryReadiness ?? []) if (!map.has(row.packageId)) map.set(row.packageId, row);
    return map;
  }, [records.entryReadiness]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
        Every action below writes to the Sprint 3 workflow domain tables, is permission-protected, re-evaluates the server gate, and refreshes the live Blind runtime.
      </div>

      {(toggles?.enablePtw !== 0) && (
        <Card className="overflow-hidden border-border">
          <SectionHeader icon={<FileText className="h-4 w-4 text-primary" />} title="Permits" description="PTW and Line Breaking permits used by the transition guard." action={permissions.canManagePermit ? <Button size="sm" className="gap-2" onClick={() => open("permit")}><FilePlus2 className="h-4 w-4" /> Add Permit</Button> : undefined} />
          <CardContent className="p-4">
            {(records.permits ?? []).length ? <div className="grid gap-3 lg:grid-cols-2">{records.permits.map((permit: any) => (
              <div key={permit.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{permit.type}</p><p className="mt-1 font-bold text-foreground">{permit.number}</p></div><Badge variant="outline" className={statusClass(permit.status)}>{permit.status}</Badge></div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground"><span>Valid from<br /><strong className="text-foreground">{permit.validFrom ? new Date(permit.validFrom).toLocaleString() : "—"}</strong></span><span>Valid until<br /><strong className="text-foreground">{permit.validUntil ? new Date(permit.validUntil).toLocaleString() : "—"}</strong></span></div>
                {permit.notes && <p className="mt-3 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">{permit.notes}</p>}
                {permissions.canManagePermit && <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => open("permit", permit)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
              </div>
            ))}</div> : <EmptyState text="No PTW or Line Breaking Permit has been recorded." />}
          </CardContent>
        </Card>
      )}

      {(toggles?.enableLoto !== 0) && (
        <Card className="overflow-hidden border-border">
          <SectionHeader icon={<LockKeyhole className="h-4 w-4 text-amber-600" />} title="Lockout / Tagout" description="Energy-isolation certificate, lock numbers and zero-energy verification." action={permissions.canManageLoto ? <Button size="sm" className="gap-2" onClick={() => open("loto", records.loto)}><Pencil className="h-4 w-4" /> {records.loto ? "Update LOTO" : "Add LOTO"}</Button> : undefined} />
          <CardContent className="p-4">{records.loto ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Certificate" value={records.loto.certificateNumber} /><Metric label="Status" value={records.loto.status} /><Metric label="Zero energy" value={records.loto.zeroEnergyVerified ? "Verified" : "Not verified"} /><Metric label="Locks" value={(records.loto.lockNumbers ?? []).join(", ") || "—"} /></div> : <EmptyState text="No LOTO record has been stored." />}</CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-border">
        <SectionHeader icon={<TestTube2 className="h-4 w-4 text-cyan-700" />} title="Gas Tests" description="Authorized atmospheric tests with instrument calibration and automatic validity." action={permissions.canRecordGasTest ? <Button size="sm" className="gap-2" onClick={() => open("gas")}><FilePlus2 className="h-4 w-4" /> Add Gas Test</Button> : undefined} />
        <CardContent className="p-4">{(records.gasTests ?? []).length ? <div className="grid gap-3 lg:grid-cols-2">{records.gasTests.map((test: any) => (
          <div key={test.id} className="rounded-xl border border-border p-4">
            <div className="flex items-start justify-between"><div><p className="font-bold capitalize text-foreground">{test.purpose}</p><p className="text-xs text-muted-foreground">{test.testerName || "Authorized tester"}</p></div><Badge variant="outline" className={statusClass(test.status)}>{test.status}</Badge></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="O₂" value={test.oxygenPercent == null ? "—" : `${test.oxygenPercent}%`} /><Metric label="LEL" value={test.lelPercent == null ? "—" : `${test.lelPercent}%`} /><Metric label="H₂S" value={test.h2sPpm == null ? "—" : `${test.h2sPpm} ppm`} /><Metric label="CO" value={test.coPpm == null ? "—" : `${test.coPpm} ppm`} /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><Metric label="Instrument" value={test.instrumentId || "—"} /><Metric label="Valid until" value={test.validUntil ? new Date(test.validUntil).toLocaleString() : "—"} /></div>
          </div>
        ))}</div> : <EmptyState text="No gas test has been stored." />}</CardContent>
      </Card>

      {(toggles?.enableTorqueRecords !== 0) && (
        <Card className="overflow-hidden border-border">
          <SectionHeader icon={<Wrench className="h-4 w-4 text-primary" />} title="Torque Records" description="Installation and reinstatement tightening records, including tool calibration and passes." />
          <CardContent className="grid gap-4 p-4 lg:grid-cols-2">
            <TorqueSummary title="Installation Torque" record={installationTorque} canEdit={permissions.canManageTorque} onEdit={() => open("torque", installationTorque ?? { stage: "installation" })} />
            <TorqueSummary title="Reinstatement Torque" record={reinstatementTorque} canEdit={permissions.canManageTorque} onEdit={() => open("torque", reinstatementTorque ?? { stage: "reinstatement" })} />
          </CardContent>
        </Card>
      )}

      {(toggles?.enableInspectionRecords !== 0) && <InspectionActivitiesPanel projectId={projectId} blindTag={blindTag} currentPhaseKey={runtime.runtime.currentPhaseKey} canManage={Boolean(permissions.canManageInspection)} canApprove={Boolean(permissions.canApproveInspection)} onRuntimeRefresh={refresh} />}
      {(toggles?.enableInspectionRecords !== 0) && <QualityGovernancePanel projectId={projectId} blindTag={blindTag} currentPhaseKey={runtime.runtime.currentPhaseKey} permissions={permissions} onRuntimeRefresh={refresh} />}

      <Card className="overflow-hidden border-border">
        <SectionHeader icon={<Gauge className="h-4 w-4 text-emerald-700" />} title="Leak / Service Test" description="Controlled pressurization and independent acceptance before return to service." action={permissions.canManageLeakTest ? <Button size="sm" className="gap-2" onClick={() => open("leak", records.leakTest)}><Pencil className="h-4 w-4" /> {records.leakTest ? "Update Test" : "Add Test"}</Button> : undefined} />
        <CardContent className="p-4">{records.leakTest ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Status" value={records.leakTest.status} /><Metric label="Type" value={records.leakTest.testType || "—"} /><Metric label="Pressure" value={records.leakTest.testPressure ? `${records.leakTest.testPressure} ${records.leakTest.pressureUnit || ""}` : "—"} /><Metric label="Duration" value={records.leakTest.durationMinutes == null ? "—" : `${records.leakTest.durationMinutes} min`} /><Metric label="Leak observed" value={records.leakTest.noLeakObserved ? "No" : "Yes / Not confirmed"} /></div> : <EmptyState text="No leak or service test has been recorded." />}</CardContent>
      </Card>

      <Card className="overflow-hidden border-border">
        <SectionHeader icon={<Layers3 className="h-4 w-4 text-violet-700" />} title="Isolation Package & Entry Readiness" description="Package-level readiness is derived from all linked required blinds." />
        <CardContent className="space-y-3 p-4">{(records.isolationPackages ?? []).length ? records.isolationPackages.map((pkg: any) => {
          const readiness = latestEntryByPackage.get(pkg.id);
          return <div key={pkg.id} className="rounded-xl border border-border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-foreground">{pkg.id}</p><p className="text-xs text-muted-foreground">{pkg.equipment}</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className={statusClass(pkg.status)}>{pkg.status.replaceAll("_", " ")}</Badge>{readiness && <Badge variant="outline" className={statusClass(readiness.status)}>Entry {readiness.status}</Badge>}</div></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><BooleanMetric label="Blinds active" value={readiness?.allRequiredBlindsActive} /><BooleanMetric label="LOTO active" value={readiness?.lotoActive} /><BooleanMetric label="Gas acceptable" value={readiness?.gasTestAcceptable} /><BooleanMetric label="Operations approved" value={readiness?.operationsApproved} /></div>{(permissions.canPrepareEntry || permissions.canAuthorizeEntry) && <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => open("entry", { package: pkg, readiness })}><ClipboardCheck className="h-4 w-4" /> Update Entry Readiness</Button>}</div>;
        }) : <EmptyState text="This blind is not linked to an Isolation Package. Use the Isolation Packages page to create and link one." />}</CardContent>
      </Card>

      <Card className="overflow-hidden border-border">
        <SectionHeader icon={<Shield className="h-4 w-4 text-primary" />} title="Final Approval Chain" description="Sequential approvals become actionable in the final workflow phase." />
        <CardContent className="space-y-3 p-4">{(runtime.approvals ?? []).map((step: any) => <div key={step.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold capitalize text-foreground">{step.roleKey.replace(/([A-Z])/g, " $1")}</p><p className="text-xs text-muted-foreground">Sequence {step.sequence}{step.conditional ? " · Conditional" : ""}{step.approvedByName ? ` · ${step.approvedByName}` : ""}</p></div><div className="flex items-center gap-2"><Badge variant="outline" className={statusClass(step.status)}>{step.status.replaceAll("_", " ")}</Badge>{permissions.canRecordApproval && step.status === "pending" && runtime.runtime.currentPhaseKey === "finalApprovalReturnToService" && <Button size="sm" onClick={() => open("approval", step)}>Review</Button>}</div></div>)}</CardContent>
      </Card>

      <CertificateGovernancePanel projectId={projectId} blindTag={blindTag} permissions={permissions} />

      {(toggles?.enablePhotoEvidence !== 0) && <Card className="overflow-hidden border-border">
        <SectionHeader icon={<Upload className="h-4 w-4 text-primary" />} title="Current Phase Evidence" description={`Files are attached to ${runtime.currentPhase.label}.`} action={permissions.canManageEvidence ? <Button size="sm" className="gap-2" onClick={() => open("evidence")}><Upload className="h-4 w-4" /> Upload Evidence</Button> : undefined} />
        <CardContent className="p-4">{(runtime.evidence ?? []).length ? <div className="space-y-2">{runtime.evidence.map((file: any) => <div key={file.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><a href={file.fileUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{file.fileName}</p><p className="text-xs text-muted-foreground">{file.category} · {file.mimeType || "file"}</p></a>{permissions.canManageEvidence && <Button variant="ghost" size="icon" aria-label="Remove evidence" disabled={evidenceRemoveMutation.isPending} onClick={() => { if (window.confirm(`Remove ${file.fileName}?`)) evidenceRemoveMutation.mutate({ projectId, blindTag, evidenceId: file.id }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div>)}</div> : <EmptyState text="No evidence is attached to the current phase." />}</CardContent>
      </Card>}

      <PermitDialog open={editor === "permit"} record={editing} pending={permitMutation.isPending} onClose={close} onSave={(value: any) => permitMutation.mutate({ ...value, projectId, blindTag })} />
      <LotoDialog open={editor === "loto"} record={editing} pending={lotoMutation.isPending} onClose={close} onSave={(value: any) => lotoMutation.mutate({ ...value, projectId, blindTag })} />
      <GasTestDialog open={editor === "gas"} policy={policy} pending={gasMutation.isPending} onClose={close} onSave={(value: any) => gasMutation.mutate({ ...value, projectId, blindTag })} />
      <TorqueDialog open={editor === "torque"} record={editing} policy={policy} permissions={permissions} pending={torqueMutation.isPending} onClose={close} onSave={(value: any) => torqueMutation.mutate({ ...value, projectId, blindTag })} />
      <LeakTestDialog open={editor === "leak"} record={editing} pending={leakMutation.isPending} onClose={close} onSave={(value: any) => leakMutation.mutate({ ...value, projectId, blindTag })} />
      <EntryReadinessDialog open={editor === "entry"} record={editing} canAuthorize={permissions.canAuthorizeEntry} pending={entryMutation.isPending} onClose={close} onSave={(value: any) => entryMutation.mutate(value)} />
      <ApprovalDialog open={editor === "approval"} step={editing} pending={approvalMutation.isPending} onClose={close} onSave={(value: any) => approvalMutation.mutate({ ...value, projectId, blindTag, roleKey: editing.roleKey })} />
      <EvidenceDialog open={editor === "evidence"} policy={policy} pending={evidenceUploadMutation.isPending} onClose={close} onSave={(value: any) => evidenceUploadMutation.mutate({ ...value, projectId, blindTag, phaseKey: runtime.runtime.currentPhaseKey })} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg bg-muted/40 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><div className="mt-1 text-sm font-semibold text-foreground">{value}</div></div>;
}

function BooleanMetric({ label, value }: { label: string; value: boolean | null | undefined }) {
  return <div className={`rounded-lg border p-2 text-xs font-semibold ${value ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{value ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : null}{label}: {value ? "Yes" : "No"}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function TorqueSummary({ title, record, canEdit, onEdit }: { title: string; record: any; canEdit: boolean; onEdit: () => void }) {
  return <div className="rounded-xl border border-border p-4"><div className="flex items-start justify-between"><div><p className="font-bold text-foreground">{title}</p><p className="text-xs text-muted-foreground">{record?.toolType || "No record"}</p></div>{record && <Badge variant="outline" className={statusClass(record.status)}>{record.status}</Badge>}</div>{record ? <div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Target" value={record.targetTorque ? `${record.targetTorque} ${record.torqueUnit}` : "—"} /><Metric label="Actual" value={record.actualTorque ? `${record.actualTorque} ${record.torqueUnit}` : "—"} /><Metric label="Pump pressure" value={record.pumpPressure ? `${record.pumpPressure} ${record.pumpPressureUnit || ""}` : "—"} /><Metric label="Calibration expiry" value={record.calibrationExpiry ? new Date(record.calibrationExpiry).toLocaleDateString() : "—"} /></div> : <EmptyState text="No torque record has been stored." />}{canEdit && <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={onEdit}><Pencil className="h-4 w-4" /> {record ? "Update Record" : "Create Record"}</Button>}</div>;
}

function FormGrid({ children }: { children: React.ReactNode }) { return <div className="grid gap-4 sm:grid-cols-2">{children}</div>; }
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <div className={`space-y-1.5 ${className}`}><Label>{label}</Label>{children}</div>; }
function SelectField({ value, onValueChange, options }: { value: string; onValueChange: (value: string) => void; options: readonly string[] }) { return <Select value={value} onValueChange={onValueChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>; }

function PermitDialog({ open, record, pending, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (!open) return;
    setForm({ id: record?.id, permitType: record?.type || "PTW", permitNumber: record?.number || "", status: record?.status || "active", validFrom: toLocalDateTime(record?.validFrom), validUntil: toLocalDateTime(record?.validUntil), notes: record?.notes || "" });
  }, [open, record]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Permit Record</DialogTitle><DialogDescription>Create or update the PTW / Line Breaking permit used by the workflow gate.</DialogDescription></DialogHeader><FormGrid><Field label="Permit type"><SelectField value={form.permitType || "PTW"} onValueChange={(value) => setForm({ ...form, permitType: value })} options={["PTW", "Line Breaking", "Confined Space"]} /></Field><Field label="Status"><SelectField value={form.status || "active"} onValueChange={(value) => setForm({ ...form, status: value })} options={statusOptions} /></Field><Field label="Permit number"><Input value={form.permitNumber || ""} onChange={(event) => setForm({ ...form, permitNumber: event.target.value })} /></Field><Field label="Valid from"><Input type="datetime-local" value={form.validFrom || ""} onChange={(event) => setForm({ ...form, validFrom: event.target.value })} /></Field><Field label="Valid until"><Input type="datetime-local" value={form.validUntil || ""} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></Field><Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field></FormGrid><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !form.permitNumber} onClick={() => onSave({ id: form.id, permitType: form.permitType, permitNumber: form.permitNumber, status: form.status, validFrom: optionalDate(form.validFrom), validUntil: optionalDate(form.validUntil), notes: form.notes || null })}>{pending ? "Saving..." : "Save Permit"}</Button></DialogFooter></DialogContent></Dialog>;
}

function LotoDialog({ open, record, pending, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (!open) return;
    setForm({ id: record?.id, certificateNumber: record?.certificateNumber || "", status: record?.status || "active", lockNumbers: (record?.lockNumbers || []).join(", "), zeroEnergyVerified: Boolean(record?.zeroEnergyVerified), releasedAt: toLocalDateTime(record?.releasedAt), notes: record?.notes || "" });
  }, [open, record]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>LOTO Record</DialogTitle><DialogDescription>Record the controlled energy-isolation certificate and zero-energy verification.</DialogDescription></DialogHeader><FormGrid><Field label="Certificate number"><Input value={form.certificateNumber || ""} onChange={(event) => setForm({ ...form, certificateNumber: event.target.value })} /></Field><Field label="Status"><SelectField value={form.status || "active"} onValueChange={(value) => setForm({ ...form, status: value })} options={statusOptions} /></Field><Field label="Lock numbers" className="sm:col-span-2"><Input placeholder="LOCK-01, LOCK-02" value={form.lockNumbers || ""} onChange={(event) => setForm({ ...form, lockNumbers: event.target.value })} /></Field><Field label="Released at"><Input type="datetime-local" value={form.releasedAt || ""} onChange={(event) => setForm({ ...form, releasedAt: event.target.value })} /></Field><div className="flex items-center gap-3 rounded-xl border border-border p-3"><Checkbox checked={Boolean(form.zeroEnergyVerified)} onCheckedChange={(value) => setForm({ ...form, zeroEnergyVerified: value === true })} /><Label>Zero-energy condition independently verified</Label></div><Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field></FormGrid><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !form.certificateNumber} onClick={() => onSave({ id: form.id, certificateNumber: form.certificateNumber, status: form.status, lockNumbers: String(form.lockNumbers || "").split(",").map((item) => item.trim()).filter(Boolean), zeroEnergyVerified: Boolean(form.zeroEnergyVerified), releasedAt: optionalDate(form.releasedAt), notes: form.notes || null })}>{pending ? "Saving..." : "Save LOTO"}</Button></DialogFooter></DialogContent></Dialog>;
}

function GasTestDialog({ open, policy, pending, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({ testPurpose: "entry", status: "valid" });
  useEffect(() => {
    if (!open) return;
    setForm({ testPurpose: "entry", status: "valid", testedAt: toLocalDateTime(new Date()), validUntil: "", oxygenPercent: "", lelPercent: "", h2sPpm: "", coPpm: "", instrumentId: "", calibrationExpiry: "", notes: "" });
  }, [open]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Authorized Gas Test</DialogTitle><DialogDescription>Readings are validated against the configured plant limits. Default validity: {policy?.defaultGasTestValidityMinutes || 240} minutes.</DialogDescription></DialogHeader><FormGrid><Field label="Purpose"><SelectField value={form.testPurpose || "entry"} onValueChange={(value) => setForm({ ...form, testPurpose: value })} options={["lineBreaking", "entry", "deblinding", "other"]} /></Field><Field label="Status"><SelectField value={form.status || "valid"} onValueChange={(value) => setForm({ ...form, status: value })} options={statusOptions} /></Field><Field label="O₂ (%)"><Input type="number" step="0.01" value={form.oxygenPercent || ""} onChange={(event) => setForm({ ...form, oxygenPercent: event.target.value })} /></Field><Field label="LEL (%)"><Input type="number" step="0.01" value={form.lelPercent || ""} onChange={(event) => setForm({ ...form, lelPercent: event.target.value })} /></Field><Field label="H₂S (ppm)"><Input type="number" step="0.01" value={form.h2sPpm || ""} onChange={(event) => setForm({ ...form, h2sPpm: event.target.value })} /></Field><Field label="CO (ppm)"><Input type="number" step="0.01" value={form.coPpm || ""} onChange={(event) => setForm({ ...form, coPpm: event.target.value })} /></Field><Field label="Instrument ID"><Input value={form.instrumentId || ""} onChange={(event) => setForm({ ...form, instrumentId: event.target.value })} /></Field><Field label="Calibration expiry"><Input type="datetime-local" value={form.calibrationExpiry || ""} onChange={(event) => setForm({ ...form, calibrationExpiry: event.target.value })} /></Field><Field label="Tested at"><Input type="datetime-local" value={form.testedAt || ""} onChange={(event) => setForm({ ...form, testedAt: event.target.value })} /></Field><Field label="Valid until (optional)"><Input type="datetime-local" value={form.validUntil || ""} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></Field><Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field></FormGrid><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !form.instrumentId || form.oxygenPercent === "" || form.lelPercent === ""} onClick={() => onSave({ testPurpose: form.testPurpose, status: form.status, oxygenPercent: optionalNumber(form.oxygenPercent), lelPercent: optionalNumber(form.lelPercent), h2sPpm: optionalNumber(form.h2sPpm), coPpm: optionalNumber(form.coPpm), instrumentId: form.instrumentId || null, calibrationExpiry: optionalDate(form.calibrationExpiry), testedAt: optionalDate(form.testedAt), validUntil: optionalDate(form.validUntil), notes: form.notes || null })}>{pending ? "Saving..." : "Save Gas Test"}</Button></DialogFooter></DialogContent></Dialog>;
}

function TorqueDialog({ open, record, policy, permissions, pending, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (!open) return;
    const passes = Array.isArray(record?.passes) ? record.passes : [];
    setForm({ id: record?.id, stage: record?.stage || "installation", status: record?.status || "draft", procedureReference: record?.procedureReference || "", toolType: record?.toolType || "Hydraulic Torque Wrench", toolSerialNumber: record?.toolSerialNumber || "", calibrationCertificateNumber: record?.calibrationCertificateNumber || "", calibrationExpiry: toLocalDateTime(record?.calibrationExpiry), targetTorque: record?.targetTorque || "", actualTorque: record?.actualTorque || "", torqueUnit: record?.torqueUnit || policy?.defaultTorqueUnit || "N·m", pumpPressure: record?.pumpPressure || "", pumpPressureUnit: record?.pumpPressureUnit || policy?.defaultPumpPressureUnit || "psi", pass1: (passes[0] as any)?.value || "", pass2: (passes[1] as any)?.value || "", finalPass: (passes[2] as any)?.value || "", witnessOpenId: record?.witnessOpenId || "", notes: record?.notes || "" });
  }, [open, record, policy?.defaultTorqueUnit, policy?.defaultPumpPressureUnit]);
  const canSubmit = form.stage === "installation" ? permissions?.canSubmitInstallationTorque : permissions?.canSubmitReinstatementTorque;
  const canVerify = form.stage === "installation" ? permissions?.canVerifyInstallationTorque : permissions?.canVerifyReinstatementTorque;
  const allowedStatuses = Array.from(new Set([...(canSubmit ? ["draft", "submitted"] : []), ...(record?.id && canVerify ? ["accepted", "rejected"] : [])]));
  const effectiveStatuses = allowedStatuses.length ? allowedStatuses : [form.status || "draft"];
  const effectiveStatus = effectiveStatuses.includes(form.status) ? form.status : effectiveStatuses[0];
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Torque Record</DialogTitle><DialogDescription>Execution roles create and submit the record. Independent verification roles accept or reject an existing submitted record.</DialogDescription></DialogHeader><FormGrid><Field label="Stage"><SelectField value={form.stage || "installation"} onValueChange={(value) => setForm({ ...form, stage: value, status: "draft" })} options={["installation", "reinstatement"]} /></Field><Field label="Status"><SelectField value={effectiveStatus} onValueChange={(value) => setForm({ ...form, status: value })} options={effectiveStatuses} /></Field><Field label="Procedure reference"><Input value={form.procedureReference || ""} onChange={(event) => setForm({ ...form, procedureReference: event.target.value })} /></Field><Field label="Tool type"><Input value={form.toolType || ""} onChange={(event) => setForm({ ...form, toolType: event.target.value })} /></Field><Field label="Tool serial"><Input value={form.toolSerialNumber || ""} onChange={(event) => setForm({ ...form, toolSerialNumber: event.target.value })} /></Field><Field label="Calibration certificate"><Input value={form.calibrationCertificateNumber || ""} onChange={(event) => setForm({ ...form, calibrationCertificateNumber: event.target.value })} /></Field><Field label="Calibration expiry"><Input type="datetime-local" value={form.calibrationExpiry || ""} onChange={(event) => setForm({ ...form, calibrationExpiry: event.target.value })} /></Field><Field label="Witness Open ID"><Input value={form.witnessOpenId || ""} onChange={(event) => setForm({ ...form, witnessOpenId: event.target.value })} /></Field><Field label="Target torque"><Input type="number" step="0.001" value={form.targetTorque || ""} onChange={(event) => setForm({ ...form, targetTorque: event.target.value })} /></Field><Field label="Actual torque"><Input type="number" step="0.001" value={form.actualTorque || ""} onChange={(event) => setForm({ ...form, actualTorque: event.target.value })} /></Field><Field label="Torque unit"><Input value={form.torqueUnit || ""} onChange={(event) => setForm({ ...form, torqueUnit: event.target.value })} /></Field><Field label="Pump pressure"><Input type="number" step="0.001" value={form.pumpPressure || ""} onChange={(event) => setForm({ ...form, pumpPressure: event.target.value })} /></Field><Field label="Pump-pressure unit"><Input value={form.pumpPressureUnit || ""} onChange={(event) => setForm({ ...form, pumpPressureUnit: event.target.value })} /></Field><div /><Field label="Pass 1"><Input type="number" value={form.pass1 || ""} onChange={(event) => setForm({ ...form, pass1: event.target.value })} /></Field><Field label="Pass 2"><Input type="number" value={form.pass2 || ""} onChange={(event) => setForm({ ...form, pass2: event.target.value })} /></Field><Field label="Final pass"><Input type="number" value={form.finalPass || ""} onChange={(event) => setForm({ ...form, finalPass: event.target.value })} /></Field><Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field></FormGrid><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !form.toolType || !form.torqueUnit} onClick={() => onSave({ id: form.id, stage: form.stage, status: effectiveStatus, procedureReference: form.procedureReference || null, toolType: form.toolType, toolSerialNumber: form.toolSerialNumber || null, calibrationCertificateNumber: form.calibrationCertificateNumber || null, calibrationExpiry: optionalDate(form.calibrationExpiry), targetTorque: optionalNumber(form.targetTorque), actualTorque: optionalNumber(form.actualTorque), torqueUnit: form.torqueUnit, pumpPressure: optionalNumber(form.pumpPressure), pumpPressureUnit: form.pumpPressureUnit || null, passes: [{ name: "Pass 1", value: optionalNumber(form.pass1) }, { name: "Pass 2", value: optionalNumber(form.pass2) }, { name: "Final Pass", value: optionalNumber(form.finalPass) }].filter((row) => row.value != null), witnessOpenId: form.witnessOpenId || null, notes: form.notes || null })}>{pending ? "Saving..." : "Save Torque Record"}</Button></DialogFooter></DialogContent></Dialog>;
}

function LeakTestDialog({ open, record, pending, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (!open) return;
    setForm({ status: record?.status || "draft", testType: record?.testType || "Service Leak Test", testMedium: record?.testMedium || "Process / approved medium", testPressure: record?.testPressure || "", pressureUnit: record?.pressureUnit || "bar", durationMinutes: record?.durationMinutes || "", noLeakObserved: Boolean(record?.noLeakObserved), notes: record?.notes || "" });
  }, [open, record]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Leak / Service Test</DialogTitle><DialogDescription>Record controlled pressurization and the independent no-leak result.</DialogDescription></DialogHeader><FormGrid><Field label="Status"><SelectField value={form.status || "draft"} onValueChange={(value) => setForm({ ...form, status: value })} options={leakStatuses} /></Field><Field label="Test type"><Input value={form.testType || ""} onChange={(event) => setForm({ ...form, testType: event.target.value })} /></Field><Field label="Medium"><Input value={form.testMedium || ""} onChange={(event) => setForm({ ...form, testMedium: event.target.value })} /></Field><Field label="Pressure"><Input type="number" step="0.001" value={form.testPressure || ""} onChange={(event) => setForm({ ...form, testPressure: event.target.value })} /></Field><Field label="Pressure unit"><Input value={form.pressureUnit || ""} onChange={(event) => setForm({ ...form, pressureUnit: event.target.value })} /></Field><Field label="Duration (minutes)"><Input type="number" value={form.durationMinutes || ""} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })} /></Field><div className="flex items-center gap-3 rounded-xl border border-border p-3 sm:col-span-2"><Checkbox checked={Boolean(form.noLeakObserved)} onCheckedChange={(value) => setForm({ ...form, noLeakObserved: value === true })} /><Label>No leakage observed throughout the required duration</Label></div><Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field></FormGrid><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending} onClick={() => onSave({ status: form.status, testType: form.testType || null, testMedium: form.testMedium || null, testPressure: optionalNumber(form.testPressure), pressureUnit: form.pressureUnit || null, durationMinutes: optionalNumber(form.durationMinutes), noLeakObserved: Boolean(form.noLeakObserved), notes: form.notes || null })}>{pending ? "Saving..." : "Save Test"}</Button></DialogFooter></DialogContent></Dialog>;
}

function EntryReadinessDialog({ open, record, canAuthorize, pending, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (!open) return;
    const value = record?.readiness;
    setForm({ packageId: record?.package?.id || "", status: value?.status || "ready", pressureZero: Boolean(value?.pressureZero), drainedAndPurged: Boolean(value?.drainedAndPurged), confinedSpacePermitValid: Boolean(value?.confinedSpacePermitValid), operationsApproved: Boolean(value?.operationsApproved), entrySupervisorApproved: Boolean(value?.entrySupervisorApproved), validUntil: toLocalDateTime(value?.validUntil) });
  }, [open, record]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Vessel Entry Readiness</DialogTitle><DialogDescription>Operations prepares conditions. Only an Entry Supervisor can set Authorized.</DialogDescription></DialogHeader><Field label="Status"><SelectField value={form.status || "ready"} onValueChange={(value) => setForm({ ...form, status: value })} options={canAuthorize ? ["draft", "ready", "authorized", "rejected", "expired"] : ["draft", "ready", "rejected"]} /></Field><div className="grid gap-3 sm:grid-cols-2">{[["Pressure verified zero", "pressureZero"], ["Drained and purged", "drainedAndPurged"], ["Confined-space permit valid", "confinedSpacePermitValid"], ["Operations approval complete", "operationsApproved"], ["Entry Supervisor approval", "entrySupervisorApproved"]].map(([label, key]) => <label key={key} className="flex items-center gap-3 rounded-xl border border-border p-3"><Checkbox checked={Boolean(form[key])} disabled={key === "entrySupervisorApproved" && !canAuthorize} onCheckedChange={(value) => setForm({ ...form, [key]: value === true })} /><span className="text-sm font-medium">{label}</span></label>)}</div><Field label="Valid until (optional)"><Input type="datetime-local" value={form.validUntil || ""} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></Field><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending} onClick={() => onSave({ packageId: form.packageId, status: form.status, pressureZero: Boolean(form.pressureZero), drainedAndPurged: Boolean(form.drainedAndPurged), confinedSpacePermitValid: Boolean(form.confinedSpacePermitValid), operationsApproved: Boolean(form.operationsApproved), entrySupervisorApproved: Boolean(form.entrySupervisorApproved), validUntil: optionalDate(form.validUntil) })}>{pending ? "Saving..." : "Save Readiness"}</Button></DialogFooter></DialogContent></Dialog>;
}

function ApprovalDialog({ open, step, pending, onClose, onSave }: any) {
  const [approved, setApproved] = useState(true); const [note, setNote] = useState("");
  useEffect(() => { if (open) { setApproved(true); setNote(""); } }, [open, step?.id]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent><DialogHeader><DialogTitle>Final Approval · {step?.roleKey}</DialogTitle><DialogDescription>This decision is stored in the sequential approval chain and audit history.</DialogDescription></DialogHeader><SelectField value={approved ? "approved" : "rejected"} onValueChange={(value) => setApproved(value === "approved")} options={["approved", "rejected"]} /><Field label="Approval note"><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={approved ? "default" : "destructive"} disabled={pending} onClick={() => onSave({ approved, note: note || null })}>{pending ? "Saving..." : approved ? "Approve" : "Reject"}</Button></DialogFooter></DialogContent></Dialog>;
}

function EvidenceDialog({ open, policy, pending, onClose, onSave }: any) {
  const [category, setCategory] = useState("Field Evidence"); const [file, setFile] = useState<File | null>(null);
  useEffect(() => { if (open) { setCategory("Field Evidence"); setFile(null); } }, [open]);
  const allowed = (() => { try { return JSON.parse(policy?.evidenceAllowedMimeTypesJson || "[]") as string[]; } catch { return []; } })();
  const submit = async () => { if (!file) return; const maxBytes = (policy?.evidenceMaxFileSizeMb || 10) * 1024 * 1024; if (allowed.length > 0 && !allowed.includes(file.type)) { toast.error(`File type ${file.type || "unknown"} is not allowed.`); return; } if (file.size > maxBytes) { toast.error(`Maximum evidence size is ${policy?.evidenceMaxFileSizeMb || 10} MB.`); return; } const buffer = await file.arrayBuffer(); const bytes = new Uint8Array(buffer); let binary = ""; for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); onSave({ category, fileName: file.name, mimeType: file.type || "application/octet-stream", base64: btoa(binary) }); };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent><DialogHeader><DialogTitle>Upload Controlled Evidence</DialogTitle><DialogDescription>Allowed: {allowed.length ? allowed.join(", ") : "Configured server types"}. Maximum {policy?.evidenceMaxFileSizeMb || 10} MB.</DialogDescription></DialogHeader><Field label="Category"><Input value={category} onChange={(event) => setCategory(event.target.value)} /></Field><Field label="File"><Input type="file" accept={allowed.join(",")} onChange={(event) => setFile(event.target.files?.[0] || null)} /></Field><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !file || !category.trim()} onClick={submit}>{pending ? "Uploading..." : "Upload Evidence"}</Button></DialogFooter></DialogContent></Dialog>;
}
