import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  blindQrTokens,
  blinds,
  blindWorkflowLogs,
  projects,
} from "../../drizzle/schema";
import { requireDb } from "./core";
import { getSecuritySettings } from "./settings";
import type { ActingProjectUser } from "./types";
import { assertAnyWorkflowPermission } from "./workflowRuntime";
import {
  broadcastNotification,
  getOperationalNotificationRecipients,
} from "./notifications";

export const BLIND_QR_VERIFICATION_ROUTE = "/blind/verify";

export type BlindQrStatus = "active" | "superseded" | "revoked";
export type BlindQrDomainErrorCode =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "NOT_FOUND"
  | "UNAUTHORIZED";

export class BlindQrDomainError extends Error {
  constructor(
    readonly code: BlindQrDomainErrorCode,
    message: string
  ) {
    super(message);
    this.name = "BlindQrDomainError";
  }
}

type BlindQrScope = {
  projectId: string;
  blindTag: string;
};

type ManagedBlindQrToken = {
  id: number;
  verificationToken: string;
  verificationUrl: string;
  version: number;
  status: BlindQrStatus;
  issuedAt: Date;
  previousTokenId: number | null;
  revokedAt: Date | null;
  revocationReason: string | null;
  lastScannedAt: Date | null;
  scanCount: number;
};

type BlindQrPublicSource = {
  version: number;
  status: BlindQrStatus;
  issuedAt: Date;
  revokedAt: Date | null;
  project: {
    id: string;
    name: string;
    status: string;
  };
  blind: {
    tag: string;
    type: string;
    size: string;
    rate: string | null;
    phase: string;
    priority: string;
    equipment: string | null;
    material: string | null;
    flangeType: string | null;
    lineNumber: string | null;
  };
};

export function createBlindQrVerificationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function buildBlindQrVerificationUrl(token: string): string {
  return `${BLIND_QR_VERIFICATION_ROUTE}/${encodeURIComponent(token)}`;
}

export function nextBlindQrVersion(
  rows: ReadonlyArray<{ version: number }>
): number {
  return rows.reduce((highest, row) => Math.max(highest, row.version), 0) + 1;
}

type BlindQrLifecycleRow = {
  id: number;
  version: number;
  status: BlindQrStatus;
};

export function planBlindQrLifecycle(
  action: "generate" | "rotate" | "revoke",
  rows: ReadonlyArray<BlindQrLifecycleRow>
) {
  const active = rows.find(row => row.status === "active") ?? null;
  const latest = rows.reduce<BlindQrLifecycleRow | null>(
    (current, row) =>
      !current || row.version > current.version ? row : current,
    null
  );
  if (action === "generate") {
    if (active) {
      throw new BlindQrDomainError(
        "CONFLICT",
        "An active QR token already exists. Use controlled rotation."
      );
    }
    return {
      active: null,
      version: nextBlindQrVersion(rows),
      previousTokenId: latest?.id ?? null,
    };
  }
  if (!active) {
    throw new BlindQrDomainError(
      "CONFLICT",
      action === "rotate"
        ? "No active QR token exists to rotate."
        : "No active QR token exists to revoke."
    );
  }
  return {
    active,
    version: action === "rotate" ? nextBlindQrVersion(rows) : active.version,
    previousTokenId: active.id,
  };
}

/**
 * The public payload is deliberately allowlisted. Never spread a database row
 * here: QR verification must not disclose actors, permits, LOTO records,
 * evidence, notes, isolation details, internal IDs, or the verification token.
 */
export function buildBlindQrPublicPayload(
  source: BlindQrPublicSource,
  scannedAt: Date
) {
  return {
    verification: {
      status: source.status,
      valid: source.status === "active",
      version: source.version,
      issuedAt: source.issuedAt,
      revokedAt: source.revokedAt,
      scannedAt,
    },
    project: {
      id: source.project.id,
      name: source.project.name,
      status: source.project.status,
    },
    blind: {
      tag: source.blind.tag,
      type: source.blind.type,
      size: source.blind.size,
      rating: source.blind.rate,
      phase: source.blind.phase,
      priority: source.blind.priority,
      equipment: source.blind.equipment,
      material: source.blind.material,
      flangeType: source.blind.flangeType,
      lineNumber: source.blind.lineNumber,
    },
  };
}

