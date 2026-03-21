import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, brandAssetsTable } from "@workspace/db";
import {
  CreateBrandAssetBody,
  UpdateBrandAssetParams,
  UpdateBrandAssetBody,
  DeleteBrandAssetParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/brand-assets", requireAuth, async (req, res): Promise<void> => {
  const assets = await db.select().from(brandAssetsTable)
    .where(eq(brandAssetsTable.tenantId, req.tenantId!))
    .orderBy(brandAssetsTable.createdAt);
  res.json(assets);
});

router.post("/brand-assets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBrandAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [asset] = await db.insert(brandAssetsTable).values({
    tenantId: req.tenantId!,
    imageUrl: parsed.data.imageUrl,
    title: parsed.data.title || null,
    description: parsed.data.description || null,
    tags: parsed.data.tags || null,
  }).returning();

  res.status(201).json(asset);
});

router.patch("/brand-assets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateBrandAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBrandAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [asset] = await db.update(brandAssetsTable)
    .set(parsed.data)
    .where(and(eq(brandAssetsTable.id, params.data.id), eq(brandAssetsTable.tenantId, req.tenantId!)))
    .returning();

  if (!asset) {
    res.status(404).json({ error: "Brand asset not found" });
    return;
  }

  res.json(asset);
});

router.delete("/brand-assets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteBrandAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(brandAssetsTable)
    .where(and(eq(brandAssetsTable.id, params.data.id), eq(brandAssetsTable.tenantId, req.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Brand asset not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
