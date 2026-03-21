import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, brandAssetCategoriesTable } from "@workspace/db";
import {
  CreateBrandAssetCategoryBody,
  UpdateBrandAssetCategoryParams,
  UpdateBrandAssetCategoryBody,
  DeleteBrandAssetCategoryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/brand-asset-categories", requireAuth, async (req, res): Promise<void> => {
  const categories = await db.select().from(brandAssetCategoriesTable)
    .where(eq(brandAssetCategoriesTable.tenantId, req.tenantId!))
    .orderBy(brandAssetCategoriesTable.name);
  res.json(categories);
});

router.post("/brand-asset-categories", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBrandAssetCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [category] = await db.insert(brandAssetCategoriesTable).values({
    tenantId: req.tenantId!,
    name: parsed.data.name,
  }).returning();

  res.status(201).json(category);
});

router.patch("/brand-asset-categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateBrandAssetCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBrandAssetCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [category] = await db.update(brandAssetCategoriesTable)
    .set(parsed.data)
    .where(and(eq(brandAssetCategoriesTable.id, params.data.id), eq(brandAssetCategoriesTable.tenantId, req.tenantId!)))
    .returning();

  if (!category) {
    res.status(404).json({ error: "Brand asset category not found" });
    return;
  }

  res.json(category);
});

router.delete("/brand-asset-categories/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteBrandAssetCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(brandAssetCategoriesTable)
    .where(and(eq(brandAssetCategoriesTable.id, params.data.id), eq(brandAssetCategoriesTable.tenantId, req.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Brand asset category not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
