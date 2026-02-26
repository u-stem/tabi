import { z } from "zod";

export const SOUVENIR_NAME_MAX_LENGTH = 200;
export const SOUVENIR_RECIPIENT_MAX_LENGTH = 100;
export const SOUVENIR_URL_MAX_LENGTH = 2000;
export const SOUVENIR_ADDRESS_MAX_LENGTH = 500;

export const createSouvenirSchema = z.object({
  name: z.string().min(1).max(SOUVENIR_NAME_MAX_LENGTH),
  recipient: z.string().max(SOUVENIR_RECIPIENT_MAX_LENGTH).optional(),
  url: z.string().max(SOUVENIR_URL_MAX_LENGTH).optional(),
  address: z.string().max(SOUVENIR_ADDRESS_MAX_LENGTH).optional(),
  memo: z.string().optional(),
});

export const updateSouvenirSchema = z
  .object({
    name: z.string().min(1).max(SOUVENIR_NAME_MAX_LENGTH),
    recipient: z.string().max(SOUVENIR_RECIPIENT_MAX_LENGTH).nullable(),
    url: z.string().max(SOUVENIR_URL_MAX_LENGTH).nullable(),
    address: z.string().max(SOUVENIR_ADDRESS_MAX_LENGTH).nullable(),
    memo: z.string().nullable(),
    isPurchased: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateSouvenirInput = z.infer<typeof createSouvenirSchema>;
export type UpdateSouvenirInput = z.infer<typeof updateSouvenirSchema>;
