import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, marketsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/markets", requireAuth, async (req, res): Promise<void> => {
  const markets = await db.select().from(marketsTable)
    .where(eq(marketsTable.tenantId, req.tenantId!))
    .orderBy(marketsTable.createdAt);
  res.json(markets);
});

router.post("/markets", requireAuth, async (req, res): Promise<void> => {
  const { name, description } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const [market] = await db.insert(marketsTable).values({
    tenantId: req.tenantId!,
    name,
    description: description || null,
    isDefault: false,
    status: "active",
  }).returning();

  res.status(201).json(market);
});

router.get("/markets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [market] = await db.select().from(marketsTable)
    .where(and(eq(marketsTable.id, id), eq(marketsTable.tenantId, req.tenantId!)));

  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  res.json(market);
});

router.patch("/markets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { name, description, status } = req.body;
  const updates: Record<string, string | null> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;

  const [market] = await db.update(marketsTable)
    .set(updates)
    .where(and(eq(marketsTable.id, id), eq(marketsTable.tenantId, req.tenantId!)))
    .returning();

  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  res.json(market);
});

router.delete("/markets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [market] = await db.select().from(marketsTable)
    .where(and(eq(marketsTable.id, id), eq(marketsTable.tenantId, req.tenantId!)));

  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  if (market.isDefault) {
    res.status(400).json({ error: "Cannot delete the default market" });
    return;
  }

  await db.delete(marketsTable).where(eq(marketsTable.id, id));
  res.sendStatus(204);
});

export default router;
