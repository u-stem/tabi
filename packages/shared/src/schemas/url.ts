import { z } from "zod";

/** Reusable schema for http/https URL with max length */
export function httpUrlSchema(maxLength: number) {
  return z
    .string()
    .url()
    .max(maxLength)
    .refine((v) => {
      const { protocol } = new URL(v);
      return protocol === "http:" || protocol === "https:";
    }, "Only http and https URLs are allowed");
}
