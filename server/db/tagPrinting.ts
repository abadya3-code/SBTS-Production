import { and, eq, inArray } from "drizzle-orm";
import {
  blindQrTokens,
  blinds,
  blindWorkflowLogs,
} from "../../drizzle/schema";
import { requireDb } from "./core";
import {
  broadcastNotification,
  getOperationalNotificationRecipients,
} from "./notifications";
import type { ActingProjectUser } from "./types";

export async function prepareBlindTagPrint(input: {
  projectId: string;
  blindTags: string[];
  output: "print" | "pdf";
  actor: ActingProjectUser;
}) {
  const blindTags = Array.from(new Set(input.blindTags.map(tag => tag.trim())));
  const db = await requireDb();
  const [blindRows, qrRows] = await Promise.all([
    db
      .select({ tag: blinds.tag, phase: blinds.phase })
      .from(blinds)
      .where(
        and(
          eq(blinds.projectId, input.projectId),
          inArray(blinds.tag, blindTags)
        )
      ),
    db
      .select({ blindTag: blindQrTokens.blindTag })
      .from(blindQrTokens)
      .where(
        and(
          eq(blindQrTokens.projectId, input.projectId),
          inArray(blindQrTokens.blindTag, blindTags),
          eq(blindQrTokens.status, "active")
        )
      ),
  ]);

  const foundTags = new Set(blindRows.map(row => row.tag));
  const unknownTags = blindTags.filter(tag => !foundTags.has(tag));
  if (unknownTags.length) {
    throw new Error(`Blind tags are not part of this project: ${unknownTags.join(", ")}.`);
  }

  const qrTags = new Set(qrRows.map(row => row.blindTag));
  const missingQrTags = blindTags.filter(tag => !qrTags.has(tag));
  if (missingQrTags.length) {
    throw new Error(
      `Active QR tokens are required before printing: ${missingQrTags.join(", ")}.`
    );
  }

  const actorName =
    input.actor.name ?? input.actor.email ?? input.actor.openId;
  await db.insert(blindWorkflowLogs).values(
    blindRows.map(row => ({
      projectId: input.projectId,
      blindTag: row.tag,
      phase: row.phase,
      action: "Secure Tag Print Prepared",
      message: `${input.output === "pdf" ? "PDF export" : "Print"} prepared from the controlled tag layout and active QR token.`,
      actorOpenId: input.actor.openId,
      actorName,
    }))
  );

  const recipients = await getOperationalNotificationRecipients(
    ["coordinator", "operationsForeman"],
    [input.actor.openId]
  );
  await broadcastNotification(recipients, {
    actorOpenId: input.actor.openId,
    actorName,
    type: "tag_printed",
    priority: "info",
    title: `Controlled tag package prepared · ${input.projectId}`,
    body: `${blindTags.length} blind tag${blindTags.length === 1 ? "" : "s"} prepared by ${actorName} with active secure QR links.`,
    linkUrl: `/tags/print/${encodeURIComponent(input.projectId)}`,
    projectId: input.projectId,
  }).catch(() => undefined);

  return {
    ready: true as const,
    projectId: input.projectId,
    blindTags,
    output: input.output,
    preparedAt: new Date(),
  };
}
