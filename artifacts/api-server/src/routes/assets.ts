import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, assetsTable, categoriesTable } from "@workspace/db";
import {
  ListAssetsQueryParams,
  CreateAssetBody,
  GetAssetParams,
  UpdateAssetParams,
  UpdateAssetBody,
  DeleteAssetParams,
  ExtractAssetContentParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { extractContent } from "../lib/contentExtractor";

const router: IRouter = Router();

const assetSelect = {
  id: assetsTable.id,
  tenantId: assetsTable.tenantId,
  url: assetsTable.url,
  title: assetsTable.title,
  categoryId: assetsTable.categoryId,
  categoryName: categoriesTable.name,
  isActive: assetsTable.isActive,
  summaryText: assetsTable.summaryText,
  suggestedImageUrl: assetsTable.suggestedImageUrl,
  extractionStatus: assetsTable.extractionStatus,
  createdAt: assetsTable.createdAt,
  updatedAt: assetsTable.updatedAt,
};

router.get("/assets", requireAuth, async (req, res): Promise<void> => {
  const query = ListAssetsQueryParams.safeParse(req.query);

  const conditions = [eq(assetsTable.tenantId, req.tenantId!)];

  if (query.success && query.data.categoryId) {
    conditions.push(eq(assetsTable.categoryId, query.data.categoryId));
  }
  if (query.success && query.data.isActive !== undefined) {
    conditions.push(eq(assetsTable.isActive, query.data.isActive));
  }
  if (query.success && query.data.search) {
    conditions.push(
      sql`(${assetsTable.title} ILIKE ${`%${query.data.search}%`} OR ${assetsTable.url} ILIKE ${`%${query.data.search}%`})`
    );
  }

  const assets = await db.select(assetSelect)
    .from(assetsTable)
    .leftJoin(categoriesTable, eq(assetsTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(assetsTable.createdAt);

  res.json(assets);
});

router.post("/assets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [asset] = await db.insert(assetsTable).values({
    tenantId: req.tenantId!,
    url: parsed.data.url,
    title: parsed.data.title || null,
    categoryId: parsed.data.categoryId || null,
  }).returning();

  extractContent(asset.id).catch(() => {});

  const result = await db.select(assetSelect)
    .from(assetsTable)
    .leftJoin(categoriesTable, eq(assetsTable.categoryId, categoriesTable.id))
    .where(eq(assetsTable.id, asset.id));

  res.status(201).json(result[0]);
});

router.get("/assets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await db.select(assetSelect)
    .from(assetsTable)
    .leftJoin(categoriesTable, eq(assetsTable.categoryId, categoriesTable.id))
    .where(and(eq(assetsTable.id, params.data.id), eq(assetsTable.tenantId, req.tenantId!)));

  if (result.length === 0) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  res.json(result[0]);
});

router.patch("/assets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [asset] = await db.update(assetsTable)
    .set(parsed.data)
    .where(and(eq(assetsTable.id, params.data.id), eq(assetsTable.tenantId, req.tenantId!)))
    .returning();

  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  const result = await db.select(assetSelect)
    .from(assetsTable)
    .leftJoin(categoriesTable, eq(assetsTable.categoryId, categoriesTable.id))
    .where(eq(assetsTable.id, asset.id));

  res.json(result[0]);
});

router.delete("/assets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(assetsTable)
    .where(and(eq(assetsTable.id, params.data.id), eq(assetsTable.tenantId, req.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/assets/:id/extract", requireAuth, async (req, res): Promise<void> => {
  const params = ExtractAssetContentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [asset] = await db.select().from(assetsTable)
    .where(and(eq(assetsTable.id, params.data.id), eq(assetsTable.tenantId, req.tenantId!)));

  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  await db.update(assetsTable).set({ extractionStatus: "processing" }).where(eq(assetsTable.id, asset.id));

  try {
    await extractContent(asset.id);
  } catch {
  }

  const result = await db.select(assetSelect)
    .from(assetsTable)
    .leftJoin(categoriesTable, eq(assetsTable.categoryId, categoriesTable.id))
    .where(eq(assetsTable.id, asset.id));

  res.json(result[0]);
});

export default router;
