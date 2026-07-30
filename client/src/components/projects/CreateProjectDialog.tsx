import { FormEvent, useEffect, useMemo, useState } from "react";
import { FolderKanban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type ProjectStatus = "Active" | "Completed" | "On Hold" | "Planning" | "Final Review";
type AreaOption = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: AreaOption[];
  defaultAreaId?: number | null;
};

const initialForm = {
  id: "",
  name: "",
  areaId: "",
  status: "Planning" as ProjectStatus,
  description: "",
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  areas,
  defaultAreaId,
}: CreateProjectDialogProps) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState(initialForm);
  const activeAreas = useMemo(() => areas.filter((area) => area.isActive), [areas]);

  useEffect(() => {
    if (open) {
      const selected = defaultAreaId && activeAreas.some((area) => area.id === defaultAreaId)
        ? String(defaultAreaId)
        : activeAreas[0]
          ? String(activeAreas[0].id)
          : "";
      setForm((current) => ({ ...initialForm, areaId: selected || current.areaId }));
    } else {
      setForm(initialForm);
    }
  }, [activeAreas, defaultAreaId, open]);

  const mutation = trpc.projects.create.useMutation({
    onSuccess: async (project) => {
      await Promise.all([
        utils.projects.list.invalidate(),
        utils.projects.listByArea.invalidate(),
        utils.areas.list.invalidate(),
      ]);
      toast.success(`Project ${project.id} created successfully.`);
      onOpenChange(false);
    },
  });

  const normalizedId = form.id.trim().toUpperCase().replace(/\s+/g, "-");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const areaId = Number(form.areaId);
    if (!Number.isInteger(areaId) || areaId <= 0) {
      toast.error("Select a valid active area.");
      return;
    }
    if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(normalizedId)) {
      toast.error("Project ID must use 2–40 letters, numbers, hyphens, or underscores.");
      return;
    }
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error("Project name must contain at least two characters.");
      return;
    }

    mutation.mutate({
      id: normalizedId,
      name,
      areaId,
      status: form.status,
      blindsCount: 0,
      progress: 0,
      description: form.description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !mutation.isPending && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold">
            <FolderKanban className="h-5 w-5 text-cyan-700" />
            Create project
          </DialogTitle>
          <DialogDescription>
            Create the project under an existing area. Blind records are added later from the project workspace.
          </DialogDescription>
        </DialogHeader>

        {activeAreas.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            No active areas are available. Create or activate an area before creating a project.
          </div>
        ) : (
          <form className="space-y-5" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project-id">Project ID</Label>
                <Input
                  id="project-id"
                  autoFocus
                  maxLength={40}
                  placeholder="PRJ-2026-001"
                  value={form.id}
                  onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))}
                  disabled={mutation.isPending}
                  required
                />
                <p className="text-xs text-slate-500">Saved as {normalizedId || "—"}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-area">Area</Label>
                <select
                  id="project-area"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:opacity-50"
                  value={form.areaId}
                  onChange={(event) => setForm((current) => ({ ...current, areaId: event.target.value }))}
                  disabled={mutation.isPending || Boolean(defaultAreaId)}
                  required
                >
                  {activeAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.code} · {area.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  maxLength={200}
                  placeholder="Example: Train-4 Shutdown Isolation"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  disabled={mutation.isPending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-status">Initial status</Label>
                <select
                  id="project-status"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:opacity-50"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProjectStatus }))}
                  disabled={mutation.isPending}
                >
                  <option value="Planning">Planning</option>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Final Review">Final Review</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  maxLength={1500}
                  rows={4}
                  placeholder="Project scope, shutdown window, and execution notes."
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  disabled={mutation.isPending}
                />
              </div>
            </div>

            {mutation.error && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {mutation.error.message}
              </div>
            )}

            <DialogFooter>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={mutation.isPending}
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create project
              </button>
            </DialogFooter>
          </form>
        )}

        {activeAreas.length === 0 && (
          <DialogFooter>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              onClick={() => onOpenChange(false)}
            >
              Close
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
