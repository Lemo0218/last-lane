import { createHash } from "node:crypto"
import { type RankedRun, scoreSubmissionSchema } from "../src/api/contracts"
import { RankingConflictError, RankingStore, VercelBlobAdapter } from "../src/server/blob-store"
import { normalizeNickname } from "../src/server/nicknames"
import { LayeredRateLimiter } from "../src/server/rate-limit"
import { TicketError, verifyTicket } from "../src/server/ticket"
import { verifyReplay } from "../src/server/verifier"

const limiter = new LayeredRateLimiter("score-submission", { burst: 3, sustained: 12 })
const json = (body: unknown, status = 200): Response => Response.json(body, { status })
type SubmitDependencies = Readonly<{
  secret: string
  store: RankingStore
  now: () => number
  limiter: LayeredRateLimiter
}>

export const submitScore = async (
  request: Request,
  dependencies: SubmitDependencies,
): Promise<Response> => {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!dependencies.limiter.allow(ip)) return json({ error: "rate limited" }, 429)
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (declared > 128 * 1024) return json({ error: "payload too large" }, 413)
  try {
    const raw: unknown = await request.json()
    if (Buffer.byteLength(JSON.stringify(raw)) > 128 * 1024)
      return json({ error: "payload too large" }, 413)
    const submission = scoreSubmissionSchema.parse(raw)
    const now = dependencies.now()
    const ticket = verifyTicket(submission.ticket.token, dependencies.secret, now, true)
    const result = verifyReplay(ticket.seed, submission.transcript)
    const minute = Math.floor(now / 60_000) * 60_000
    const run: RankedRun = {
      nonce: ticket.nonce,
      ticketDigest: createHash("sha256").update(submission.ticket.token).digest("hex"),
      nickname: normalizeNickname(submission.nickname),
      score: result.score,
      survivalTicks: result.survivalTicks,
      submittedAt: new Date(minute).toISOString(),
    }
    const store = dependencies.store
    const repaired = await store.repairExisting(run)
    let acceptedRun = repaired ?? run
    if (repaired === undefined) {
      if (now > ticket.submissionDeadline) throw new TicketError("expired-ticket")
      acceptedRun = await store.publish(run)
    }
    const board = await store.leaderboard()
    return json({
      accepted: true,
      rank: (() => {
        const index = board.findIndex((entry) => entry.nonce === acceptedRun.nonce)
        return index < 0 ? null : index + 1
      })(),
    })
  } catch (error) {
    if (error instanceof RankingConflictError) return json({ error: error.message }, 409)
    if (error instanceof Error) return json({ error: error.message }, 400)
    throw error
  }
}

export default async function handler(request: Request): Promise<Response> {
  const secret = process.env["TICKET_HMAC_SECRET"]
  if (secret === undefined || process.env["BLOB_READ_WRITE_TOKEN"] === undefined)
    return json({ error: "ranked service unavailable" }, 503)
  return submitScore(request, {
    secret,
    store: new RankingStore(new VercelBlobAdapter()),
    now: Date.now,
    limiter,
  })
}
