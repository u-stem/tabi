import { z } from "zod";
import { MAX_ADDRESSES_PER_SOUVENIR, MAX_URLS_PER_SOUVENIR } from "../limits";
import { httpUrlSchema } from "./url";

export const SOUVENIR_NAME_MAX_LENGTH = 200;
export const SOUVENIR_RECIPIENT_MAX_LENGTH = 100;
export const SOUVENIR_URL_MAX_LENGTH = 2000;
export const SOUVENIR_ADDRESS_MAX_LENGTH = 500;

const souvenirUrlsSchema = z
  .array(httpUrlSchema(SOUVENIR_URL_MAX_LENGTH))
  .max(MAX_URLS_PER_SOUVENIR)
  .default([]);

const souvenirAddressesSchema = z
  .array(z.string().max(SOUVENIR_ADDRESS_MAX_LENGTH))
  .max(MAX_ADDRESSES_PER_SOUVENIR)
  .default([]);

export const createSouvenirSchema = z.object({
  name: z.string().min(1).max(SOUVENIR_NAME_MAX_LENGTH),
  recipient: z.string().max(SOUVENIR_RECIPIENT_MAX_LENGTH).optional(),
  urls: souvenirUrlsSchema,
  addresses: souvenirAddressesSchema,
  memo: z.string().optional(),
});

export const updateSouvenirSchema = z
  .object({
    name: z.string().min(1).max(SOUVENIR_NAME_MAX_LENGTH),
    recipient: z.string().max(SOUVENIR_RECIPIENT_MAX_LENGTH).nullable(),
    urls: souvenirUrlsSchema,
    addresses: souvenirAddressesSchema,
    memo: z.string().nullable(),
    isPurchased: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateSouvenirInput = z.infer<typeof createSouvenirSchema>;
export type UpdateSouvenirInput = z.infer<typeof updateSouvenirSchema>;

export type SouvenirItem = {
  id: string;
  name: string;
  recipient: string | null;
  urls: string[];
  addresses: string[];
  memo: string | null;
  isPurchased: boolean;
  createdAt: string;
  updatedAt: string;
};