function toManagedToken(
  row: typeof blindQrTokens.$inferSelect
): ManagedBlindQrToken {
  return {
    id: row.id,
    verificationToken: row.verificationToken,
    verificationUrl: buildBlindQrVerificationUrl(row.verificationToken),
    version: row.version,
    status: row.status as BlindQrStatus,
    issuedAt: row.issuedAt,
    previousTokenId: row.previousTokenId ?? null,
    revokedAt: row.revokedAt ?? null,
    revocationReason: row.revocationReason ?? null,
    lastScannedAt: row.lastScannedAt ?? null,
    scanCount: row.scanCount,
  };
}

function toManagedStateItem(
  projectId: string,
  blindTag: string,
  rows: Array<typeof blindQrTokens.$inferSelect>
) {
  const tokens = rows.map(toManagedToken);
  return {
    projectId,
    blindTag,
    active: tokens.find(token => token.status === "active") ?? null,
    tokens,
  };
}

function uniqueBlindTags(blindTags: string[]) {
  return Array.from(new Set(blindTags.map(tag => tag.trim()).filter(Boolean)));
}

function actorName(actor: ActingProjectUser): string {
  return actor.name ?? actor.email ?? actor.openId;
}

async function notifyBlindQrGovernance(input: {
  projectId: string;
  blindTag?: string;
  event: "issued" | "rotated" | "revoked";
  actor: ActingProjectUser;
  body: string;
}) {
  const recipients = await getOperationalNotificationRecipients(
    ["coordinator", "operationsForeman"],
    [input.actor.openId]
  );
  const label = input.blindTag ?? input.projectId;
  await broadcastNotification(recipients, {
    actorOpenId: input.actor.openId,
    actorName: actorName(input.actor),
    type:
      input.event === "issued"
        ? "qr_token_issued"
        : input.event === "rotated"
          ? "qr_token_rotated"
          : "qr_token_revoked",
    priority:
      input.event === "revoked"
        ? "warning"
        : input.event === "rotated"
          ? "action"
          : "info",
    title: `Blind QR ${input.event} · ${label}`,
    body: input.body,
    linkUrl: input.blindTag
      ? `/projects/${encodeURIComponent(input.projectId)}/blinds/${encodeURIComponent(input.blindTag)}`
      : `/tags/print/${encodeURIComponent(input.projectId)}`,
    projectId: input.projectId,
    blindTag: input.blindTag,
  });
}

async function assertQrManager(actor: ActingProjectUser) {
  await assertAnyWorkflowPermission(actor, ["qr.manage"]);
}

type QrDatabase = Awaited<ReturnType<typeof requireDb>>;
type QrTransaction = Parameters<Parameters<QrDatabase["transaction"]>[0]>[0];

async function lockBlindIdentity(tx: QrTransaction, input: BlindQrScope) {
  const identity = (
    await tx
      .select({
        projectId: projects.id,
        blindTag: blinds.tag,
        phase: blinds.phase,
      })
      .from(blinds)
      .innerJoin(projects, eq(projects.id, blinds.projectId))
      .where(
        and(
          eq(blinds.projectId, input.projectId),
          eq(blinds.tag, input.blindTag)
        )
      )
      .for("update")
      .limit(1)
  )[0];
  if (!identity) {
    throw new BlindQrDomainError(
      "NOT_FOUND",
      "Project or blind was not found."
    );
  }
  return identity;
}

function getScopedTokens(tx: QrTransaction, input: BlindQrScope) {
  return tx
    .select()
    .from(blindQrTokens)
    .where(
      and(
        eq(blindQrTokens.projectId, input.projectId),
        eq(blindQrTokens.blindTag, input.blindTag)
      )
    )
    .orderBy(desc(blindQrTokens.version));
}

async function insertActiveBlindQrToken(
  tx: QrTransaction,
  input: BlindQrScope & { version: number; previousTokenId: number | null },
  actor: ActingProjectUser,
  issuedAt: Date
) {
  const verificationToken = createBlindQrVerificationToken();
  const inserted = await tx
    .insert(blindQrTokens)
    .values({
      projectId: input.projectId,
      blindTag: input.blindTag,
      verificationToken,
      version: input.version,
      status: "active",
      issuedByOpenId: actor.openId,
      issuedAt,
      previousTokenId: input.previousTokenId,
      scanCount: 0,
      createdAt: issuedAt,
      updatedAt: issuedAt,
    })
    .$returningId();
  const id = inserted[0]?.id;
  if (!id) {
    throw new Error("QR token insert did not return an identifier.");
  }
  return {
    id,
    projectId: input.projectId,
    blindTag: input.blindTag,
    verificationToken,
    version: input.version,
    status: "active" as const,
    issuedByOpenId: actor.openId,
    issuedAt,
    previousTokenId: input.previousTokenId,
    revokedByOpenId: null,
    revokedAt: null,
    revocationReason: null,
    lastScannedAt: null,
    scanCount: 0,
    createdAt: issuedAt,
    updatedAt: issuedAt,
  } satisfies typeof blindQrTokens.$inferSelect;
}

