import { z } from "zod"
import { transcriptSchema } from "../game/transcript"

export const RULESET = "last-lane-v1" as const
export const ticketPayloadSchema = z.object({
  seed: z.number().int().nonnegative().max(0xffff_ffff),
  nonce: z.string().min(16).max(128),
  issuedAt: z.number().int().nonnegative(),
  submissionDeadline: z.number().int().positive(),
  ruleset: z.literal(RULESET),
})
export type TicketPayload = z.infer<typeof ticketPayloadSchema>
export const signedTicketSchema = z.object({
  token: z.string().min(1),
  deadlineMs: z.number().int().positive(),
})
export const scoreSubmissionSchema = z.object({
  ticket: signedTicketSchema,
  nickname: z.string(),
  transcript: transcriptSchema,
})

export const rankedRunSchema = z.object({
  nonce: z.string().min(1),
  ticketDigest: z.string().length(64),
  nickname: z.string().min(1).max(16),
  score: z.number().int().nonnegative(),
  survivalTicks: z.number().int().nonnegative().max(60_000),
  submittedAt: z.iso.datetime(),
})
export type RankedRun = Readonly<z.infer<typeof rankedRunSchema>>
