/**
 * server/db/workflows.ts
 * ──────────────────────
 * Workflow template CRUD helpers and getAccessControlModel.
 */

import { asc, eq } from "drizzle-orm";
import {
  accessPermissions, accessRolePermissions, accessRoles,
  workflowPhases, workflowTemplates,
} from "../../drizzle/schema";
import { requireDb } from "./core";
import {
  AccessControlModel, PermissionGroupModel, PhaseKey, RoleKey,
  RoleModel, WorkflowTemplateInput,
} from "./types";

// ─── Helpers ───────────────────────────────────────────────────────────────

function deserializeJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizeWorkflowRows(
  templates: (typeof workflowTemplates.$inferSelect)[],
  phases: (typeof workflowPhases.$inferSelect)[],
): WorkflowTemplateInput[] {
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    status: template.status,
    projectType: template.projectType,
    version: template.version,
    phases: phases
      .filter((phase) => phase.workflowId === template.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((phase) => ({
        id: phase.id,
        label: phase.label,
        phaseKey: phase.phaseKey,
        roleKey: phase.roleKey as RoleKey,
        requiredPermissionKey: phase.requiredPermissionKey,
        gate: phase.gate,
        purpose: phase.purpose ?? undefined,
        actionKey: phase.actionKey ?? undefined,
        actionLabel: phase.actionLabel ?? undefined,
        checklist: deserializeJsonArray(phase.checklistJson),
        slaHours: phase.slaHours,
        evidence: deserializeJsonArray(phase.evidenceJson),
        automation: phase.automation,
        color: phase.color,
        isCritical: phase.isCritical === 1,
      })),
  }));
}

async function assertAccessReferences(input: WorkflowTemplateInput): Promise<void> {
  // Import lazily to avoid circular dependency with seed.ts
  const { seedAccessControl } = await import("./seed");
  await seedAccessControl();
  const db = await requireDb();
  const [roleRows, permissionRows] = await Promise.all([
    db.select({ key: accessRoles.key }).from(accessRoles),
    db.select({ key: accessPermissions.key }).from(accessPermissions),
  ]);
  const roleKeys = new Set(roleRows.map((role) => role.key));
  const permissionKeys = new Set(permissionRows.map((permission) => permission.key));
  for (const phase of input.phases) {
    if (!roleKeys.has(phase.roleKey)) {
      throw new Error(`Unknown workflow role key: ${phase.roleKey}`);
    }
    if (!permissionKeys.has(phase.requiredPermissionKey)) {
      throw new Error(`Unknown workflow permission key: ${phase.requiredPermissionKey}`);
    }
  }
}

// ─── Access Control ────────────────────────────────────────────────────────

export async function getAccessControlModel(): Promise<AccessControlModel> {
  const { seedAccessControl } = await import("./seed");
  await seedAccessControl();
  const db = await requireDb();
  const [permissionRows, roleRows, assignmentRows] = await Promise.all([
    db.select().from(accessPermissions).orderBy(asc(accessPermissions.group), asc(accessPermissions.label)),
    db.select().from(accessRoles).orderBy(asc(accessRoles.name)),
    db.select().from(accessRolePermissions),
  ]);
  const groups = permissionRows.reduce<PermissionGroupModel[]>((collection, permission) => {
    let group = collection.find((item) => item.group === permission.group);
    if (!group) {
      group = { group: permission.group, permissions: [] };
      collection.push(group);
    }
    group.permissions.push({ key: permission.key, label: permission.label, description: permission.description, group: permission.group });
    return collection;
  }, []);
  const roles: RoleModel[] = roleRows.map((role) => ({
    key: role.key as RoleKey,
    name: role.name,
    subtitle: role.subtitle,
    members: role.members,
    color: role.color,
    permissionKeys: assignmentRows.filter((a) => a.roleKey === role.key).map((a) => a.permissionKey),
    menuKeys: deserializeJsonArray(role.menuKeysJson),
    phaseKeys: deserializeJsonArray(role.phaseKeysJson) as PhaseKey[],
  }));
  return { permissionGroups: groups, roles };
}

// ─── Workflow CRUD ─────────────────────────────────────────────────────────

export async function getAllWorkflows(): Promise<WorkflowTemplateInput[]> {
  const { seedAccessControl, seedWorkflows } = await import("./seed");
  await seedAccessControl();
  await seedWorkflows();
  const db = await requireDb();
  const templateRows = await db.select().from(workflowTemplates).orderBy(asc(workflowTemplates.name));
  const phaseRows = await db.select().from(workflowPhases).orderBy(asc(workflowPhases.sortOrder));
  return normalizeWorkflowRows(templateRows, phaseRows);
}

export async function getWorkflowById(id: string): Promise<WorkflowTemplateInput | undefined> {
  const db = await requireDb();
  const templateRows = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id)).limit(1);
  if (!templateRows[0]) return undefined;
  const phaseRows = await db.select().from(workflowPhases).where(eq(workflowPhases.workflowId, id)).orderBy(asc(workflowPhases.sortOrder));
  return normalizeWorkflowRows(templateRows, phaseRows)[0];
}

export async function upsertWorkflow(input: WorkflowTemplateInput, userOpenId?: string): Promise<WorkflowTemplateInput> {
  await assertAccessReferences(input);
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx
      .insert(workflowTemplates)
      .values({
        id: input.id,
        name: input.name,
        description: input.description,
        status: input.status,
        projectType: input.projectType,
        version: input.version,
        createdByOpenId: userOpenId,
        updatedByOpenId: userOpenId,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: input.name,
          description: input.description,
          status: input.status,
          projectType: input.projectType,
          version: input.version,
          updatedByOpenId: userOpenId,
        },
      });
    await tx.delete(workflowPhases).where(eq(workflowPhases.workflowId, input.id));
    if (input.phases.length > 0) {
      await tx.insert(workflowPhases).values(
        input.phases.map((phase, index) => ({
          id: phase.id,
          workflowId: input.id,
          sortOrder: index,
          label: phase.label,
          phaseKey: phase.phaseKey,
          roleKey: phase.roleKey,
          requiredPermissionKey: phase.requiredPermissionKey,
          gate: phase.gate,
          purpose: phase.purpose ?? null,
          actionKey: phase.actionKey ?? null,
          actionLabel: phase.actionLabel ?? null,
          checklistJson: JSON.stringify(phase.checklist ?? []),
          slaHours: phase.slaHours,
          evidenceJson: JSON.stringify(phase.evidence),
          automation: phase.automation,
          color: phase.color,
          isCritical: phase.isCritical ? 1 : 0,
        })),
      );
    }
  });
  const saved = await getWorkflowById(input.id);
  if (!saved) throw new Error("Workflow could not be read after save.");
  return saved;
}

export async function deleteWorkflow(id: string): Promise<void> {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx.delete(workflowPhases).where(eq(workflowPhases.workflowId, id));
    await tx.delete(workflowTemplates).where(eq(workflowTemplates.id, id));
  });
}
