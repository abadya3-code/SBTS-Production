import { useEffect, useState } from "react";
import { ClipboardList, Pencil } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const statusClass = (status: string) => {
  if (["completed", "approved", "not_applicable"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["rejected"].includes(status)) return "border-red-200 bg-red-50 text-red-800";
  if (["in_progress"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

export function InspectionActivitiesPanel({ projectId, blindTag, currentPhaseKey, canManage, canApprove, onRuntimeRefresh }: { projectId: string; blindTag: string; currentPhaseKey: string; canManage: boolean; canApprove: boolean; onRuntimeRefresh: () => Promise<unknown> | void }) {
  const query = trpc.workflowRuntime.inspection.forBlind.useQuery({ projectId, blindTag });
  const [editing, setEditing] = useState<any>(null);
  const mutation = trpc.workflowRuntime.inspection.saveRecord.useMutation({
    onSuccess: async (result) => { toast.success(result.allMandatoryComplete ? "Inspection activity saved. All mandatory activities are complete." : "Inspection activity saved."); setEditing(null); await query.refetch(); await onRuntimeRefresh(); },
    onError: (error) => toast.error(error.message),
  });
  return <Card className="overflow-hidden border-border"><CardHeader className="border-b border-border/70 bg-muted/20"><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-blue-700" /> Inspection Activities</CardTitle><CardDescription>Plant-configurable activities used during Internal Inspection & Work Execution. Mandatory activities are enforced by the server gate.</CardDescription></CardHeader><CardContent className="space-y-3 p-4">{query.isLoading ? <div className="h-24 animate-pulse rounded-xl bg-muted" /> : (query.data ?? []).map((activity: any) => { const status = activity.record?.status || "not_started"; const awaitingIndependentReview = activity.approvalRequired === 1 && status === "completed";
    const canOpenEditor = currentPhaseKey === "internalInspection" && (canManage || (canApprove && awaitingIndependentReview));
    return <div key={activity.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{activity.name}</p>{activity.mandatory === 1 && <Badge className="bg-red-100 text-red-800">Mandatory</Badge>}{activity.evidenceRequired === 1 && <Badge className="bg-blue-100 text-blue-800">Evidence</Badge>}{activity.approvalRequired === 1 && <Badge className="bg-violet-100 text-violet-800">Independent approval</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{activity.record?.result || activity.description || "No result recorded"}</p>{awaitingIndependentReview && <p className="mt-1 text-xs font-medium text-amber-700">Completion recorded; independent approval is still required.</p>}</div><div className="flex items-center gap-2"><Badge variant="outline" className={awaitingIndependentReview ? "border-amber-200 bg-amber-50 text-amber-800" : statusClass(status)}>{status.replaceAll("_", " ")}</Badge>{canOpenEditor && <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing({ ...activity, reviewMode: awaitingIndependentReview && canApprove })}><Pencil className="h-4 w-4" /> {awaitingIndependentReview && canApprove ? "Review" : "Update"}</Button>}</div></div>; })}</CardContent><InspectionRecordDialog open={Boolean(editing)} activity={editing} canManage={canManage} canApprove={canApprove} pending={mutation.isPending} onClose={() => setEditing(null)} onSave={(value: any) => mutation.mutate({ ...value, projectId, blindTag, templateId: editing.id })} /></Card>;
}

function InspectionRecordDialog({ open, activity, pending, onClose, onSave, canManage, canApprove }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (open) setForm({ status: activity?.reviewMode ? "approved" : (activity?.record?.status || "in_progress"), result: activity?.record?.result || "", notes: activity?.record?.notes || "" }); }, [open, activity]);
  const isReview = activity?.approvalRequired === 1 && activity?.record?.status === "completed" && canApprove;
  const statuses = isReview ? ["approved", "rejected"] : canManage ? ["not_started", "in_progress", "completed", "not_applicable"] : [];
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent><DialogHeader><DialogTitle>{activity?.name || "Inspection Activity"}</DialogTitle><DialogDescription>{isReview ? "Record an independent approval decision. The reviewer must be different from the activity completer." : (activity?.description || "Record the inspection result and supporting notes.")}{activity?.evidenceRequired === 1 ? " Current-phase evidence is required before completion." : ""}</DialogDescription></DialogHeader><Field label="Status"><Select value={form.status || "in_progress"} onValueChange={(status) => setForm({ ...form, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></Field><Field label="Result"><Input value={form.result || ""} onChange={(event) => setForm({ ...form, result: event.target.value })} placeholder="Acceptable / Repair required / Reinspection required" /></Field><Field label="Notes"><Textarea rows={4} value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !form.status || statuses.length === 0} onClick={() => onSave({ status: form.status, result: form.result || null, notes: form.notes || null })}>{pending ? "Saving..." : isReview ? "Save Review Decision" : "Save Inspection Activity"}</Button></DialogFooter></DialogContent></Dialog>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
