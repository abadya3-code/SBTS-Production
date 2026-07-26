/**
 * SurveyDialog — Periodic Slip Blind Safety Survey
 * ──────────────────────────────────────────────────
 * Allows safety officers to conduct a periodic survey of all slip blinds
 * in the plant, recording each blind's current status, physical condition,
 * and foreman approval.
 */

import { useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ─── Schema ───────────────────────────────────────────────────────────────────

const surveyItemSchema = z.object({
  blindTag: z.string().min(1, "Tag is required"),
  projectId: z.string().min(1, "Project is required"),
  slipStatus: z.enum(["in_service", "removed", "merged", "unknown"]),
  foremanApproved: z.boolean(),
  physicalCondition: z.enum(["good", "fair", "damaged", "missing"]),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const surveySchema = z.object({
  surveyDate: z.string().min(1, "Survey date is required"),
  projectId: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(surveyItemSchema).min(1, "At least one blind must be added"),
});

type SurveyFormData = z.infer<typeof surveySchema>;

// ─── Status / Condition Labels ────────────────────────────────────────────────

const SLIP_STATUS_OPTIONS = [
  { value: "in_service", label: "In Service" },
  { value: "removed", label: "Removed" },
  { value: "merged", label: "Merged" },
  { value: "unknown", label: "Unknown" },
] as const;

const CONDITION_OPTIONS = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "damaged", label: "Damaged" },
  { value: "missing", label: "Missing" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  in_service: "bg-emerald-100 text-emerald-800",
  removed: "bg-red-100 text-red-800",
  merged: "bg-blue-100 text-blue-800",
  unknown: "bg-slate-100 text-slate-600",
};

const CONDITION_COLORS: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-800",
  fair: "bg-yellow-100 text-yellow-800",
  damaged: "bg-orange-100 text-orange-800",
  missing: "bg-red-100 text-red-800",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface SurveyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SurveyDialog({ open, onClose, onSuccess }: SurveyDialogProps) {
  const [step, setStep] = useState<"setup" | "items">("setup");
  const [searchTag, setSearchTag] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Load existing blinds to populate the survey
  const { data: listData, isLoading: blindsLoading } = trpc.slipBlinds.list.useQuery(
    { limit: 500 },
    { enabled: open }
  );
  const allBlinds = listData?.rows ?? [];

  // Create survey mutation
  const createSurvey = trpc.slipBlinds.createSurvey.useMutation({
    onSuccess: () => {
      onSuccess();
    },
    onError: (err) => {
      toast.error(`Failed to submit survey: ${err.message}`);
    },
  });

  // Form
  const form = useForm<SurveyFormData>({
    resolver: zodResolver(surveySchema),
    defaultValues: {
      surveyDate: new Date().toISOString().slice(0, 10),
      projectId: undefined,
      notes: "",
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Unique projects from blinds
  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    allBlinds.forEach((b) => map.set(b.projectId, b.projectName));
    return Array.from(map.entries());
  }, [allBlinds]);

  // Filtered blinds for adding
  const filteredBlinds = useMemo(() => {
    const addedTags = new Set(fields.map((f) => f.blindTag));
    return allBlinds.filter(
      (b) =>
        !addedTags.has(b.tag) &&
        (searchTag === "" || b.tag.toLowerCase().includes(searchTag.toLowerCase()))
    );
  }, [allBlinds, fields, searchTag]);

  // Add a blind to the survey
  function addBlind(tag: string, projectId: string) {
    const blind = allBlinds.find((b) => b.tag === tag);
    append({
      blindTag: tag,
      projectId,
      slipStatus: (blind?.slipStatus as "in_service" | "removed" | "merged" | "unknown") ?? "in_service",
      foremanApproved: !!blind?.slipMetalForemanApproved,
      physicalCondition: "good",
      location: blind?.location ?? "",
      notes: "",
    });
    setSearchTag("");
  }

  // Add all visible blinds at once
  function addAllBlinds() {
    const addedTags = new Set(fields.map((f) => f.blindTag));
    const toAdd = allBlinds.filter((b) => !addedTags.has(b.tag));
    toAdd.forEach((b) => {
      append({
        blindTag: b.tag,
        projectId: b.projectId,
        slipStatus: (b.slipStatus as "in_service" | "removed" | "merged" | "unknown") ?? "in_service",
        foremanApproved: !!b.slipMetalForemanApproved,
        physicalCondition: "good",
        location: b.location ?? "",
        notes: "",
      });
    });
    toast.success(`Added ${toAdd.length} blinds to survey`);
  }

  // Submit
  async function onSubmit(data: SurveyFormData) {
    await createSurvey.mutateAsync({
      surveyDate: data.surveyDate,
      projectId: data.projectId || undefined,
      notes: data.notes || undefined,
      items: data.items,
    });
  }

  function handleClose() {
    form.reset();
    setStep("setup");
    setSearchTag("");
    setExpandedRow(null);
    onClose();
  }

  const itemCount = fields.length;
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-cyan-100 p-2">
              <ClipboardList className="h-5 w-5 text-cyan-700" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold text-slate-900">
                New Periodic Safety Survey
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Record the current status of all slip blinds for safety compliance.
              </DialogDescription>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setStep("setup")}
              className={`flex items-center gap-1.5 text-sm font-semibold transition ${
                step === "setup" ? "text-cyan-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  step === "setup" ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                1
              </span>
              Survey Setup
            </button>
            <div className="h-px flex-1 bg-slate-200" />
            <button
              type="button"
              onClick={() => step === "items" && setStep("items")}
              className={`flex items-center gap-1.5 text-sm font-semibold transition ${
                step === "items" ? "text-cyan-700" : "text-slate-400"
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  step === "items" ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                2
              </span>
              Blind Items
              {itemCount > 0 && (
                <Badge className="ml-1 bg-cyan-600 text-white text-[10px] px-1.5 py-0">
                  {itemCount}
                </Badge>
              )}
            </button>
          </div>
        </DialogHeader>

        {/* Body */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* ── Step 1: Setup ── */}
            {step === "setup" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="surveyDate" className="text-sm font-semibold">
                      Survey Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="surveyDate"
                      type="date"
                      {...form.register("surveyDate")}
                      className="h-9"
                    />
                    {errors.surveyDate && (
                      <p className="text-xs text-red-500">{errors.surveyDate.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">Project (Optional)</Label>
                    <Select
                      value={form.watch("projectId") ?? "all"}
                      onValueChange={(v) =>
                        form.setValue("projectId", v === "all" ? undefined : v)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {projectOptions.map(([id, name]) => (
                          <SelectItem key={id} value={id}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-sm font-semibold">
                    Survey Notes (Optional)
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="General observations, weather conditions, special circumstances…"
                    rows={3}
                    {...form.register("notes")}
                    className="resize-none"
                  />
                </div>

                <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-cyan-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-cyan-800">
                      <p className="font-semibold mb-1">Before you proceed:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>Ensure you have physically inspected each blind</li>
                        <li>Obtain foreman approval before marking as removed</li>
                        <li>Record the exact location for field reference</li>
                        <li>This survey will be submitted for safety compliance records</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Items ── */}
            {step === "items" && (
              <div className="space-y-4">
                {/* Add blinds toolbar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search blind tag to add…"
                      value={searchTag}
                      onChange={(e) => setSearchTag(e.target.value)}
                      className="pl-9 h-8 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addAllBlinds}
                    disabled={blindsLoading}
                    className="gap-1.5 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add All ({allBlinds.length - fields.length})
                  </Button>
                </div>

                {/* Blind search results */}
                {searchTag && filteredBlinds.length > 0 && (
                  <div className="rounded-lg border bg-white shadow-sm max-h-40 overflow-y-auto">
                    {filteredBlinds.slice(0, 20).map((b) => (
                      <button
                        key={b.tag}
                        type="button"
                        onClick={() => addBlind(b.tag, b.projectId)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left border-b last:border-0"
                      >
                        <span className="font-mono font-bold text-sm text-slate-900">{b.tag}</span>
                        <span className="text-xs text-slate-500 truncate ml-2">{b.projectName}</span>
                        <Plus className="h-3.5 w-3.5 text-cyan-600 ml-2 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {errors.items && typeof errors.items.message === "string" && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.items.message}
                  </p>
                )}

                {/* Items list */}
                {fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed rounded-lg">
                    <ClipboardList className="h-10 w-10 mb-3 opacity-40" />
                    <p className="font-semibold">No blinds added yet</p>
                    <p className="text-sm mt-1">Search for a blind tag above or click "Add All"</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Summary row */}
                    <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                      <span>{fields.length} blind(s) in this survey</span>
                      <span className="text-cyan-600 font-semibold">
                        {fields.filter((f) => f.foremanApproved).length} foreman approved
                      </span>
                    </div>

                    {fields.map((field, index) => {
                      const isExpanded = expandedRow === index;
                      const itemErrors = errors.items?.[index];
                      const currentStatus = form.watch(`items.${index}.slipStatus`);
                      const currentCondition = form.watch(`items.${index}.physicalCondition`);

                      return (
                        <div
                          key={field.id}
                          className="rounded-lg border bg-white overflow-hidden"
                        >
                          {/* Collapsed row */}
                          <div
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50"
                            onClick={() => setExpandedRow(isExpanded ? null : index)}
                          >
                            <span className="font-mono font-extrabold text-sm text-slate-900 w-24 shrink-0">
                              {field.blindTag}
                            </span>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[currentStatus] ?? "bg-slate-100 text-slate-600"}`}
                              >
                                {currentStatus.replace("_", " ")}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${CONDITION_COLORS[currentCondition] ?? "bg-slate-100 text-slate-600"}`}
                              >
                                {currentCondition}
                              </span>
                              {form.watch(`items.${index}.foremanApproved`) && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                                  <CheckCircle2 className="h-3 w-3" /> Foreman
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {itemErrors && (
                                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  remove(index);
                                  if (expandedRow === index) setExpandedRow(null);
                                }}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="border-t bg-slate-50 px-3 py-3 space-y-3">
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold">Slip Status</Label>
                                  <Select
                                    value={form.watch(`items.${index}.slipStatus`)}
                                    onValueChange={(v) =>
                                      form.setValue(
                                        `items.${index}.slipStatus`,
                                        v as "in_service" | "removed" | "merged" | "unknown"
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SLIP_STATUS_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value} className="text-xs">
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold">Physical Condition</Label>
                                  <Select
                                    value={form.watch(`items.${index}.physicalCondition`)}
                                    onValueChange={(v) =>
                                      form.setValue(
                                        `items.${index}.physicalCondition`,
                                        v as "good" | "fair" | "damaged" | "missing"
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CONDITION_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value} className="text-xs">
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold">Location</Label>
                                  <Input
                                    {...form.register(`items.${index}.location`)}
                                    placeholder="e.g. Unit-3 Line-A"
                                    className="h-8 text-xs"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold">Foreman Approved</Label>
                                  <div className="flex items-center gap-2 h-8">
                                    <Checkbox
                                      id={`foreman-${index}`}
                                      checked={form.watch(`items.${index}.foremanApproved`)}
                                      onCheckedChange={(v) =>
                                        form.setValue(`items.${index}.foremanApproved`, !!v)
                                      }
                                    />
                                    <label
                                      htmlFor={`foreman-${index}`}
                                      className="text-xs text-slate-700 cursor-pointer"
                                    >
                                      Approved
                                    </label>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs font-semibold">Notes</Label>
                                <Input
                                  {...form.register(`items.${index}.notes`)}
                                  placeholder="Any observations for this blind…"
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Footer */}
          <DialogFooter className="px-6 py-4 shrink-0 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {step === "items" && itemCount > 0 && (
                <span>{itemCount} blind(s) ready for submission</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>

              {step === "setup" ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5"
                  onClick={() => setStep("items")}
                >
                  Next: Add Blinds
                  <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("setup")}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5"
                    disabled={createSurvey.isPending || itemCount === 0}
                  >
                    {createSurvey.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Submit Survey ({itemCount})
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
