import { z } from "zod";

export const POLL_NOTE_MAX_LENGTH = 2000;
export const pollStatusSchema = z.enum(["open", "confirmed", "closed"]);
export type PollStatus = z.infer<typeof pollStatusSchema>;

export const pollResponseValueSchema = z.enum(["ok", "maybe", "ng"]);
export type PollResponseValue = z.infer<typeof pollResponseValueSchema>;

export const updatePollSchema = z.object({
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