function writeQrAudit(
  tx: QrTransaction,
  input: BlindQrScope & { phase: typeof blinds.$inferSelect.phase },
  actor: ActingProjectUser,
  action: string,
  message: string
) {
  return tx.insert(blindWorkflowLogs).values({
    projectId: input.projectId,
    blindTag: input.blindTag,
    phase: input.phase,
    action,
    message,
    actorOpenId: actor.openId,
    actorName: actorName(actor),
  });
}

export async function getBlindQrState(
  input: BlindQrScope,
  actor: ActingProjectUser
) {
  await assertQrManager(actor);
  const db = await requireDb();
  const identity = (
    await db
      .select({ projectId: projects.id, blindTag: blinds.tag })
      .from(blinds)
      .innerJoin(projects, eq(projects.id, blinds.projectId))
      .where(
        and(
          eq(blinds.projectId, input.projectId),
          eq(blinds.tag, input.blindTag)
        )
      )
      .limit(1)
  )[0];
  if (!identity) {
    throw new BlindQrDomainError(
      "NOT_FOUND",
      "Project or blind was not found."
    );
  }

  const rows = await db
    .select()
    .from(blindQrTokens)
    .where(
      and(
        eq(blindQrTokens.projectId, input.projectId),
        eq(blindQrTokens.blindTag, input.blindTag)
      )
    )
    .orderBy(desc(blindQrTokens.version));
  return toManagedStateItem(identity.projectId, identity.blindTag, rows);
}

export async function getBlindQrBatchState(
  input: { projectId: string; blindTags: string[] },
  actor: ActingProjectUser
) {
  await assertAnyWorkflowPermission(actor, ["qr.manage", "reports.export"]);
  const blindTags = uniqueBlindTags(input.blindTags);
  if (blindTags.length === 0 || blindTags.length > 200) {
    throw new BlindQrDomainError(
      "BAD_REQUEST",
      "Batch QR state requires between 1 and 200 unique blind tags."
    );
  }

  const db = await requireDb();
  const identities = await db
    .select({ blindTag: blinds.tag })
    .from(blinds)
    .innerJoin(projects, eq(projects.id, blinds.projectId))
    .where(
      and(eq(blinds.projectId, input.projectId), inArray(blinds.tag, blindTags))
    );
  const found = new Set(identities.map(row => row.blindTag));
  const missing = blindTags.filter(tag => !found.has(tag));
  if (missing.length > 0) {
    throw new BlindQrDomainError(
      "NOT_FOUND",
      `Project or blind was not found: ${missing.join(", ")}.`
    );
  }

  const rows = await db
    .select()
    .from(blindQrTokens)
    .where(
      and(
        eq(blindQrTokens.projectId, input.projectId),
        inArray(blindQrTokens.blindTag, blindTags)
      )
    )
    .orderBy(asc(blindQrTokens.blindTag), desc(blindQrTokens.version));
  return {
    projectId: input.projectId,
    items: blindTags.map(blindTag =>
      toManagedStateItem(
        input.projectId,
        blindTag,
        rows.filter(row => row.blindTag === blindTag)
      )
    ),
  };
}

