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

interface ImportCsvRowData {
  url: string;
  title: string | null;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  active: boolean;
  rowNumber: number;
  error: string | null;
}

interface CategoryDecisionData {
  categoryName: string;
  action: "create" | "skip";
}

function parseCsvContent(content: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let fields: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else if (ch === "\r" && i + 1 < content.length && content[i + 1] === "\n") {
        fields.push(current.trim());
        rows.push(fields);
        fields = [];
        current = "";
        i++;
      } else if (ch === "\n") {
        fields.push(current.trim());
        rows.push(fields);
        fields = [];
        current = "";
      } else {
        current += ch;
      }
    }
  }

  if (current || fields.length > 0) {
    fields.push(current.trim());
    rows.push(fields);
  }

  return rows.filter(r => r.some(f => f !== ""));
}

const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

function sanitizeCsvValue(value: string): string {
  if (value.length > 0 && FORMULA_PREFIXES.has(value[0])) {
    return "'" + value;
  }
  return value;
}

function escapeCsvField(value: string): string {
  const sanitized = sanitizeCsvValue(value);
  if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

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
  mentions: assetsTable.mentions,
  hashtags: assetsTable.hashtags,
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

router.get("/assets/export-csv", requireAuth, async (req, res): Promise<void> => {
  const assets = await db.select(assetSelect)
    .from(assetsTable)
    .leftJoin(categoriesTable, eq(assetsTable.categoryId, categoriesTable.id))
    .where(eq(assetsTable.tenantId, req.tenantId!))
    .orderBy(assetsTable.createdAt);

  const headers = ["URL", "Title", "Description", "Category", "Image URL", "ACTIVE", "Captured"];
  const csvRows = [headers.join(",")];

  for (const asset of assets) {
    const captured = asset.createdAt ? new Date(asset.createdAt).toISOString().split("T")[0] : "";
    const row = [
      escapeCsvField(asset.url || ""),
      escapeCsvField(asset.title || ""),
      escapeCsvField(asset.summaryText || ""),
      escapeCsvField(asset.categoryName || ""),
      escapeCsvField(asset.suggestedImageUrl || ""),
      asset.isActive ? "TRUE" : "FALSE",
      escapeCsvField(captured),
    ];
    csvRows.push(row.join(","));
  }

  const csvContent = csvRows.join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="assets_export.csv"');
  res.send(csvContent);
});

router.post("/assets/import-csv", requireAuth, async (req, res): Promise<void> => {
  const { csvContent } = req.body;
  if (!csvContent || typeof csvContent !== "string") {
    res.status(400).json({ error: "csvContent is required" });
    return;
  }

  const allRows = parseCsvContent(csvContent);
  if (allRows.length < 2) {
    res.status(400).json({ error: "CSV must have a header row and at least one data row" });
    return;
  }

  const headerLine = allRows[0];
  const headerMap: Record<string, number> = {};
  headerLine.forEach((h, i) => {
    headerMap[h.toLowerCase()] = i;
  });

  const urlIdx = headerMap["url"];
  if (urlIdx === undefined) {
    res.status(400).json({ error: "CSV must have a URL column" });
    return;
  }

  const titleIdx = headerMap["title"];
  const descIdx = headerMap["description"];
  const catIdx = headerMap["category"];
  const imgIdx = headerMap["image url"];
  const activeIdx = headerMap["active"];

  const tenantCategories = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.tenantId, req.tenantId!));
  const categoryNames = new Set(tenantCategories.map(c => c.name.toLowerCase()));

  const existingAssets = await db.select({ url: assetsTable.url })
    .from(assetsTable)
    .where(eq(assetsTable.tenantId, req.tenantId!));
  const existingUrls = new Set(existingAssets.map(a => a.url));

  const validRows: ImportCsvRowData[] = [];
  const errorRows: ImportCsvRowData[] = [];
  const unknownCategoriesSet = new Set<string>();
  const duplicateUrlsSet = new Set<string>();
  const seenUrlsInFile = new Set<string>();

  for (let i = 1; i < allRows.length; i++) {
    const fields = allRows[i];
    const url = fields[urlIdx] || "";
    const title = titleIdx !== undefined ? fields[titleIdx] || null : null;
    const description = descIdx !== undefined ? fields[descIdx] || null : null;
    const category = catIdx !== undefined ? fields[catIdx] || null : null;
    const imageUrl = imgIdx !== undefined ? fields[imgIdx] || null : null;
    const activeStr = activeIdx !== undefined ? fields[activeIdx] || "true" : "true";
    const active = activeStr.toLowerCase() !== "false";

    const row = { url, title, description, category, imageUrl, active, rowNumber: i + 1, error: null as string | null };

    if (!url) {
      row.error = "URL is required";
      errorRows.push(row);
      continue;
    }

    try {
      new URL(url);
    } catch {
      row.error = "Invalid URL format";
      errorRows.push(row);
      continue;
    }

    if (existingUrls.has(url)) {
      duplicateUrlsSet.add(url);
      continue;
    }

    if (seenUrlsInFile.has(url)) {
      duplicateUrlsSet.add(url);
      continue;
    }
    seenUrlsInFile.add(url);

    if (category && !categoryNames.has(category.toLowerCase())) {
      unknownCategoriesSet.add(category);
    }

    validRows.push(row);
  }

  res.json({
    validRows,
    unknownCategories: Array.from(unknownCategoriesSet),
    duplicateUrls: Array.from(duplicateUrlsSet),
    errorRows,
  });
});

