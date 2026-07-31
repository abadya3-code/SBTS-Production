/*
Design Philosophy: Industrial Command Center Minimalism.
Workflow Studio is a controlled engineering workbench: every phase, gate, permission, and role owner is visible in one command surface so workflow design does not drift away from access governance.
*/
import { type DragEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Copy, GitBranch, GripVertical, Layers3, Link2, Plus, Save, ShieldCheck, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { trpc } from "@/lib/trpc";
import { reorderItems } from "@/lib/workflowOrdering";
import { type Permission, type PhaseKey, type RoleKey, type RoleModel, type WorkflowPhaseTemplate, type WorkflowStatus, type WorkflowTemplate } from "@/lib/domainCatalog";
import { canonicalWorkflowPhases } from "../../../shared/workflowSpecification";

type PermissionGroupModel = { group: string; permissions: Permission[] };
const phaseOptions: { key: PhaseKey; label: string; color: string }[] = canonicalWorkflowPhases.map((phase) => ({
  key: phase.key,
  label: phase.label,
  color: phase.color,
}));
const statusOptions: WorkflowStatus[] = ["Draft", "Active", "Locked"];

function phaseFactory(index: number, roleKey: RoleKey): WorkflowPhaseTemplate {
  const option = phaseOptions[Math.min(index, phaseOptions.length - 1)];
  return {
    id: `wf-custom-${Date.now()}-${index}`,
    label: `${option.label} phase`,
    phaseKey: option.key,
    roleKey,
    requiredPermissionKey: "workflow.approve",
    gate: "Define the operational condition that must be satisfied before this phase can move forward.",
    slaHours: 8,
    evidence: ["QR scan"],
    automation: "Create audit log entry when phase is approved",
    color: option.color,
    isCritical: false,
  };
}

function permissionLabel(permissions: Permission[], key: string) {
  return permissions.find((permission) => permission.key === key)?.label ?? key;
}

function roleName(roles: RoleModel[], key: string) {
  return roles.find((role) => role.key === key)?.name ?? key;
}

function complianceScore(workflow: WorkflowTemplate, roles: RoleModel[]) {
  const aligned = workflow.phases.filter((phase) => roles.find((role) => role.key === phase.roleKey)?.permissionKeys.includes(phase.requiredPermissionKey)).length;
  return Math.round((aligned / Math.max(workflow.phases.length, 1)) * 100);
}

export default function WorkflowStudio() {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [roles, setRoles] = useState<RoleModel[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroupModel[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState("");
  const [activePhaseId, setActivePhaseId] = useState("");
  const [draggingPhaseId, setDraggingPhaseId] = useState("");
  const [dragOverPhaseId, setDragOverPhaseId] = useState("");

  const accessControlQuery = trpc.accessControl.model.useQuery();
  const workflowQuery = trpc.workflow.list.useQuery();
  const accessControlData = accessControlQuery.data as { permissionGroups: PermissionGroupModel[]; roles: RoleModel[] } | undefined;
  const workflowData = workflowQuery.data as WorkflowTemplate[] | undefined;
  const allPermissions = useMemo(() => permissionGroups.flatMap((group) => group.permissions), [permissionGroups]);
  const utils = trpc.useUtils();
  const saveWorkflowMutation = trpc.workflow.save.useMutation({
    onSuccess: (savedWorkflow) => {
      const saved = savedWorkflow as WorkflowTemplate;
      setWorkflows((current) => {
        const exists = current.some((workflow) => workflow.id === saved.id);
        return exists ? current.map((workflow) => (workflow.id === saved.id ? saved : workflow)) : [...current, saved];
      });
      setActiveWorkflowId(saved.id);
      setActivePhaseId((current) => saved.phases.some((phase) => phase.id === current) ? current : saved.phases[0]?.id ?? "");
      void utils.workflow.list.invalidate();
      toast.success("Workflow saved to the database successfully.");
    },
    onError: (error) => {
      toast.error(error.message || "Unable to save workflow to the database.");
    },
  });

  useEffect(() => {
    if (!accessControlData) return;
    setRoles(accessControlData.roles);
    setPermissionGroups(accessControlData.permissionGroups);
  }, [accessControlData]);

  useEffect(() => {
    if (!workflowData) return;
    setWorkflows(workflowData);
    setActiveWorkflowId((current) => workflowData.some((workflow) => workflow.id === current) ? current : workflowData[0]?.id ?? "");
  }, [workflowData]);

  const activeWorkflow = useMemo(() => workflows.find((workflow) => workflow.id === activeWorkflowId) ?? workflows[0], [workflows, activeWorkflowId]);
  const activePhase = useMemo(() => activeWorkflow?.phases.find((phase) => phase.id === activePhaseId) ?? activeWorkflow?.phases[0], [activeWorkflow, activePhaseId]);
  const selectedRole = activePhase ? roles.find((role) => role.key === activePhase.roleKey) ?? roles[0] : roles[0];
  const roleHasPermission = Boolean(activePhase && selectedRole.permissionKeys.includes(activePhase.requiredPermissionKey));
  const score = activeWorkflow ? complianceScore(activeWorkflow, roles) : 0;

  useEffect(() => {
    if (!activeWorkflow) return;
    setActivePhaseId((current) => activeWorkflow.phases.some((phase) => phase.id === current) ? current : activeWorkflow.phases[0]?.id ?? "");
  }, [activeWorkflow]);

  function updateWorkflow(updater: (workflow: WorkflowTemplate) => WorkflowTemplate) {
    if (!activeWorkflow) return;
    setWorkflows((current) => current.map((workflow) => (workflow.id === activeWorkflow.id ? updater(workflow) : workflow)));
  }

  function updateWorkflowField<K extends keyof WorkflowTemplate>(key: K, value: WorkflowTemplate[K]) {
    updateWorkflow((workflow) => ({ ...workflow, [key]: value }));
  }

  function updatePhase(updater: (phase: WorkflowPhaseTemplate) => WorkflowPhaseTemplate) {
    if (!activePhase) return;
    updateWorkflow((workflow) => ({
      ...workflow,
      phases: workflow.phases.map((phase) => (phase.id === activePhase.id ? updater(phase) : phase)),
    }));
  }

  function updatePhaseField<K extends keyof WorkflowPhaseTemplate>(key: K, value: WorkflowPhaseTemplate[K]) {
    updatePhase((phase) => ({ ...phase, [key]: value }));
  }

  function addPhase() {
    if (!activeWorkflow) return;
    const nextPhase = phaseFactory(activeWorkflow.phases.length, roles[0].key);
    updateWorkflow((workflow) => ({ ...workflow, phases: [...workflow.phases, nextPhase] }));
    setActivePhaseId(nextPhase.id);
    toast.success("New workflow phase added to the draft model.");
  }

  function removePhase() {
    if (!activeWorkflow || !activePhase) return;
    if (activeWorkflow.phases.length === 1) {
      toast.error("A workflow must keep at least one phase.");
      return;
    }
    const currentIndex = activeWorkflow.phases.findIndex((phase) => phase.id === activePhase.id);
    const nextPhase = activeWorkflow.phases[currentIndex - 1] ?? activeWorkflow.phases[currentIndex + 1];
    updateWorkflow((workflow) => ({ ...workflow, phases: workflow.phases.filter((phase) => phase.id !== activePhase.id) }));
    setActivePhaseId(nextPhase.id);
    toast.info("Phase removed from workflow draft.");
  }

  function movePhase(direction: -1 | 1) {
    if (!activeWorkflow || !activePhase) return;
    const index = activeWorkflow.phases.findIndex((phase) => phase.id === activePhase.id);
    const target = index + direction;
    if (target < 0 || target >= activeWorkflow.phases.length) return;
    updateWorkflow((workflow) => ({ ...workflow, phases: reorderItems(workflow.phases, index, target) }));
  }

  function reorderPhaseByIds(sourcePhaseId: string, targetPhaseId: string) {
    if (!activeWorkflow || sourcePhaseId === targetPhaseId) return;
    const sourceIndex = activeWorkflow.phases.findIndex((phase) => phase.id === sourcePhaseId);
    const targetIndex = activeWorkflow.phases.findIndex((phase) => phase.id === targetPhaseId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    updateWorkflow((workflow) => ({ ...workflow, phases: reorderItems(workflow.phases, sourceIndex, targetIndex) }));
    setActivePhaseId(sourcePhaseId);
    toast.info("Phase order updated. Save the workflow to persist the new route sequence.");
  }

  function handlePhaseDragStart(event: DragEvent<HTMLDivElement>, phaseId: string) {
    setDraggingPhaseId(phaseId);
    setActivePhaseId(phaseId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", phaseId);
  }

  function handlePhaseDragOver(event: DragEvent<HTMLDivElement>, phaseId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverPhaseId(phaseId);
  }

  function handlePhaseDrop(event: DragEvent<HTMLDivElement>, targetPhaseId: string) {
    event.preventDefault();
    const sourcePhaseId = event.dataTransfer.getData("text/plain") || draggingPhaseId;
    setDraggingPhaseId("");
    setDragOverPhaseId("");
    if (!sourcePhaseId) return;
    reorderPhaseByIds(sourcePhaseId, targetPhaseId);
  }

  function handlePhaseDragEnd() {
    setDraggingPhaseId("");
    setDragOverPhaseId("");
  }

  function duplicateWorkflow() {
    if (!activeWorkflow) return;
    const timestamp = Date.now();
    const copy: WorkflowTemplate = {
      ...activeWorkflow,
      id: `${activeWorkflow.id}-copy-${timestamp}`,
      name: `${activeWorkflow.name} Copy`,
      status: "Draft",
      version: "0.1",
      phases: activeWorkflow.phases.map((phase, index) => ({ ...phase, id: `${phase.id}-copy-${timestamp}-${index}` })),
    };
    setWorkflows((current) => [...current, copy]);
    setActiveWorkflowId(copy.id);
    setActivePhaseId(copy.phases[0].id);
    toast.info("Workflow duplicated as a draft template. Save it to persist the copy.");
  }

  function createWorkflow() {
    const firstPhase = phaseFactory(0, "coordinator");
    const draft: WorkflowTemplate = {
      id: `wf-new-${Date.now()}`,
      name: "New controlled workflow",
      description: "Define purpose, ownership, permissions, gates, and evidence requirements before activation.",
      status: "Draft",
      projectType: "Custom project type",
      version: "0.1",
      phases: [firstPhase],
    };
    setWorkflows((current) => [...current, draft]);
    setActiveWorkflowId(draft.id);
    setActivePhaseId(firstPhase.id);
    toast.success("Blank workflow created. Save it when the first version is ready.");
  }

  function syncRequiredPermission() {
    if (!activePhase || !selectedRole) return;
    if (roleHasPermission) {
      toast.info("Selected role already has the required permission.");
      return;
    }
    setRoles((current) => current.map((role) => role.key === selectedRole.key ? { ...role, permissionKeys: [...role.permissionKeys, activePhase.requiredPermissionKey] } : role));
      toast.success(`${selectedRole.name} synced with ${permissionLabel(allPermissions, activePhase.requiredPermissionKey)} permission.`);
  }

  function saveDraft() {
    if (!activeWorkflow) {
      toast.error("Create or select a workflow before saving.");
      return;
    }
    if (activeWorkflow.phases.length === 0) {
      toast.error("A workflow must include at least one phase before it can be saved.");
      return;
    }
    saveWorkflowMutation.mutate(activeWorkflow);
  }

  const headerActions = (
    <>
      <Link href="/access-control" className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-extrabold text-cyan-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-100">
        <ShieldCheck className="h-4 w-4" /> Access model
      </Link>
      <button onClick={saveDraft} disabled={!activeWorkflow || saveWorkflowMutation.isPending} className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold text-white shadow-lg transition ${!activeWorkflow || saveWorkflowMutation.isPending ? "cursor-not-allowed bg-slate-400" : "bg-slate-950 hover:-translate-y-0.5 hover:bg-slate-800"}`}>
        <Save className="h-4 w-4" /> {saveWorkflowMutation.isPending ? "Saving..." : "Save workflow"}
      </button>
    </>
  );

  if ((workflowQuery.isLoading || accessControlQuery.isLoading) && (workflows.length === 0 || roles.length === 0)) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workflow governance"
          title="Workflow Studio"
          description="Loading workflow templates from the database so the studio reflects persisted operational routes."
          actions={headerActions}
        />
        <div className="sbts-card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-cyan-50 text-cyan-700">
            <Workflow className="h-7 w-7 animate-pulse" />
          </div>
          <h3 className="mt-4 text-lg font-extrabold text-slate-950">Loading workflow templates</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">The Node.js API is reading workflow_templates and workflow_phases from the managed SQL database.</p>
        </div>
      </div>
    );
  }

  if ((workflowQuery.error || accessControlQuery.error) && (workflows.length === 0 || roles.length === 0)) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workflow governance"
          title="Workflow Studio"
          description="The studio could not read workflow templates from the database."
          actions={headerActions}
        />
        <div className="sbts-card border-red-100 bg-red-50 p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-600" />
          <h3 className="mt-4 text-lg font-extrabold text-red-950">Database connection failed</h3>
          <p className="mt-2 text-sm leading-6 text-red-800">{workflowQuery.error?.message ?? accessControlQuery.error?.message}</p>
          <button onClick={() => { void workflowQuery.refetch(); void accessControlQuery.refetch(); }} className="mt-5 rounded-2xl bg-red-700 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-800">
            Retry loading workflows
          </button>
        </div>
      </div>
    );
  }

  if (!activeWorkflow || !activePhase) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workflow governance"
          title="Workflow Studio"
          description="No workflow template is currently selected. Create the first controlled route to begin."
          actions={headerActions}
        />
        <div className="sbts-card p-8 text-center">
          <GitBranch className="mx-auto h-10 w-10 text-cyan-700" />
          <h3 className="mt-4 text-lg font-extrabold text-slate-950">No workflow templates available</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Create a draft template, then save it to persist the workflow in the database.</p>
          <button onClick={createWorkflow} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-sm transition hover:bg-cyan-400">
            <Plus className="h-4 w-4" /> Create workflow
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflow governance"
        title="Workflow Studio"
        description="Create, edit, and validate operational workflow routes while keeping every phase tied to role ownership and system permissions from the centralized access model."
        actions={headerActions}
      />

      {workflowQuery.isFetching && !workflowQuery.isLoading && (
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-900">
          Refreshing workflow data from the database...
        </div>
      )}

      {(workflowQuery.error || accessControlQuery.error) && workflows.length > 0 && roles.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
          Showing the latest local draft state because the API refresh failed: {workflowQuery.error?.message ?? accessControlQuery.error?.message}
        </div>
      )}

      <div className="grid gap-6 2xl:grid-cols-[330px_1fr_390px]">
        <aside className="sbts-card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-950">Workflow templates</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">Routes connected to RBAC.</p>
              </div>
              <button onClick={createWorkflow} className="rounded-2xl bg-cyan-50 p-2.5 text-cyan-700 ring-1 ring-cyan-100 transition hover:bg-cyan-100" aria-label="Create workflow">
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="space-y-2 p-3">
            {workflows.map((workflow) => {
              const active = workflow.id === activeWorkflow.id;
              const workflowScore = complianceScore(workflow, roles);
              return (
                <button key={workflow.id} onClick={() => { setActiveWorkflowId(workflow.id); setActivePhaseId(workflow.phases[0]?.id ?? ""); }} className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-cyan-200 bg-cyan-50 shadow-sm" : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      <Workflow className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-extrabold text-slate-950">{workflow.name}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{workflow.projectType} · v{workflow.version}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white/70 px-2 py-2"><div className="text-sm font-extrabold text-slate-950">{workflow.phases.length}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phases</div></div>
                    <div className="rounded-xl bg-white/70 px-2 py-2"><div className="text-sm font-extrabold text-slate-950">{workflowScore}%</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aligned</div></div>
                    <div className="rounded-xl bg-white/70 px-2 py-2"><div className="text-sm font-extrabold text-slate-950">{workflow.status}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">State</div></div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="sbts-card p-5">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.8fr_0.45fr_0.35fr]">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Workflow name</span>
                <input value={activeWorkflow.name} onChange={(event) => updateWorkflowField("name", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100" />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Project type</span>
                <input value={activeWorkflow.projectType} onChange={(event) => updateWorkflowField("projectType", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100" />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Status</span>
                <select value={activeWorkflow.status} onChange={(event) => updateWorkflowField("status", event.target.value as WorkflowStatus)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100">
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Version</span>
                <input value={activeWorkflow.version} onChange={(event) => updateWorkflowField("version", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100" />
              </label>
            </div>
            <textarea value={activeWorkflow.description} onChange={(event) => updateWorkflowField("description", event.target.value)} className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100" />
          </div>

          <div className="sbts-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-extrabold text-slate-950">Interactive phase route</h3>
                <p className="mt-1 text-sm text-slate-500">Drag phases to reorder the route, then save to persist the sequence with owner roles, permissions, gates, and evidence rules.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={duplicateWorkflow} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700"><Copy className="h-4 w-4" /> Duplicate</button>
                <button onClick={addPhase} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-3 py-2 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-cyan-400"><Plus className="h-4 w-4" /> Add phase</button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {activeWorkflow.phases.map((phase, index) => {
                const selected = phase.id === activePhase.id;
                const owner = roles.find((role) => role.key === phase.roleKey);
                const aligned = owner?.permissionKeys.includes(phase.requiredPermissionKey) ?? false;
                return (
                  <div
                    key={phase.id}
                    role="button"
                    tabIndex={0}
                    draggable
                    onClick={() => setActivePhaseId(phase.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActivePhaseId(phase.id);
                      }
                    }}
                    onDragStart={(event) => handlePhaseDragStart(event, phase.id)}
                    onDragOver={(event) => handlePhaseDragOver(event, phase.id)}
                    onDrop={(event) => handlePhaseDrop(event, phase.id)}
                    onDragEnd={handlePhaseDragEnd}
                    aria-label={`Select and drag ${phase.label} phase`}
                    className={`group w-full cursor-grab rounded-[1.35rem] border p-4 text-left outline-none transition active:cursor-grabbing ${selected ? "border-cyan-300 bg-cyan-50 shadow-md" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"} ${draggingPhaseId === phase.id ? "scale-[0.985] opacity-60 ring-4 ring-cyan-100" : ""} ${dragOverPhaseId === phase.id && draggingPhaseId !== phase.id ? "border-cyan-400 bg-cyan-50/80 shadow-lg ring-4 ring-cyan-100" : ""}`}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                      <div className="flex items-center gap-4 xl:w-[38%]">
                        <span className="flex h-11 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 transition group-hover:border-cyan-200 group-hover:bg-cyan-50 group-hover:text-cyan-700" aria-hidden="true">
                          <GripVertical className="h-5 w-5" />
                        </span>
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: phase.color }}>
                          <span className="text-sm font-extrabold">{index + 1}</span>
                          {index < activeWorkflow.phases.length - 1 && <span className="absolute left-1/2 top-full hidden h-8 w-px -translate-x-1/2 bg-slate-200 xl:block" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base font-extrabold text-slate-950">{phase.label}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500"><span>{roleName(roles, phase.roleKey)}</span><span>·</span><span>{permissionLabel(allPermissions, phase.requiredPermissionKey)}</span></div>
                          <div className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-cyan-700 opacity-0 transition group-hover:opacity-100">Drag to reorder route</div>
                        </div>
                      </div>
                      <div className="grid flex-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gate</div><div className="mt-1 truncate text-xs font-bold text-slate-700">{phase.gate}</div></div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SLA</div><div className="mt-1 text-xs font-bold text-slate-700">{phase.slaHours} hours</div></div>
                        <div className={`rounded-2xl px-3 py-2 ring-1 ${aligned ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-amber-50 text-amber-900 ring-amber-100"}`}><div className="text-[10px] font-bold uppercase tracking-wider opacity-70">RBAC</div><div className="mt-1 flex items-center gap-1.5 text-xs font-extrabold">{aligned ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{aligned ? "Aligned" : "Needs sync"}</div></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="sbts-card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold">Phase editor</h3>
                  <p className="mt-1 text-xs font-medium text-slate-300">Change phase logic and access ownership.</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => movePhase(-1)} className="rounded-xl bg-white/10 p-2 text-slate-200 transition hover:bg-white/20" aria-label="Move phase up"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => movePhase(1)} className="rounded-xl bg-white/10 p-2 text-slate-200 transition hover:bg-white/20" aria-label="Move phase down"><ArrowDown className="h-4 w-4" /></button>
                  <button onClick={removePhase} className="rounded-xl bg-red-400/15 p-2 text-red-100 transition hover:bg-red-400/25" aria-label="Remove phase"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Phase label</span>
                <input value={activePhase.label} onChange={(event) => updatePhaseField("label", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100" />
              </label>

              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Phase family</span>
                  <select value={activePhase.phaseKey} onChange={(event) => {
                    const next = phaseOptions.find((option) => option.key === event.target.value)!;
                    updatePhase((phase) => ({ ...phase, phaseKey: next.key, color: next.color }));
                  }} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100">
                    {phaseOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Owner role</span>
                  <select value={activePhase.roleKey} onChange={(event) => updatePhaseField("roleKey", event.target.value as RoleKey)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100">
                    {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Required permission</span>
                <select value={activePhase.requiredPermissionKey} onChange={(event) => updatePhaseField("requiredPermissionKey", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100">
                  {permissionGroups.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.permissions.map((permission) => <option key={permission.key} value={permission.key}>{permission.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>

              <div className={`rounded-2xl border p-4 ${roleHasPermission ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${roleHasPermission ? "bg-emerald-600 text-white" : "bg-amber-400 text-slate-950"}`}>
                    {roleHasPermission ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className={`text-sm font-extrabold ${roleHasPermission ? "text-emerald-900" : "text-amber-950"}`}>{roleHasPermission ? "Permission model aligned" : "Permission sync required"}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-700">{selectedRole.name} {roleHasPermission ? "already owns" : "does not yet own"} the required permission: {permissionLabel(allPermissions, activePhase.requiredPermissionKey)}.</p>
                    {!roleHasPermission && <button onClick={syncRequiredPermission} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-slate-800"><Link2 className="h-4 w-4" /> Sync to role</button>}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Gate condition</span>
                <textarea value={activePhase.gate} onChange={(event) => updatePhaseField("gate", event.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100" />
              </label>

              <div className="grid gap-3 sm:grid-cols-[0.55fr_1fr] 2xl:grid-cols-1">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">SLA hours</span>
                  <input type="number" min="1" value={activePhase.slaHours} onChange={(event) => updatePhaseField("slaHours", Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Evidence required</span>
                  <input value={activePhase.evidence.join(", ")} onChange={(event) => updatePhaseField("evidence", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Automation</span>
                <input value={activePhase.automation} onChange={(event) => updatePhaseField("automation", event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100" />
              </label>

              <button onClick={() => updatePhaseField("isCritical", !activePhase.isCritical)} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${activePhase.isCritical ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                <span><span className="block text-sm font-extrabold">Critical gate</span><span className="mt-1 block text-xs opacity-75">Requires stricter review before next phase.</span></span>
                <span className={`h-6 w-11 rounded-full p-1 transition ${activePhase.isCritical ? "bg-red-500" : "bg-slate-300"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${activePhase.isCritical ? "translate-x-5" : "translate-x-0"}`} /></span>
              </button>
            </div>
          </section>

          <section className="sbts-card p-5">
            <div className="mb-4 flex items-center gap-3"><Layers3 className="h-5 w-5 text-cyan-700" /><h3 className="font-extrabold text-slate-950">Governance summary</h3></div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"><div className="text-xl font-extrabold text-slate-950">{score}%</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aligned</div></div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"><div className="text-xl font-extrabold text-slate-950">{activeWorkflow.phases.filter((phase) => phase.isCritical).length}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Critical</div></div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"><div className="text-xl font-extrabold text-slate-950">{new Set(activeWorkflow.phases.map((phase) => phase.roleKey)).size}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Roles</div></div>
            </div>
            <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm leading-6 text-cyan-950">
              This studio is connected to the same role and permission catalog used by Access Control. The save action now persists workflow templates and phase rules through Node.js APIs backed by SQL workflow tables.
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
