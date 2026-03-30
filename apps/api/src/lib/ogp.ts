const OG_TITLE_RE = /< *meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const OG_TITLE_RE_ALT = /< *meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i;
const TITLE_TAG_RE = /<title[^>]*>([^<]+)<\/title>/i;

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&#x2F;": "/",
};
const ENTITY_RE = /&(?:amp|lt|gt|quot|#39|#x27|#x2F);/g;

function decodeEntities(s: string): string {
  return s.replace(ENTITY_RE, (m) => HTML_ENTITIES[m] ?? m);
}

export function extractTitle(html: string): string | null {
  const ogMatch = html.match(OG_TITLE_RE) ?? html.match(OG_TITLE_RE_ALT);
  if (ogMatch) return decodeEntities(ogMatch[1].trim());

  const titleMatch = html.match(TITLE_TAG_RE);
  if (titleMatch) return decodeEntities(titleMatch[1].trim());

  return null;
}

export function titleFromUrl(url: string): string {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.hostname}${path}`;
}

const PRIVATE_IP_RE =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.|::1|fc|fd|fe80)/;

export async function fetchOgpTitle(url: string): Promise<string> {
  const parsed = new URL(url);

  if (PRIVATE_IP_RE.test(parsed.hostname)) {
    return titleFromUrl(url);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "sugara-bot/1.0",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) {
      return titleFromUrl(url);
    }

    const reader = res.body?.getReader();
    if (!reader) return titleFromUrl(url);

    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const MAX_BYTES = 16 * 1024;

    while (totalSize < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.length;
    }
    reader.cancel();

    const html = new TextDecoder().decode(
      chunks.length === 1 ? chunks[0] : concatUint8Arrays(chunks, totalSize),
    );

    return extractTitle(html) ?? titleFromUrl(url);
  } catch {
    return titleFromUrl(url);
  } finally {
    clearTimeout(timeout);
  }
}

function concatUint8Arrays(arrays: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
