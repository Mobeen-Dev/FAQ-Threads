const prisma = require("./prismaClient");

function isHttpUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function decodeHtmlEntities(input) {
  if (!input) return "";
  return String(input)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanupText(input) {
  return decodeHtmlEntities(String(input || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaContent(html, matcher) {
  const metaTagRegex = /<meta\s+[^>]*>/gi;
  const tags = html.match(metaTagRegex) || [];
  for (const tag of tags) {
    const nameMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (!nameMatch || !contentMatch) continue;
    if (matcher(nameMatch[1].toLowerCase())) {
      const content = cleanupText(contentMatch[1]);
      if (content) return content;
    }
  }
  return null;
}

function extractTitleFromHtml(html) {
  const ogTitle = extractMetaContent(html, (name) => name === "og:title");
  if (ogTitle) return ogTitle;

  const twitterTitle = extractMetaContent(html, (name) => name === "twitter:title");
  if (twitterTitle) return twitterTitle;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    const title = cleanupText(titleMatch[1]);
    if (title) return title;
  }
  return null;
}

function extractImageFromHtml(html, baseUrl) {
  const ogImage = extractMetaContent(html, (name) => name === "og:image");
  if (ogImage) return resolveUrl(ogImage, baseUrl);

  const twitterImage = extractMetaContent(html, (name) => name === "twitter:image");
  if (twitterImage) return resolveUrl(twitterImage, baseUrl);

  const imgMatch = html.match(/<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (imgMatch?.[1]) {
    return resolveUrl(imgMatch[1], baseUrl);
  }
  return null;
}

function resolveUrl(value, baseUrl) {
  if (!value) return null;
  try {
    const resolved = new URL(value, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

function extractHandleFromUrl(productUrl) {
  if (!isHttpUrl(productUrl)) return null;
  try {
    const parsed = new URL(String(productUrl));
    const segments = parsed.pathname.split("/").filter(Boolean);
    const productsIndex = segments.findIndex((segment) => segment.toLowerCase() === "products");
    if (productsIndex < 0) return null;
    const rawHandle = segments[productsIndex + 1] || "";
    const handle = cleanupText(rawHandle).replace(/\/+$/, "");
    return handle || null;
  } catch {
    return null;
  }
}

function buildFrontendUrl({ productUrl, productHandle, shopDomain }) {
  const handle = cleanupText(productHandle || extractHandleFromUrl(productUrl) || "");
  if (handle) {
    const origin = isHttpUrl(productUrl)
      ? new URL(String(productUrl)).origin
      : `https://${String(shopDomain || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "")}`;
    return `${origin}/products/${encodeURIComponent(handle)}`;
  }
  if (isHttpUrl(productUrl)) return String(productUrl);
  return null;
}

async function scrapeProductMetadata(productUrl) {
  if (!isHttpUrl(productUrl)) return { title: null, firstImageUrl: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(String(productUrl), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "FAQ-Manager-Product-Metadata/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      console.warn("Product metadata scrape failed:", response.status, response.statusText, productUrl);
      return { title: null, firstImageUrl: null };
    }

    const html = await response.text();
    const title = extractTitleFromHtml(html);
    const firstImageUrl = extractImageFromHtml(html, response.url || String(productUrl));
    return { title, firstImageUrl };
  } catch (error) {
    console.warn("Product metadata scrape error:", error instanceof Error ? error.message : error);
    return { title: null, firstImageUrl: null };
  } finally {
    clearTimeout(timeout);
  }
}

function buildProductTitle({ payloadTitle, scrapedTitle, productHandle, productId }) {
  const value = cleanupText(payloadTitle || scrapedTitle || productHandle || productId || "");
  return value || "Untitled product";
}

async function upsertProductFromQuestionPayload({ shop, payload }) {
  const productId = payload.productId ? String(payload.productId) : null;
  const productHandle = cleanupText(
    payload.productHandle ? String(payload.productHandle) : (extractHandleFromUrl(payload.productUrl ? String(payload.productUrl) : null) || "")
  ) || null;
  const payloadTitle = payload.productTitle ? String(payload.productTitle) : null;
  const sourceUrl = payload.productUrl ? String(payload.productUrl) : null;

  if (!productId && !productHandle && !payloadTitle && !sourceUrl) {
    return null;
  }

  const frontendUrl = buildFrontendUrl({ productUrl: sourceUrl, productHandle, shopDomain: shop.domain });
  if (!frontendUrl) {
    console.warn("Skipping product upsert: could not derive frontendUrl");
    return null;
  }

  const scraped = await scrapeProductMetadata(sourceUrl);
  const firstImageUrl = isHttpUrl(scraped.firstImageUrl) ? scraped.firstImageUrl : null;
  const title = buildProductTitle({
    payloadTitle,
    scrapedTitle: scraped.title,
    productHandle,
    productId,
  });

  const existing = await prisma.product.findFirst({
    where: {
      shopId: shop.id,
      OR: [
        { frontendUrl },
        ...(productId ? [{ externalProductId: productId }] : []),
        ...(productHandle ? [{ handle: productHandle }] : []),
      ],
    },
  });

  if (existing) {
    const resolvedTitle = buildProductTitle({
      payloadTitle,
      scrapedTitle: scraped.title,
      productHandle: productHandle || existing.handle,
      productId: productId || existing.externalProductId,
    });

    const updateData = {
      frontendUrl,
      title: resolvedTitle,
    };
    if (firstImageUrl) updateData.firstImageUrl = firstImageUrl;
    if (productId) updateData.externalProductId = productId;
    if (productHandle) updateData.handle = productHandle;
    if (sourceUrl && isHttpUrl(sourceUrl)) updateData.sourceUrl = sourceUrl;

    return prisma.product.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  return prisma.product.create({
    data: {
      title,
      firstImageUrl,
      frontendUrl,
      externalProductId: productId,
      handle: productHandle,
      sourceUrl: sourceUrl && isHttpUrl(sourceUrl) ? sourceUrl : null,
      shopId: shop.id,
    },
  });
}

module.exports = {
  upsertProductFromQuestionPayload,
  extractHandleFromUrl,
  buildFrontendUrl,
};
