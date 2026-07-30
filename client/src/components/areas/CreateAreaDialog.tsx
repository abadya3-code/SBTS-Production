import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, MapPinned } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type CreateAreaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const initialForm = {
  name: "",
  code: "",
  location: "",
  description: "",
  isActive: true,
};

export function CreateAreaDialog({ open, onOpenChange }: CreateAreaDialogProps) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!open) setForm(initialForm);
  }, [open]);

  const normalizedCode = useMemo(
    () => form.code.trim().toUpperCase().replace(/\s+/g, "-"),
    [form.code],
  );

  const mutation = trpc.areas.create.useMutation({
    onSuccess: async (area) => {
      await utils.areas.list.invalidate();
      toast.success(`Area ${area.code} created successfully.`);
      onOpenChange(false);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error("Area name must contain at least two characters.");
      return;
    }
    if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(normalizedCode)) {
      toast.error("Area code must use 2–40 letters, numbers, hyphens, or underscores.");
      return;
    }
    mutation.mutate({
      name,
      code: normalizedCode,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      isActive: form.isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !mutation.isPending && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold">
            <MapPinned className="h-5 w-5 text-cyan-700" />
            Create operational area
          </DialogTitle>
          <DialogDescription>
            Register a plant area first. Projects will be linked to this controlled area record.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="area-name">Area name</Label>
              <Input
                id="area-name"
                autoFocus
                maxLength={200}
                placeholder="Example: Shedgum Process Train 4"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                disabled={mutation.isPending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-code">Area code</Label>
              <Input
                id="area-code"
                maxLength={40}
                placeholder="SGP-04"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                disabled={mutation.isPending}
                required
              />
              <p className="text-xs text-slate-500">Saved as {normalizedCode || "—"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-location">Plant location</Label>
              <Input
                id="area-location"
                maxLength={200}
                placeholder="Process trains / utilities / offsites"
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="area-description">Description</Label>
              <Textarea
                id="area-description"
                maxLength={1500}
                rows={4}
                placeholder="Operational scope and boundaries for this area."
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                disabled={mutation.isPending}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-cyan-700"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              disabled={mutation.isPending}
            />
            <span>
              <span className="block text-sm font-extrabold text-slate-900">Active area</span>
              <span className="block text-xs font-medium text-slate-500">
                Active areas are available immediately when creating projects.
              </span>
            </span>
          </label>

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
              Create area
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
