import { z } from "zod";

export const ogpRequestSchema = z.object({
  url: z
    .string()
    .url()
    .refine((v) => new URL(v).protocol === "https:", "Only HTTPS URLs are allowed"),
});

export const ogpResponseSchema = z.object({
  title: z.string(),
});

export type OgpRequest = z.infer<typeof ogpRequestSchema>;
export type OgpResponse = z.infer<typeof ogpResponseSchema>;
