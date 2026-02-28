import crypto from "node:crypto";

const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function shareExpiresAt(): Date {
  return new Date(Date.now() + SHARE_LINK_TTL_MS);
}
