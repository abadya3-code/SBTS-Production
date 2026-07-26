/**
 * server/db/featureToggles.ts
 * ───────────────────────────
 * Feature Toggles CRUD — التحكم بالخصائص من الإعدادات.
 */
import { eq } from "drizzle-orm";
import { requireDb } from "./core";
import { featureToggles } from "../../drizzle/schema";

export async function getFeatureToggles() {
  const db = await requireDb();
  const rows = await db.select().from(featureToggles).where(eq(featureToggles.id, 1)).limit(1);
  if (rows.length === 0) {
    await db.insert(featureToggles).values({});
    const newRows = await db.select().from(featureToggles).where(eq(featureToggles.id, 1)).limit(1);
    return newRows[0]!;
  }
  return rows[0]!;
}

export async function updateFeatureToggles(
  data: Record<string, number | string | null | undefined>,
  actorOpenId?: string,
) {
  const db = await requireDb();
  await db.update(featureToggles).set({ ...data, updatedByOpenId: actorOpenId }).where(eq(featureToggles.id, 1));
  return getFeatureToggles();
}
