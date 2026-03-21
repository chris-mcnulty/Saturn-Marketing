import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, groundingDocumentsTable } from "@workspace/db";
import {
  CreateGroundingDocBody,
  GetGroundingDocParams,
  UpdateGroundingDocParams,
  UpdateGroundingDocBody,
  DeleteGroundingDocParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/grounding-docs", requireAuth, async (req, res): Promise<void> => {
  const docs = await db.select()
    .from(groundingDocumentsTable)
    .where(eq(groundingDocumentsTable.tenantId, req.tenantId!))
    .orderBy(groundingDocumentsTable.createdAt);

  res.json(docs);
});

router.get("/grounding-docs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetGroundingDocParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db.select()
    .from(groundingDocumentsTable)
    .where(and(
      eq(groundingDocumentsTable.id, params.data.id),
      eq(groundingDocumentsTable.tenantId, req.tenantId!)
    ));

  if (!doc) {
    res.status(404).json({ error: "Grounding document not found" });
    return;
  }

  res.json(doc);
});

router.post("/grounding-docs", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateGroundingDocBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, description, category, content, fileType, originalFileName } = parsed.data;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  const [doc] = await db.insert(groundingDocumentsTable).values({
    tenantId: req.tenantId!,
    name,
    description: description || null,
    category,
    fileType: fileType || null,
    originalFileName: originalFileName || null,
    extractedText: content,
    wordCount,
    isActive: true,
  }).returning();

  res.status(201).json(doc);
});

router.patch("/grounding-docs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateGroundingDocParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGroundingDocBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [doc] = await db.update(groundingDocumentsTable)
    .set(parsed.data)
    .where(and(
      eq(groundingDocumentsTable.id, params.data.id),
      eq(groundingDocumentsTable.tenantId, req.tenantId!)
    ))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Grounding document not found" });
    return;
  }

  res.json(doc);
});

router.delete("/grounding-docs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteGroundingDocParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(groundingDocumentsTable)
    .where(and(
      eq(groundingDocumentsTable.id, params.data.id),
      eq(groundingDocumentsTable.tenantId, req.tenantId!)
    ))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Grounding document not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
