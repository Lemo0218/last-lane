import { VercelBlobAdapter } from "../src/server/blob-store"
import { DistributedRateLimiter } from "../src/server/distributed-rate-limit"
import { LayeredRateLimiter } from "../src/server/rate-limit"
import { issueTicket } from "../src/server/ticket"

const limiter = new LayeredRateLimiter("ticket-issuance", { burst: 5, sustained: 30 })
const json = (body: unknown, status = 200): Response => Response.json(body, { status })

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405)
  const secret = process.env["TICKET_HMAC_SECRET"]
  if (secret === undefined || process.env["BLOB_READ_WRITE_TOKEN"] === undefined)
    return json({ error: "ranking unavailable" }, 503)
  const distributed = new DistributedRateLimiter(new VercelBlobAdapter(), secret, {
    kind: "ticket",
    windowMs: 60_000,
    slots: 30,
  })
  try {
    if (!(await distributed.allow(request.headers))) return json({ error: "rate limited" }, 429)
  } catch (error) {
    if (error instanceof Error) return json({ error: "ranking unavailable" }, 503)
    throw error
  }
  const ip = request.headers.get("x-real-ip") ?? "unknown"
  if (!limiter.allow(ip)) return json({ error: "rate limited" }, 429)
  return json(issueTicket(secret))
}
