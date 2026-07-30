import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, FilePlus2, Layers3, Loader2, Search, ShieldCheck } from "lucide-react";
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


function toLocalDateTimeInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function statusClass(status: string) {
  if (["entry_authorized", "ready_for_service", "closed", "authorized"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["on_hold", "rejected", "expired"].includes(status)) return "border-red-200 bg-red-50 text-red-800";
  if (["work_in_progress", "ready_for_removal", "reinstated", "ready"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-primary/20 bg-primary/5 text-primary";
}

export default function IsolationPackages() {
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const packagesQuery = trpc.workflowRuntime.isolationPackage.list.useQuery(projectFilter === "all" ? undefined : { projectId: projectFilter });
  const projectsQuery = trpc.projects.list.useQuery();
  const detailQuery = trpc.workflowRuntime.isolationPackage.detail.useQuery({ packageId: selectedPackageId || "" }, { enabled: Boolean(selectedPackageId) });
  const filtered = useMemo(() => (packagesQuery.data ?? []).filter((pkg: any) => `${pkg.id} ${pkg.equipment} ${pkg.projectId}`.toLowerCase().includes(search.toLowerCase())), [packagesQuery.data, search]);

  const refresh = async () => { await packagesQuery.refetch(); if (selectedPackageId) await detailQuery.refetch(); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex items-center gap-3"><div className="rounded-2xl bg-primary/10 p-3 text-primary"><Layers3 className="h-6 w-6" /></div><div><h1 className="text-2xl font-black tracking-tight text-foreground">Vessel Isolation Packages</h1><p className="text-sm text-muted-foreground">Package-level control for all required blinds, entry readiness and reinstatement status.</p></div></div></div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}><FilePlus2 className="h-4 w-4" /> Create Isolation Package</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_240px]">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3"><Search className="h-4 w-4 text-muted-foreground" /><Input className="border-0 shadow-none focus-visible:ring-0" placeholder="Search package, equipment or project..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger className="w-full"><SelectValue placeholder="All projects" /></SelectTrigger><SelectContent><SelectItem value="all">All projects</SelectItem>{(projectsQuery.data ?? []).map((project: any) => <SelectItem key={project.id} value={project.id}>{project.id} · {project.name}</SelectItem>)}</SelectContent></Select>
      </div>

      {packagesQuery.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : filtered.length === 0 ? <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">No Isolation Packages match the selected filter.</CardContent></Card> : <div className="grid gap-4 xl:grid-cols-2">{filtered.map((pkg: any) => <Card key={pkg.id} className="overflow-hidden border-border"><CardHeader className="border-b border-border/60 bg-muted/20"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{pkg.id}</CardTitle><CardDescription>{pkg.equipment} · {pkg.projectId}</CardDescription></div><Badge variant="outline" className={statusClass(pkg.status)}>{pkg.status.replaceAll("_", " ")}</Badge></div></CardHeader><CardContent className="space-y-4 p-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Linked blinds" value={pkg.linkedBlindCount} /><Metric label="Required" value={pkg.requiredBlindCount} /><Metric label="Active isolation" value={`${pkg.activeIsolationCount}/${pkg.requiredBlindCount}`} /><Metric label="Closed" value={pkg.closedBlindCount} /></div><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-muted-foreground">Entry readiness: <strong className="text-foreground">{pkg.latestEntryReadiness?.status ?? "Not prepared"}</strong>{pkg.latestEntryReadiness?.validUntil ? ` · valid until ${new Date(pkg.latestEntryReadiness.validUntil).toLocaleString()}` : ""}</div><Button variant="outline" size="sm" onClick={() => setSelectedPackageId(pkg.id)}>Open Package</Button></div></CardContent></Card>)}</div>}

      <CreatePackageDialog open={createOpen} projects={projectsQuery.data ?? []} onClose={() => setCreateOpen(false)} onCreated={async (id: string) => { setCreateOpen(false); setSelectedPackageId(id); await refresh(); }} />
      <PackageDetailDialog open={Boolean(selectedPackageId)} data={detailQuery.data} loading={detailQuery.isLoading} onClose={() => setSelectedPackageId(null)} onRefresh={refresh} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="rounded-xl bg-muted/40 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black text-foreground">{value}</p></div>; }

function CreatePackageDialog({ open, projects, onClose, onCreated }: any) {
  const [projectId, setProjectId] = useState(""); const [equipment, setEquipment] = useState(""); const [description, setDescription] = useState(""); const [selected, setSelected] = useState<string[]>([]);
  const projectQuery = trpc.projects.detail.useQuery({ id: projectId || "__none__" }, { enabled: Boolean(projectId) });
  const mutation = trpc.workflowRuntime.isolationPackage.create.useMutation({ onSuccess: (result) => { toast.success(`Isolation Package ${result.id} created.`); onCreated(result.id); }, onError: (error) => toast.error(error.message) });
  useEffect(() => { if (!open) { setProjectId(""); setEquipment(""); setDescription(""); setSelected([]); } }, [open]);
  useEffect(() => { setSelected([]); }, [projectId]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Create Vessel Isolation Package</DialogTitle><DialogDescription>Link every required blind for one equipment item. The entry gate evaluates the package as a whole.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Project"><Select value={projectId} onValueChange={setProjectId}><SelectTrigger className="w-full"><SelectValue placeholder="Select project" /></SelectTrigger><SelectContent>{projects.map((project: any) => <SelectItem key={project.id} value={project.id}>{project.id} · {project.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Equipment / Vessel"><Input value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="Vessel V-101" /></Field><Field label="Description" className="sm:col-span-2"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Field></div><div><Label>Required blinds</Label><div className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border p-3">{projectQuery.isLoading ? <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin" /> : (projectQuery.data?.blinds ?? []).length ? projectQuery.data!.blinds.map((blind: any) => <label key={blind.tag} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><div className="flex items-center gap-3"><Checkbox checked={selected.includes(blind.tag)} onCheckedChange={(value) => setSelected((current) => value === true ? [...current, blind.tag] : current.filter((tag) => tag !== blind.tag))} /><div><p className="font-semibold text-foreground">{blind.tag}</p><p className="text-xs text-muted-foreground">{blind.equipment || "—"} · {blind.size} · {blind.type}</p></div></div><Badge variant="outline">{blind.canonicalPhaseLabel || blind.phase}</Badge></label>) : <p className="py-8 text-center text-sm text-muted-foreground">Select a project with Blind records.</p>}</div></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={mutation.isPending || !projectId || !equipment.trim() || selected.length === 0} onClick={() => mutation.mutate({ projectId, equipment: equipment.trim(), description: description.trim() || null, blindTags: selected })}>{mutation.isPending ? "Creating..." : `Create Package (${selected.length})`}</Button></DialogFooter></DialogContent></Dialog>;
}

function PackageDetailDialog({ open, data, loading, onClose, onRefresh }: any) {
  const [readinessOpen, setReadinessOpen] = useState(false);
  const latest = data?.latestEntryReadiness;
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{data?.package?.id || "Isolation Package"}</DialogTitle><DialogDescription>{data?.package?.equipment || "Loading package detail..."}</DialogDescription></DialogHeader>{loading || !data ? <Loader2 className="mx-auto my-16 h-8 w-8 animate-spin text-primary" /> : <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-4"><Metric label="Status" value={data.package.status.replaceAll("_", " ")} /><Metric label="Record version" value={data.package.recordVersion} /><Metric label="Linked blinds" value={data.linkedBlinds.length} /><Metric label="Entry readiness" value={latest?.status || "Not prepared"} /></div><Card><CardHeader><CardTitle className="text-base">Linked Blind Status</CardTitle></CardHeader><CardContent className="space-y-2">{data.linkedBlinds.map((blind: any) => <Link key={blind.blindTag} href={`/projects/${data.package.projectId}/blinds/${blind.blindTag}`} className="flex flex-col gap-2 rounded-xl border border-border p-3 hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-foreground">{blind.blindTag}</p><p className="text-xs text-muted-foreground">{blind.equipment || "—"} · {blind.size || "—"} · {blind.type || "—"}</p></div><div className="flex gap-2"><Badge variant="outline">{blind.currentPhaseKey || blind.legacyPhase}</Badge><Badge variant="outline" className={statusClass(blind.lifecycleStatus || "planned")}>{(blind.lifecycleStatus || "planned").replaceAll("_", " ")}</Badge></div></Link>)}</CardContent></Card><Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-700" /> Entry Readiness</CardTitle><CardDescription>Derived package conditions plus Operations and Entry Supervisor declarations.</CardDescription></div><Button size="sm" onClick={() => setReadinessOpen(true)}><ClipboardCheck className="mr-2 h-4 w-4" /> Update</Button></div></CardHeader><CardContent>{latest ? <div className="grid gap-2 sm:grid-cols-3"><Readiness label="All blinds active" value={latest.allRequiredBlindsActive === 1} /><Readiness label="LOTO active" value={latest.lotoActive === 1} /><Readiness label="Gas acceptable" value={latest.gasTestAcceptable === 1} /><Readiness label="Pressure zero" value={latest.pressureZero === 1} /><Readiness label="Drained & purged" value={latest.drainedAndPurged === 1} /><Readiness label="CSE permit valid" value={latest.confinedSpacePermitValid === 1} /><Readiness label="Operations approved" value={latest.operationsApproved === 1} /><Readiness label="Entry Supervisor" value={latest.entrySupervisorApproved === 1} /></div> : <p className="text-sm text-muted-foreground">No readiness record yet.</p>}</CardContent></Card></div>}<EntryPackageDialog open={readinessOpen} packageId={data?.package?.id || ""} record={latest} onClose={() => setReadinessOpen(false)} onSaved={async () => { setReadinessOpen(false); await onRefresh(); }} /></DialogContent></Dialog>;
}

function Readiness({ label, value }: { label: string; value: boolean }) { return <div className={`rounded-lg border p-3 text-xs font-semibold ${value ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{value && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />}{label}: {value ? "Yes" : "No"}</div>; }

function EntryPackageDialog({ open, packageId, record, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (open) setForm({ status: record?.status || "ready", pressureZero: Boolean(record?.pressureZero), drainedAndPurged: Boolean(record?.drainedAndPurged), confinedSpacePermitValid: Boolean(record?.confinedSpacePermitValid), operationsApproved: Boolean(record?.operationsApproved), entrySupervisorApproved: Boolean(record?.entrySupervisorApproved), validUntil: record?.validUntil ? toLocalDateTimeInput(record.validUntil) : "" }); }, [open, record]);
  const mutation = trpc.workflowRuntime.isolationPackage.entryReadiness.useMutation({ onSuccess: async () => { toast.success("Entry readiness updated."); await onSaved(); }, onError: (error) => toast.error(error.message) });
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent><DialogHeader><DialogTitle>Update Entry Readiness</DialogTitle><DialogDescription>The server derives Blind, LOTO and gas-test conditions and rejects unsafe authorization.</DialogDescription></DialogHeader><Field label="Status"><Select value={form.status || "ready"} onValueChange={(status) => setForm({ ...form, status })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["draft", "ready", "authorized", "rejected", "expired"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></Field><div className="grid gap-2 sm:grid-cols-2">{[["Pressure zero", "pressureZero"], ["Drained and purged", "drainedAndPurged"], ["Confined-space permit valid", "confinedSpacePermitValid"], ["Operations approved", "operationsApproved"], ["Entry Supervisor approved", "entrySupervisorApproved"]].map(([label, key]) => <label key={key} className="flex items-center gap-3 rounded-xl border border-border p-3"><Checkbox checked={Boolean(form[key])} onCheckedChange={(value) => setForm({ ...form, [key]: value === true })} /><span className="text-sm font-medium">{label}</span></label>)}</div><Field label="Valid until"><Input type="datetime-local" value={form.validUntil || ""} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></Field><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate({ packageId, status: form.status, pressureZero: Boolean(form.pressureZero), drainedAndPurged: Boolean(form.drainedAndPurged), confinedSpacePermitValid: Boolean(form.confinedSpacePermitValid), operationsApproved: Boolean(form.operationsApproved), entrySupervisorApproved: Boolean(form.entrySupervisorApproved), validUntil: form.validUntil ? new Date(form.validUntil) : null })}>{mutation.isPending ? "Saving..." : "Save Readiness"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <div className={`space-y-1.5 ${className}`}><Label>{label}</Label>{children}</div>; }
