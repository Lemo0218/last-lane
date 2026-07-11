import { LayeredRateLimiter } from "../src/server/rate-limit"
import { issueTicket } from "../src/server/ticket"

const limiter = new LayeredRateLimiter("ticket-issuance", { burst: 5, sustained: 30 })
const json = (body: unknown, status = 200): Response => Response.json(body, { status })

export default function handler(request: Request): Response {
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405)
  const secret = process.env["TICKET_HMAC_SECRET"]
  if (secret === undefined) return json({ error: "ranked service unavailable" }, 503)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!limiter.allow(ip)) return json({ error: "rate limited" }, 429)
  return json(issueTicket(secret))
}
