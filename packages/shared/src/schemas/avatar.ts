import { z } from "zod";

export const DICEBEAR_STYLES = [
  "glass",
  "identicon",
  "rings",
  "shapes",
  "thumbs",
  "lorelei",
  "lorelei-neutral",
  "notionists",
  "notionists-neutral",
  "open-peeps",
  "pixel-art",
  "pixel-art-neutral",
] as const;

export type DiceBearStyle = (typeof DICEBEAR_STYLES)[number];

export const updateAvatarSchema = z.object({
  style: z.enum(DICEBEAR_STYLES),
  seed: z.string().min(1).max(36),
});

export function buildDiceBearUrl(style: DiceBearStyle, seed: string): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

const DICEBEAR_URL_RE = /^https:\/\/api\.dicebear\.com\/9\.x\/[\w-]+\/svg\?seed=[\w%.+-]+$/;

export function isValidAvatarUrl(url: string): boolean {
  return DICEBEAR_URL_RE.test(url);
}
