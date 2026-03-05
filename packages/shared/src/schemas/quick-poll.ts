import { z } from "zod";
import {
  MAX_OPTIONS_PER_QUICK_POLL,
  MIN_OPTIONS_PER_QUICK_POLL,
  QUICK_POLL_OPTION_MAX_LENGTH,
  QUICK_POLL_QUESTION_MAX_LENGTH,
} from "../limits";

export const quickPollStatusSchema = z.enum(["open", "closed"]);
export type QuickPollStatus = z.infer<typeof quickPollStatusSchema>;

export const createQuickPollSchema = z.object({
  question: z.string().min(1).max(QUICK_POLL_QUESTION_MAX_LENGTH),
  options: z
    .array(z.object({ label: z.string().min(1).max(QUICK_POLL_OPTION_MAX_LENGTH) }))
    .min(MIN_OPTIONS_PER_QUICK_POLL)
    .max(MAX_OPTIONS_PER_QUICK_POLL),
  allowMultiple: z.boolean().optional().default(false),
  showResultsBeforeVote: z.boolean().optional().default(true),
});

export const updateQuickPollSchema = z.object({
  status: z.literal("closed").optional(),
});

export const quickPollVoteSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1),
  anonymousId: z.string().uuid().optional(),
});

export const quickPollDeleteVoteSchema = z.object({
  anonymousId: z.string().uuid().optional(),
});

// Response type for shared poll endpoint
export type QuickPollResponse = {
  id: string;
  question: string;
  allowMultiple: boolean;
  showResultsBeforeVote: boolean;
  status: QuickPollStatus;
  creatorId: string;
  expiresAt: string;
  createdAt: string;
  options: {
    id: string;
    label: string;
    sortOrder: number;
    voteCount: number;
  }[];
  totalVotes: number;
  myVoteOptionIds: string[];
};
