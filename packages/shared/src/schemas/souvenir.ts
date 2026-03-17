import { z } from "zod";
import { MAX_ADDRESSES_PER_SOUVENIR, MAX_URLS_PER_SOUVENIR } from "../limits";
import { httpUrlSchema } from "./url";

export const SOUVENIR_NAME_MAX_LENGTH = 200;
export const SOUVENIR_RECIPIENT_MAX_LENGTH = 100;
export const SOUVENIR_URL_MAX_LENGTH = 2000;
export const SOUVENIR_ADDRESS_MAX_LENGTH = 500;

export const SOUVENIR_PRIORITY_VALUES = ["high", "medium"] as const;
export type SouvenirPriority = (typeof SOUVENIR_PRIORITY_VALUES)[number];
export const SOUVENIR_PRIORITY_LABELS: Record<SouvenirPriority, string> = {
  high: "絶対",
  medium: "できれば",
};

export const SOUVENIR_SHARE_STYLE_VALUES = ["recommend", "errand"] as const;
export type SouvenirShareStyle = (typeof SOUVENIR_SHARE_STYLE_VALUES)[number];
export const SOUVENIR_SHARE_STYLE_LABELS: Record<SouvenirShareStyle, string> = {
  recommend: "おすすめ",
  errand: "おつかい",
};

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
  recipient: z.string().max(SOUVENIR_RECIPIENT_MAX_LENGTH).nullable().optional(),
  urls: souvenirUrlsSchema,
  addresses: souvenirAddressesSchema,
  memo: z.string().nullable().optional(),
  priority: z.enum(SOUVENIR_PRIORITY_VALUES).nullable().optional(),
  isShared: z.boolean().optional(),
  shareStyle: z.enum(SOUVENIR_SHARE_STYLE_VALUES).nullable().optional(),
});

export const updateSouvenirSchema = z
  .object({
    name: z.string().min(1).max(SOUVENIR_NAME_MAX_LENGTH),
    recipient: z.string().max(SOUVENIR_RECIPIENT_MAX_LENGTH).nullable(),
    urls: souvenirUrlsSchema,
    addresses: souvenirAddressesSchema,
    memo: z.string().nullable(),
    isPurchased: z.boolean(),
    priority: z.enum(SOUVENIR_PRIORITY_VALUES).nullable(),
    isShared: z.boolean(),
    shareStyle: z.enum(SOUVENIR_SHARE_STYLE_VALUES).nullable(),
  })
  .partial()
  .refine(
    (data) => {
      // Fields with .default([]) are always present after parse — exclude them
      const meaningful = Object.entries(data).filter(
        ([, v]) => !(Array.isArray(v) && v.length === 0),
      );
      return meaningful.length > 0;
    },
    { message: "At least one field must be provided" },
  );

export type CreateSouvenirInput = z.infer<typeof createSouvenirSchema>;
export type UpdateSouvenirInput = z.infer<typeof updateSouvenirSchema>;

export type SouvenirItem = {
  id: string;
  name: string;
  recipient: string | null;
  urls: string[];
  addresses: string[];
  memo: string | null;
  priority: SouvenirPriority | null;
  isPurchased: boolean;
  isShared: boolean;
  shareStyle: SouvenirShareStyle | null;
  userId: string;
  userName: string;
  userImage: string | null;
  createdAt: string;
  updatedAt: string;
};