router.post("/assets/confirm-import", requireAuth, async (req, res): Promise<void> => {
  const body = req.body as { rows?: unknown; categoryDecisions?: unknown };
  if (!body.rows || !Array.isArray(body.rows) || !body.categoryDecisions || !Array.isArray(body.categoryDecisions)) {
    res.status(400).json({ error: "rows and categoryDecisions are required" });
    return;
  }

  const rows = body.rows as ImportCsvRowData[];
  const categoryDecisions = body.categoryDecisions as CategoryDecisionData[];

  if (rows.length > 5000) {
    res.status(400).json({ error: "Too many rows (max 5000)" });
    return;
  }

  for (const d of categoryDecisions) {
    if (!d.categoryName || typeof d.categoryName !== "string" || !["create", "skip"].includes(d.action)) {
      res.status(400).json({ error: "Invalid category decision" });
      return;
    }
  }

  const tenantCategories = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.tenantId, req.tenantId!));
  const categoryMap = new Map<string, number>();
  for (const cat of tenantCategories) {
    categoryMap.set(cat.name.toLowerCase(), cat.id);
  }

  const decisionsMap = new Map<string, string>();
  for (const d of categoryDecisions) {
    decisionsMap.set(d.categoryName.toLowerCase(), d.action);
  }

  for (const d of categoryDecisions) {
    if (d.action === "create" && !categoryMap.has(d.categoryName.toLowerCase())) {
      const [newCat] = await db.insert(categoriesTable).values({
        tenantId: req.tenantId!,
        name: d.categoryName,
      }).returning();
      categoryMap.set(d.categoryName.toLowerCase(), newCat.id);
    }
  }

  const existingAssets = await db.select({ url: assetsTable.url })
    .from(assetsTable)
    .where(eq(assetsTable.tenantId, req.tenantId!));
  const existingUrls = new Set(existingAssets.map(a => a.url));

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.url || typeof row.url !== "string") {
      failed++;
      errors.push(`Row ${row.rowNumber || "?"}: URL is required`);
      continue;
    }

    try {
      new URL(row.url);
    } catch {
      failed++;
      errors.push(`Row ${row.rowNumber || "?"}: Invalid URL format`);
      continue;
    }

    if (existingUrls.has(row.url)) {
      skipped++;
      continue;
    }

    let categoryId: number | null = null;
    if (row.category) {
      const catKey = row.category.toLowerCase();
      if (categoryMap.has(catKey)) {
        categoryId = categoryMap.get(catKey)!;
      } else {
        const decision = decisionsMap.get(catKey);
        if (decision !== "create") {
          categoryId = null;
        }
      }
    }

    try {
      const [asset] = await db.insert(assetsTable).values({
        tenantId: req.tenantId!,
        url: row.url,
        title: row.title || null,
        summaryText: row.description || null,
        suggestedImageUrl: row.imageUrl || null,
        categoryId,
        isActive: row.active !== false,
      }).returning();

      existingUrls.add(row.url);
      created++;

      extractContent(asset.id).catch(() => {});
    } catch (e: unknown) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Row ${row.rowNumber || "?"}: ${msg}`);
    }
  }

  res.json({ created, skipped, failed, errors });
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
