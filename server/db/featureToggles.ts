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
    throw new Error(
      "Feature toggle reference row is missing. Run pnpm db:migrate before serving requests.",
    );
  }
  return rows[0];
}

export async function updateFeatureToggles(
  data: Record<string, number | string | null | undefined>,
  actorOpenId?: string,
) {
  const db = await requireDb();
  const existing = await db
    .select({ id: featureToggles.id })
    .from(featureToggles)
    .where(eq(featureToggles.id, 1))
    .limit(1);
  if (!existing[0]) {
    await db.insert(featureToggles).values({ id: 1 });
  }
  await db
    .update(featureToggles)
    .set({ ...data, updatedByOpenId: actorOpenId })
    .where(eq(featureToggles.id, 1));
  return getFeatureToggles();
}
