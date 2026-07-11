import ky from "ky"
import { z } from "zod"
import { type Transcript, transcriptSchema } from "../game/transcript"

export const ticketSchema = z.object({
  token: z.string().min(1),
  deadlineMs: z.number().int().positive(),
})
export type RunTicket = z.infer<typeof ticketSchema>
export const submissionSchema = z.object({
  ticket: ticketSchema,
  nickname: z.string().trim().min(1).max(16),
  transcript: transcriptSchema,
})
export type Submission = Readonly<{ ticket: RunTicket; nickname: string; transcript: Transcript }>
const submissionResultSchema = z.object({
  accepted: z.literal(true),
  rank: z.number().int().positive(),
})
const leaderboardSchema = z.object({
  entries: z
    .array(
      z.object({
        rank: z.number().int().positive(),
        nickname: z.string().trim().min(1).max(16),
        score: z.number().int().nonnegative(),
      }),
    )
    .max(100),
})
export type LeaderboardResult = z.infer<typeof leaderboardSchema>

type JsonResponse = Readonly<{ json: () => Promise<unknown> }>
export type RankingTransport = Readonly<{
  post: (path: string, options?: Readonly<{ json: unknown }>) => JsonResponse
  get: (path: string) => JsonResponse
}>

const defaultTransport: RankingTransport = {
  post: (path, options) => ky.post(path, { json: options?.json, timeout: 5_000, retry: 0 }),
  get: (path) => ky.get(path, { timeout: 5_000, retry: 0 }),
}

export const createRankingClient = (transport: RankingTransport = defaultTransport) => ({
  requestTicket: async (): Promise<RunTicket> =>
    ticketSchema.parse(await transport.post("/api/run-ticket").json()),
  submit: async (submission: Submission) =>
    submissionResultSchema.parse(
      await transport
        .post("/api/submit-score", { json: submissionSchema.parse(submission) })
        .json(),
    ),
  leaderboard: async (): Promise<LeaderboardResult> =>
    leaderboardSchema.parse(await transport.get("/api/leaderboard").json()),
})
