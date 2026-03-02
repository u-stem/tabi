import crypto from "node:crypto";
import { SEVEN_DAYS_MS } from "./constants";

export function generateShareToken(): string {
  return crypto.randomBytes(8).toString("base64url");
}

export function shareExpiresAt(): Date {
  return new Date(Date.now() + SEVEN_DAYS_MS);
}
