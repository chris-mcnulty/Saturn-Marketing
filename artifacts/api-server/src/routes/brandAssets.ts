import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, brandAssetsTable, brandAssetCategoriesTable } from "@workspace/db";
import {
  CreateBrandAssetBody,
  UpdateBrandAssetParams,
  UpdateBrandAssetBody,
  DeleteBrandAssetParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/brand-assets", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select({
    id: brandAssetsTable.id,
    tenantId: brandAssetsTable.tenantId,
    imageUrl: brandAssetsTable.imageUrl,
    title: brandAssetsTable.title,
    description: brandAssetsTable.description,
    tags: brandAssetsTable.tags,
    categoryId: brandAssetsTable.categoryId,
    categoryName: brandAssetCategoriesTable.name,
    createdAt: brandAssetsTable.createdAt,
  })
    .from(brandAssetsTable)
    .leftJoin(brandAssetCategoriesTable, and(eq(brandAssetsTable.categoryId, brandAssetCategoriesTable.id), eq(brandAssetCategoriesTable.tenantId, req.tenantId!)))
    .where(eq(brandAssetsTable.tenantId, req.tenantId!))
    .orderBy(brandAssetsTable.createdAt);
  res.json(rows);
});

router.post("/brand-assets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBrandAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.categoryId) {
    const [cat] = await db.select({ id: brandAssetCategoriesTable.id })
      .from(brandAssetCategoriesTable)
      .where(and(eq(brandAssetCategoriesTable.id, parsed.data.categoryId), eq(brandAssetCategoriesTable.tenantId, req.tenantId!)));
    if (!cat) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }
  }

  const [asset] = await db.insert(brandAssetsTable).values({
    tenantId: req.tenantId!,
    imageUrl: parsed.data.imageUrl,
    title: parsed.data.title || null,
    description: parsed.data.description || null,
    tags: parsed.data.tags || null,
    categoryId: parsed.data.categoryId ?? null,
  }).returning();

  if (asset.categoryId) {
    const [cat] = await db.select({ name: brandAssetCategoriesTable.name })
      .from(brandAssetCategoriesTable)
      .where(and(eq(brandAssetCategoriesTable.id, asset.categoryId), eq(brandAssetCategoriesTable.tenantId, req.tenantId!)));
    res.status(201).json({ ...asset, categoryName: cat?.name || null });
  } else {
    res.status(201).json({ ...asset, categoryName: null });
  }
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

  if (parsed.data.categoryId) {
    const [cat] = await db.select({ id: brandAssetCategoriesTable.id })
      .from(brandAssetCategoriesTable)
      .where(and(eq(brandAssetCategoriesTable.id, parsed.data.categoryId), eq(brandAssetCategoriesTable.tenantId, req.tenantId!)));
    if (!cat) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }
  }

  const [asset] = await db.update(brandAssetsTable)
    .set(parsed.data)
    .where(and(eq(brandAssetsTable.id, params.data.id), eq(brandAssetsTable.tenantId, req.tenantId!)))
    .returning();

  if (!asset) {
    res.status(404).json({ error: "Brand asset not found" });
    return;
  }

  if (asset.categoryId) {
    const [cat] = await db.select({ name: brandAssetCategoriesTable.name })
      .from(brandAssetCategoriesTable)
      .where(and(eq(brandAssetCategoriesTable.id, asset.categoryId), eq(brandAssetCategoriesTable.tenantId, req.tenantId!)));
    res.json({ ...asset, categoryName: cat?.name || null });
  } else {
    res.json({ ...asset, categoryName: null });
  }
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
