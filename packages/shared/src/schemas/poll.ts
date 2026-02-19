import { z } from "zod";
import { MAX_OPTIONS_PER_POLL } from "../limits";

export const POLL_TITLE_MAX_LENGTH = 100;
export const POLL_DESTINATION_MAX_LENGTH = 100;
export const POLL_NOTE_MAX_LENGTH = 2000;
export const pollStatusSchema = z.enum(["open", "confirmed", "closed"]);
export type PollStatus = z.infer<typeof pollStatusSchema>;

export const pollResponseValueSchema = z.enum(["ok", "maybe", "ng"]);
export type PollResponseValue = z.infer<typeof pollResponseValueSchema>;

export const createPollSchema = z.object({
  title: z.string().min(1).max(POLL_TITLE_MAX_LENGTH),
  destination: z.string().max(POLL_DESTINATION_MAX_LENGTH).optional(),
  note: z.string().max(POLL_NOTE_MAX_LENGTH).optional(),
  deadline: z.string().datetime().optional(),
  options: z
    .array(
      z
        .object({
          startDate: z.string().date(),
          endDate: z.string().date(),
        })
        .refine((o) => o.endDate >= o.startDate, {
          message: "endDate must be >= startDate",
        }),
    )
    .min(1)
    .max(MAX_OPTIONS_PER_POLL),
});

export const updatePollSchema = z.object({
  title: z.string().min(1).max(POLL_TITLE_MAX_LENGTH).optional(),
  destination: z.string().max(POLL_DESTINATION_MAX_LENGTH).nullable().optional(),
  note: z.string().max(POLL_NOTE_MAX_LENGTH).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
});

export const addPollOptionSchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((o) => o.endDate >= o.startDate, {
    message: "endDate must be >= startDate",
  });

export const addPollParticipantSchema = z.object({
  userId: z.string().uuid(),
});

export const submitPollResponsesSchema = z.object({
  responses: z.array(
    z.object({
      optionId: z.string().uuid(),
      response: pollResponseValueSchema,
    }),
  ),
});

export const confirmPollSchema = z.object({
  optionId: z.string().uuid(),
});
