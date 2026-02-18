import { z } from "zod";
import {
  BOOKMARK_LIST_NAME_MAX_LENGTH,
  BOOKMARK_MEMO_MAX_LENGTH,
  BOOKMARK_NAME_MAX_LENGTH,
  BOOKMARK_URL_MAX_LENGTH,
  MAX_BOOKMARK_LISTS_PER_USER,
  MAX_BOOKMARKS_PER_LIST,
  MAX_URLS_PER_BOOKMARK,
} from "../limits";
import { httpUrlSchema } from "./url";

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
  orderedIds: z.array(z.string().uuid()).max(MAX_BOOKMARK_LISTS_PER_USER),
});

const singleBookmarkUrlSchema = httpUrlSchema(BOOKMARK_URL_MAX_LENGTH);

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
  orderedIds: z.array(z.string().uuid()).max(MAX_BOOKMARKS_PER_LIST),
});

export const batchBookmarkIdsSchema = z.object({
  bookmarkIds: z.array(z.string().uuid()).min(1),
});

export const saveFromSchedulesSchema = z.object({
  tripId: z.string().uuid(),
  scheduleIds: z.array(z.string().uuid()).min(1),
});
