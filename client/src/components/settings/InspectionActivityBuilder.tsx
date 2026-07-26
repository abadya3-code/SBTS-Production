import { useEffect, useState } from "react";
import { ClipboardList, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function InspectionActivityBuilder() {
  const query = trpc.workflowRuntime.inspection.templates.useQuery({ includeInactive: true });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const mutation = trpc.workflowRuntime.inspection.saveTemplate.useMutation({
    onSuccess: async () => { toast.success("Inspection activity saved."); setOpen(false); setEditing(null); await query.refetch(); },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Card className="sbts-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="flex items-center gap-2 text-base font-extrabold"><ClipboardList className="h-5 w-5 text-blue-700" /> Inspection Activity Builder</CardTitle><CardDescription>Configure plant inspection work without changing the eight-phase workflow or application code.</CardDescription></div>
          <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add Activity</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading ? <div className="h-24 animate-pulse rounded-xl bg-muted" /> : (query.data ?? []).map((activity: any) => (
          <div key={activity.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-foreground">{activity.name}</p><Badge variant="outline">{activity.activityKey}</Badge>{activity.mandatory === 1 && <Badge className="bg-red-100 text-red-800">Mandatory</Badge>}{activity.evidenceRequired === 1 && <Badge className="bg-blue-100 text-blue-800">Evidence</Badge>}{activity.approvalRequired === 1 && <Badge className="bg-violet-100 text-violet-800">Approval</Badge>}<Badge variant="outline" className={activity.active === 1 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}>{activity.active === 1 ? "Active" : "Inactive"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{activity.description || "No description"} · order {activity.sortOrder}</p></div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { setEditing(activity); setOpen(true); }}><Pencil className="h-4 w-4" /> Edit</Button>
          </div>
        ))}
      </CardContent>
      <ActivityDialog open={open} record={editing} pending={mutation.isPending} onClose={() => { setOpen(false); setEditing(null); }} onSave={(value: any) => mutation.mutate(value)} />
    </Card>
  );
}

function ActivityDialog({ open, record, pending, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (!open) return;
    let equipmentTypes: string[] = [];
    try { equipmentTypes = JSON.parse(record?.applicableEquipmentTypesJson || "[]"); } catch { equipmentTypes = []; }
    setForm({ id: record?.id, activityKey: record?.activityKey || "", name: record?.name || "", description: record?.description || "", applicableEquipmentTypes: equipmentTypes.join(", "), mandatory: record?.mandatory === 1, evidenceRequired: record?.evidenceRequired === 1, approvalRequired: record?.approvalRequired === 1, active: record ? record.active === 1 : true, sortOrder: record?.sortOrder ?? 10 });
  }, [open, record]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{record ? "Edit" : "Add"} Inspection Activity</DialogTitle><DialogDescription>Activities appear during Internal Inspection & Work Execution. Mandatory activities become server transition gates.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Activity key"><Input disabled={Boolean(record)} value={form.activityKey || ""} onChange={(event) => setForm({ ...form, activityKey: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="coating-inspection" /></Field><Field label="Name"><Input value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Description" className="sm:col-span-2"><Textarea rows={3} value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><Field label="Applicable equipment types" className="sm:col-span-2"><Input value={form.applicableEquipmentTypes || ""} onChange={(event) => setForm({ ...form, applicableEquipmentTypes: event.target.value })} placeholder="Tank, Vessel, Drum" /></Field><Field label="Sort order"><Input type="number" min={0} value={form.sortOrder ?? 0} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></Field><div className="flex items-center justify-between rounded-xl border border-border p-3"><Label>Active</Label><Switch checked={Boolean(form.active)} onCheckedChange={(value) => setForm({ ...form, active: value })} /></div><Toggle label="Mandatory transition gate" checked={Boolean(form.mandatory)} onChange={(value) => setForm({ ...form, mandatory: value })} /><Toggle label="Evidence required" checked={Boolean(form.evidenceRequired)} onChange={(value) => setForm({ ...form, evidenceRequired: value })} /><Toggle label="Independent approval required" checked={Boolean(form.approvalRequired)} onChange={(value) => setForm({ ...form, approvalRequired: value })} /></div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || !form.activityKey || !form.name} onClick={() => onSave({ id: form.id, activityKey: form.activityKey, name: form.name, description: form.description || null, applicableEquipmentTypes: String(form.applicableEquipmentTypes || "").split(",").map((item) => item.trim()).filter(Boolean), mandatory: Boolean(form.mandatory), evidenceRequired: Boolean(form.evidenceRequired), approvalRequired: Boolean(form.approvalRequired), active: Boolean(form.active), sortOrder: Number(form.sortOrder || 0) })}>{pending ? "Saving..." : "Save Activity"}</Button></DialogFooter></DialogContent></Dialog>;
}
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <div className={`space-y-1.5 ${className}`}><Label>{label}</Label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-3 rounded-xl border border-border p-3"><Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} /><span className="text-sm font-medium">{label}</span></label>; }