export async function generateBlindQrBatch(
  input: { projectId: string; blindTags: string[] },
  actor: ActingProjectUser
) {
  await assertQrManager(actor);
  const blindTags = uniqueBlindTags(input.blindTags);
  if (blindTags.length === 0 || blindTags.length > 200) {
    throw new BlindQrDomainError(
      "BAD_REQUEST",
      "Batch QR generation requires between 1 and 200 unique blind tags."
    );
  }

  const db = await requireDb();
  const result = await db.transaction(async tx => {
    // Lock the selected Blind rows in a stable order so concurrent batch and
    // single-token operations cannot create two active versions.
    const identities = await tx
      .select({ blindTag: blinds.tag, phase: blinds.phase })
      .from(blinds)
      .innerJoin(projects, eq(projects.id, blinds.projectId))
      .where(
        and(
          eq(blinds.projectId, input.projectId),
          inArray(blinds.tag, blindTags)
        )
      )
      .orderBy(asc(blinds.tag))
      .for("update");
    const identityByTag = new Map(identities.map(row => [row.blindTag, row]));
    const missing = blindTags.filter(tag => !identityByTag.has(tag));
    if (missing.length > 0) {
      throw new BlindQrDomainError(
        "NOT_FOUND",
        `Project or blind was not found: ${missing.join(", ")}.`
      );
    }

    const existing = await tx
      .select()
      .from(blindQrTokens)
      .where(
        and(
          eq(blindQrTokens.projectId, input.projectId),
          inArray(blindQrTokens.blindTag, blindTags)
        )
      )
      .orderBy(asc(blindQrTokens.blindTag), desc(blindQrTokens.version));
    const rowsByTag = new Map<
      string,
      Array<typeof blindQrTokens.$inferSelect>
    >();
    for (const blindTag of blindTags) rowsByTag.set(blindTag, []);
    for (const row of existing) rowsByTag.get(row.blindTag)?.push(row);

    const now = new Date();
    let generatedCount = 0;
    for (const blindTag of blindTags) {
      const rows = rowsByTag.get(blindTag) ?? [];
      if (rows.some(row => row.status === "active")) continue;

      const lifecycle = planBlindQrLifecycle("generate", rows);
      const insertedRow = await insertActiveBlindQrToken(
        tx,
        {
          projectId: input.projectId,
          blindTag,
          version: lifecycle.version,
          previousTokenId: lifecycle.previousTokenId,
        },
        actor,
        now
      );
      rows.unshift(insertedRow);
      generatedCount += 1;

      await writeQrAudit(
        tx,
        {
          projectId: input.projectId,
          blindTag,
          phase: identityByTag.get(blindTag)!.phase,
        },
        actor,
        "Blind QR Generated",
        `Blind QR token version ${lifecycle.version} generated by batch print preparation.`
      );
    }

    return {
      projectId: input.projectId,
      generatedCount,
      preservedCount: blindTags.length - generatedCount,
      items: blindTags.map(blindTag =>
        toManagedStateItem(
          input.projectId,
          blindTag,
          rowsByTag.get(blindTag) ?? []
        )
      ),
    };
  });
  if (result.generatedCount > 0) {
    await notifyBlindQrGovernance({
      projectId: input.projectId,
      event: "issued",
      actor,
      body: `${result.generatedCount} secure blind QR token${result.generatedCount === 1 ? " was" : "s were"} generated for controlled tag printing.`,
    }).catch(() => undefined);
  }
  return result;
}

export async function generateBlindQrToken(
  input: BlindQrScope,
  actor: ActingProjectUser
) {
  await assertQrManager(actor);
  const db = await requireDb();
  const result = await db.transaction(async tx => {
    const identity = await lockBlindIdentity(tx, input);
    const existing = await getScopedTokens(tx, input);
    const lifecycle = planBlindQrLifecycle("generate", existing);
    const now = new Date();
    const inserted = await insertActiveBlindQrToken(
      tx,
      {
        projectId: input.projectId,
        blindTag: input.blindTag,
        version: lifecycle.version,
        previousTokenId: lifecycle.previousTokenId,
      },
      actor,
      now
    );
    await writeQrAudit(
      tx,
      identity,
      actor,
      "Blind QR Generated",
      `Blind QR token version ${lifecycle.version} generated.`
    );
    return toManagedToken(inserted);
  });
  await notifyBlindQrGovernance({
    projectId: input.projectId,
    blindTag: input.blindTag,
    event: "issued",
    actor,
    body: `Secure blind QR version ${result.version} was issued.`,
  }).catch(() => undefined);
  return result;
}

export async function rotateBlindQrToken(
  input: BlindQrScope,
  actor: ActingProjectUser
) {
  await assertQrManager(actor);
  const db = await requireDb();
  const result = await db.transaction(async tx => {
    const identity = await lockBlindIdentity(tx, input);
    const existing = await getScopedTokens(tx, input);
    const lifecycle = planBlindQrLifecycle("rotate", existing);
    const active = lifecycle.active!;
    const now = new Date();
    await tx
      .update(blindQrTokens)
      .set({ status: "superseded", updatedAt: now })
      .where(eq(blindQrTokens.id, active.id));
    const inserted = await insertActiveBlindQrToken(
      tx,
      {
        projectId: input.projectId,
        blindTag: input.blindTag,
        version: lifecycle.version,
        previousTokenId: active.id,
      },
      actor,
      now
    );
    await writeQrAudit(
      tx,
      identity,
      actor,
      "Blind QR Rotated",
      `Blind QR token version ${active.version} superseded by version ${lifecycle.version}.`
    );
    return toManagedToken(inserted);
  });
  await notifyBlindQrGovernance({
    projectId: input.projectId,
    blindTag: input.blindTag,
    event: "rotated",
    actor,
    body: `Secure blind QR was rotated to version ${result.version}; earlier printed codes are superseded.`,
  }).catch(() => undefined);
  return result;
}

