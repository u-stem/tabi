import crypto from "node:crypto";
import { SEVEN_DAYS_MS } from "./constants";

export function generateShareToken(): string {
  // 32 bytes → 43 base64url chars. 64 bit was too thin for public /api/shared/:token brute force.
  return crypto.randomBytes(32).toString("base64url");
}

export function shareExpiresAt(): Date {
  return new Date(Date.now() + SEVEN_DAYS_MS);
}
