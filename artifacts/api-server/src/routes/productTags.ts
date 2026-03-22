import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, productTagsTable, assetProductTagsTable, brandAssetProductTagsTable, assetsTable, brandAssetsTable } from "@workspace/db";
import {
  CreateProductTagBody,
  UpdateProductTagParams,
  UpdateProductTagBody,
  DeleteProductTagParams,
  ListProductTagAssetsParams,
  SetProductTagAssetsParams,
  SetProductTagAssetsBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { validateMarketOwnership } from "../lib/validateMarket";

const router: IRouter = Router();

router.get("/product-tags", requireAuth, async (req, res): Promise<void> => {
  const conditions = [eq(productTagsTable.tenantId, req.tenantId!)];

  if (req.query.market_id) {
    const marketId = parseInt(req.query.market_id as string);
    if (!isNaN(marketId)) {
      conditions.push(eq(productTagsTable.marketId, marketId));
    }
  }

  const tags = await db.select().from(productTagsTable)
    .where(and(...conditions))
    .orderBy(productTagsTable.name);
  res.json(tags);
});

router.post("/product-tags", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductTagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const marketId = parsed.data.marketId ?? null;
  if (marketId && !(await validateMarketOwnership(marketId, req.tenantId!))) {
    res.status(400).json({ error: "Invalid market" });
    return;
  }

  const [tag] = await db.insert(productTagsTable).values({
    tenantId: req.tenantId!,
    marketId,
    name: parsed.data.name,
    description: parsed.data.description || null,
  }).returning();

  res.status(201).json(tag);
});

router.patch("/product-tags/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProductTagParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductTagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [tag] = await db.update(productTagsTable)
    .set(parsed.data)
    .where(and(eq(productTagsTable.id, params.data.id), eq(productTagsTable.tenantId, req.tenantId!)))
    .returning();

  if (!tag) {
    res.status(404).json({ error: "Product tag not found" });
    return;
  }

  res.json(tag);
});

router.delete("/product-tags/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProductTagParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(productTagsTable)
    .where(and(eq(productTagsTable.id, params.data.id), eq(productTagsTable.tenantId, req.tenantId!)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Product tag not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/product-tags/:id/assets", requireAuth, async (req, res): Promise<void> => {
  const params = ListProductTagAssetsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [tag] = await db.select().from(productTagsTable)
    .where(and(eq(productTagsTable.id, params.data.id), eq(productTagsTable.tenantId, req.tenantId!)));

  if (!tag) {
    res.status(404).json({ error: "Product tag not found" });
    return;
  }

  const assetLinks = await db.select({ assetId: assetProductTagsTable.assetId })
    .from(assetProductTagsTable)
    .where(eq(assetProductTagsTable.productTagId, params.data.id));

  const brandAssetLinks = await db.select({ brandAssetId: brandAssetProductTagsTable.brandAssetId })
    .from(brandAssetProductTagsTable)
    .where(eq(brandAssetProductTagsTable.productTagId, params.data.id));

  res.json({
    assetIds: assetLinks.map(l => l.assetId),
    brandAssetIds: brandAssetLinks.map(l => l.brandAssetId),
  });
});

router.put("/product-tags/:id/assets", requireAuth, async (req, res): Promise<void> => {
  const params = SetProductTagAssetsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SetProductTagAssetsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [tag] = await db.select().from(productTagsTable)
    .where(and(eq(productTagsTable.id, params.data.id), eq(productTagsTable.tenantId, req.tenantId!)));

  if (!tag) {
    res.status(404).json({ error: "Product tag not found" });
    return;
  }

  const requestedAssetIds = [...new Set(parsed.data.assetIds || [])];
  const requestedBrandAssetIds = [...new Set(parsed.data.brandAssetIds || [])];

  if (requestedAssetIds.length > 0) {
    const ownedAssets = await db.select({ id: assetsTable.id }).from(assetsTable)
      .where(and(eq(assetsTable.tenantId, req.tenantId!), inArray(assetsTable.id, requestedAssetIds)));
    if (ownedAssets.length !== requestedAssetIds.length) {
      res.status(400).json({ error: "One or more asset IDs are invalid or do not belong to your tenant" });
      return;
    }
  }

  if (requestedBrandAssetIds.length > 0) {
    const ownedBrandAssets = await db.select({ id: brandAssetsTable.id }).from(brandAssetsTable)
      .where(and(eq(brandAssetsTable.tenantId, req.tenantId!), inArray(brandAssetsTable.id, requestedBrandAssetIds)));
    if (ownedBrandAssets.length !== requestedBrandAssetIds.length) {
      res.status(400).json({ error: "One or more brand asset IDs are invalid or do not belong to your tenant" });
      return;
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(assetProductTagsTable)
      .where(eq(assetProductTagsTable.productTagId, params.data.id));

    await tx.delete(brandAssetProductTagsTable)
      .where(eq(brandAssetProductTagsTable.productTagId, params.data.id));

    if (requestedAssetIds.length > 0) {
      await tx.insert(assetProductTagsTable).values(
        requestedAssetIds.map(assetId => ({
          assetId,
          productTagId: params.data.id,
        }))
      );
    }

    if (requestedBrandAssetIds.length > 0) {
      await tx.insert(brandAssetProductTagsTable).values(
        requestedBrandAssetIds.map(brandAssetId => ({
          brandAssetId,
          productTagId: params.data.id,
        }))
      );
    }
  });

  res.json({ success: true });
});

export default router;
