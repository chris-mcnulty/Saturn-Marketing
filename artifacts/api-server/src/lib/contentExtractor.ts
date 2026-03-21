import { db, assetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import * as cheerio from "cheerio";
import { logger } from "./logger";
import { getGroundingContext } from "./groundingContext";

export async function extractContent(assetId: number): Promise<void> {
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, assetId));
  if (!asset) return;

  await db.update(assetsTable).set({ extractionStatus: "processing" }).where(eq(assetsTable.id, assetId));

  try {
    const response = await fetch(asset.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketingBot/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogDescription = $('meta[property="og:description"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");
    const metaDescription = $('meta[name="description"]').attr("content");
    const pageTitle = $("title").text().trim();

    const title = asset.title || ogTitle || pageTitle || null;

    let imageUrl = ogImage || null;
    if (!imageUrl) {
      const firstImg = $("article img, main img, .content img, img").first().attr("src");
      if (firstImg) {
        try {
          imageUrl = new URL(firstImg, asset.url).href;
        } catch {
          imageUrl = firstImg;
        }
      }
    }

    const textContent = ogDescription || metaDescription || "";
    let summaryText = textContent;

    if (textContent) {
      try {
        const groundingContext = await getGroundingContext(asset.tenantId);
        const systemPromptParts = [
          "You are a social media marketing expert. Generate a concise, engaging social media post caption (1-2 sentences) based on the following web page content. Make it compelling and shareable. Do not include hashtags.",
        ];
        if (groundingContext) {
          systemPromptParts.push(groundingContext);
        }

        const completion = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 200,
          messages: [
            {
              role: "system",
              content: systemPromptParts.join("\n\n"),
            },
            {
              role: "user",
              content: `Page title: ${title || "Unknown"}\nPage description: ${textContent}\nURL: ${asset.url}`,
            },
          ],
        });
        summaryText = completion.choices[0]?.message?.content || textContent;
      } catch (e) {
        logger.warn({ err: e }, "AI summary generation failed, using page description");
        summaryText = textContent;
      }
    }

    await db.update(assetsTable).set({
      title: title,
      summaryText: summaryText || null,
      suggestedImageUrl: imageUrl,
      extractionStatus: "completed",
    }).where(eq(assetsTable.id, assetId));
  } catch (e) {
    logger.error({ err: e, assetId }, "Content extraction failed");
    await db.update(assetsTable).set({ extractionStatus: "failed" }).where(eq(assetsTable.id, assetId));
  }
}
