import { z } from "zod";
import {
  BOOKMARK_LIST_NAME_MAX_LENGTH,
  BOOKMARK_MEMO_MAX_LENGTH,
  BOOKMARK_NAME_MAX_LENGTH,
  BOOKMARK_URL_MAX_LENGTH,
} from "../limits";

export const bookmarkListVisibilitySchema = z.enum(["private", "friends_only", "public"]);
export type BookmarkListVisibility = z.infer<typeof bookmarkListVisibilitySchema>;

export const createBookmarkListSchema = z.object({
  name: z.string().min(1).max(BOOKMARK_LIST_NAME_MAX_LENGTH),
  visibility: bookmarkListVisibilitySchema.default("private"),
});

export const updateBookmarkListSchema = z.object({
  name: z.string().min(1).max(BOOKMARK_LIST_NAME_MAX_LENGTH).optional(),
  visibility: bookmarkListVisibilitySchema.optional(),
});

export const reorderBookmarkListsSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

export const createBookmarkSchema = z.object({
  name: z.string().min(1).max(BOOKMARK_NAME_MAX_LENGTH),
  memo: z.string().max(BOOKMARK_MEMO_MAX_LENGTH).nullish(),
  url: z
    .string()
    .max(BOOKMARK_URL_MAX_LENGTH)
    .url()
    .refine((v) => /^https?:\/\//.test(v), { message: "HTTP(S) URL required" })
    .nullish(),
});

export const updateBookmarkSchema = z.object({
  name: z.string().min(1).max(BOOKMARK_NAME_MAX_LENGTH).optional(),
  memo: z.string().max(BOOKMARK_MEMO_MAX_LENGTH).nullish(),
  url: z
    .string()
    .max(BOOKMARK_URL_MAX_LENGTH)
    .url()
    .refine((v) => /^https?:\/\//.test(v), { message: "HTTP(S) URL required" })
    .nullish(),
});

export const reorderBookmarksSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

export const batchBookmarkIdsSchema = z.object({
  bookmarkIds: z.array(z.string().uuid()).min(1),
});
