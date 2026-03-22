import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, marketsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const VALID_STATUSES = ["active", "archived"] as const;

router.get("/markets", requireAuth, async (req, res): Promise<void> => {
  try {
    const markets = await db.select().from(marketsTable)
      .where(eq(marketsTable.tenantId, req.tenantId!))
      .orderBy(desc(marketsTable.isDefault), marketsTable.name);
    res.json(markets);
  } catch (error) {
    console.error("List markets error:", error);
    res.status(500).json({ error: "Failed to list markets" });
  }
});

router.get("/markets/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid market ID" }); return; }

    const [market] = await db.select().from(marketsTable)
      .where(and(eq(marketsTable.id, id), eq(marketsTable.tenantId, req.tenantId!)));
    if (!market) { res.status(404).json({ error: "Market not found" }); return; }
    res.json(market);
  } catch (error) {
    console.error("Get market error:", error);
    res.status(500).json({ error: "Failed to get market" });
  }
});

router.post("/markets", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const { name, description, isDefault } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Name is required" }); return;
    }

    if (isDefault) {
      await db.update(marketsTable)
        .set({ isDefault: false })
        .where(eq(marketsTable.tenantId, req.tenantId!));
    }

    const [market] = await db.insert(marketsTable).values({
      tenantId: req.tenantId!,
      name: name.trim(),
      description: description ? String(description).trim() : null,
      isDefault: isDefault || false,
    }).returning();
    res.status(201).json(market);
  } catch (error) {
    console.error("Create market error:", error);
    res.status(500).json({ error: "Failed to create market" });
  }
});

router.patch("/markets/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid market ID" }); return; }

    const [existing] = await db.select().from(marketsTable)
      .where(and(eq(marketsTable.id, id), eq(marketsTable.tenantId, req.tenantId!)));
    if (!existing) { res.status(404).json({ error: "Market not found" }); return; }

    const { name, description, isDefault, status } = req.body;
    const updates: Record<string, any> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "Name cannot be empty" }); return;
      }
      updates.name = name.trim();
    }
    if (description !== undefined) updates.description = description ? String(description).trim() : null;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        res.status(400).json({ error: "Status must be 'active' or 'archived'" }); return;
      }
      if (status === "archived" && existing.isDefault) {
        res.status(400).json({ error: "Cannot archive the default market. Set another market as default first." }); return;
      }
      updates.status = status;
    }

    if (isDefault === true) {
      await db.update(marketsTable)
        .set({ isDefault: false })
        .where(eq(marketsTable.tenantId, req.tenantId!));
      updates.isDefault = true;
    } else if (isDefault === false && existing.isDefault) {
      res.status(400).json({ error: "Cannot unset the default market. Set another market as default first." }); return;
    }

    if (Object.keys(updates).length === 0) {
      res.json(existing); return;
    }

    const [updated] = await db.update(marketsTable).set(updates).where(eq(marketsTable.id, id)).returning();
    res.json(updated);
  } catch (error) {
    console.error("Update market error:", error);
    res.status(500).json({ error: "Failed to update market" });
  }
});

router.delete("/markets/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid market ID" }); return; }

    const [existing] = await db.select().from(marketsTable)
      .where(and(eq(marketsTable.id, id), eq(marketsTable.tenantId, req.tenantId!)));
    if (!existing) { res.status(404).json({ error: "Market not found" }); return; }
    if (existing.isDefault) { res.status(400).json({ error: "Cannot delete the default market. Set another market as default first." }); return; }

    await db.update(marketsTable).set({ status: "archived" }).where(eq(marketsTable.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Delete market error:", error);
    res.status(500).json({ error: "Failed to delete market" });
  }
});

export default router;
