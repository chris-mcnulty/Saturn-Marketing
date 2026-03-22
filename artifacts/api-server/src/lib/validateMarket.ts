import { eq, and } from "drizzle-orm";
import { db, marketsTable } from "@workspace/db";

export async function validateMarketOwnership(marketId: number | null | undefined, tenantId: number): Promise<boolean> {
  if (!marketId) return true;

  const [market] = await db.select({ id: marketsTable.id })
    .from(marketsTable)
    .where(and(eq(marketsTable.id, marketId), eq(marketsTable.tenantId, tenantId)));

  return !!market;
}
