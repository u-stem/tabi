import { z } from "zod";

export const CHAT_MESSAGE_MAX_LENGTH = 1000;
export const CHAT_SESSION_TTL_HOURS = 72;

export const sendChatMessageSchema = z.object({
  content: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
});

export const updateChatMessageSchema = z.object({
  content: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
});
