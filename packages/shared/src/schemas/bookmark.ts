import { z } from "zod";
import {
  BOOKMARK_LIST_NAME_MAX_LENGTH,
  BOOKMARK_MEMO_MAX_LENGTH,
  BOOKMARK_NAME_MAX_LENGTH,
  BOOKMARK_URL_MAX_LENGTH,
  MAX_URLS_PER_BOOKMARK,
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

const singleBookmarkUrlSchema = z
  .string()
  .url()
  .max(BOOKMARK_URL_MAX_LENGTH)
  .refine((v) => {
    const { protocol } = new URL(v);
    return protocol === "http:" || protocol === "https:";
  }, "Only http and https URLs are allowed");

const bookmarkUrlsSchema = z
  .array(singleBookmarkUrlSchema)
  .max(MAX_URLS_PER_BOOKMARK)
  .refine((arr) => new Set(arr).size === arr.length, "Duplicate URLs are not allowed")
  .default([]);

export const createBookmarkSchema = z.object({
  name: z.string().min(1).max(BOOKMARK_NAME_MAX_LENGTH),
  memo: z.string().max(BOOKMARK_MEMO_MAX_LENGTH).nullish(),
  urls: bookmarkUrlsSchema,
});

export const updateBookmarkSchema = z.object({
  name: z.string().min(1).max(BOOKMARK_NAME_MAX_LENGTH).optional(),
  memo: z.string().max(BOOKMARK_MEMO_MAX_LENGTH).nullish(),
  urls: bookmarkUrlsSchema.optional(),
});

export const reorderBookmarksSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

export const batchBookmarkIdsSchema = z.object({
  bookmarkIds: z.array(z.string().uuid()).min(1),
});

export const saveFromSchedulesSchema = z.object({
  tripId: z.string().uuid(),
  scheduleIds: z.array(z.string().uuid()).min(1),
});