export async function revokeBlindQrToken(
  input: BlindQrScope & { reason: string },
  actor: ActingProjectUser
) {
  await assertQrManager(actor);
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new BlindQrDomainError(
      "BAD_REQUEST",
      "A revocation reason of at least 5 characters is required."
    );
  }

  const db = await requireDb();
  const result = await db.transaction(async tx => {
    const identity = await lockBlindIdentity(tx, input);
    const active = (
      await tx
        .select()
        .from(blindQrTokens)
        .where(
          and(
            eq(blindQrTokens.projectId, input.projectId),
            eq(blindQrTokens.blindTag, input.blindTag),
            eq(blindQrTokens.status, "active")
          )
        )
        .orderBy(desc(blindQrTokens.version))
        .limit(1)
    )[0];
    const lifecycle = planBlindQrLifecycle("revoke", active ? [active] : []);
    const activeToken = lifecycle.active!;

    const now = new Date();
    await tx
      .update(blindQrTokens)
      .set({
        status: "revoked",
        revokedByOpenId: actor.openId,
        revokedAt: now,
        revocationReason: reason,
        updatedAt: now,
      })
      .where(eq(blindQrTokens.id, activeToken.id));
    await writeQrAudit(
      tx,
      identity,
      actor,
      "Blind QR Revoked",
      `Blind QR token version ${activeToken.version} revoked. Reason: ${reason}`
    );

    return {
      success: true as const,
      status: "revoked" as const,
      tokenId: activeToken.id,
      version: activeToken.version,
      revokedAt: now,
    };
  });
  await notifyBlindQrGovernance({
    projectId: input.projectId,
    blindTag: input.blindTag,
    event: "revoked",
    actor,
    body: `Secure blind QR version ${result.version} was revoked. Reason: ${reason}`,
  }).catch(() => undefined);
  return result;
}

export async function getPublicBlindQrVerification(
  token: string,
  options: { isAuthenticated: boolean }
) {
  const security = await getSecuritySettings();
  const authenticationRequired =
    security.qrPublicAccess !== 1 || security.qrRequireAuth === 1;
  if (authenticationRequired && !options.isAuthenticated) {
    throw new BlindQrDomainError(
      "UNAUTHORIZED",
      "Authentication is required to verify this blind QR code."
    );
  }

  const db = await requireDb();
  const source = (
    await db
      .select({
        version: blindQrTokens.version,
        status: blindQrTokens.status,
        issuedAt: blindQrTokens.issuedAt,
        revokedAt: blindQrTokens.revokedAt,
        project: {
          id: projects.id,
          name: projects.name,
          status: projects.status,
        },
        blind: {
          tag: blinds.tag,
          type: blinds.type,
          size: blinds.size,
          rate: blinds.rate,
          phase: blinds.phase,
          priority: blinds.priority,
          equipment: blinds.equipment,
          material: blinds.material,
          flangeType: blinds.flangeType,
          lineNumber: blinds.lineNumber,
        },
      })
      .from(blindQrTokens)
      .innerJoin(
        blinds,
        and(
          eq(blinds.projectId, blindQrTokens.projectId),
          eq(blinds.tag, blindQrTokens.blindTag)
        )
      )
      .innerJoin(projects, eq(projects.id, blindQrTokens.projectId))
      .where(eq(blindQrTokens.verificationToken, token))
      .limit(1)
  )[0];
  if (!source) {
    throw new BlindQrDomainError(
      "NOT_FOUND",
      "Blind QR verification token was not found."
    );
  }

  const scannedAt = new Date();
  await db
    .update(blindQrTokens)
    .set({
      lastScannedAt: scannedAt,
      scanCount: sql`${blindQrTokens.scanCount} + 1`,
      updatedAt: scannedAt,
    })
    .where(eq(blindQrTokens.verificationToken, token));

  return buildBlindQrPublicPayload(
    {
      ...source,
      status: source.status as BlindQrStatus,
      project: { ...source.project, status: source.project.status },
      blind: {
        ...source.blind,
        phase: source.blind.phase,
        priority: source.blind.priority,
      },
    },
    scannedAt
  );
}
