import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto"
import { RULESET, type TicketPayload, ticketPayloadSchema } from "../api/contracts"

const LIFE_MS = 12 * 60 * 1_000

export class TicketError extends Error {
  constructor(readonly code: "invalid-ticket" | "expired-ticket" | "unknown-ruleset") {
    super(code.replaceAll("-", " "))
    this.name = "TicketError"
  }
}

const encode = (value: string): string => Buffer.from(value).toString("base64url")
const sign = (body: string, secret: string): string =>
  createHmac("sha256", secret).update(body).digest("base64url")

export const issueTicket = (
  secret: string,
  now = Date.now(),
  nonce = (): string => randomBytes(24).toString("base64url"),
  seed = (): number => randomInt(0, 0x1_0000_0000),
) => {
  const payload = ticketPayloadSchema.parse({
    seed: seed(),
    nonce: nonce(),
    issuedAt: now,
    submissionDeadline: now + LIFE_MS,
    ruleset: RULESET,
  })
  const body = encode(JSON.stringify(payload))
  return { token: `${body}.${sign(body, secret)}`, deadlineMs: payload.submissionDeadline }
}

export const verifyTicket = (token: string, secret: string, now = Date.now()): TicketPayload => {
  const [body, signature, extra] = token.split(".")
  if (body === undefined || signature === undefined || extra !== undefined)
    throw new TicketError("invalid-ticket")
  const expected = Buffer.from(sign(body, secret))
  const supplied = Buffer.from(signature)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
    throw new TicketError("invalid-ticket")
  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch (error) {
    if (error instanceof SyntaxError) throw new TicketError("invalid-ticket")
    throw error
  }
  const parsed = ticketPayloadSchema.safeParse(decoded)
  if (!parsed.success) {
    const ruleset =
      typeof decoded === "object" && decoded !== null && "ruleset" in decoded
        ? decoded.ruleset
        : undefined
    if (ruleset !== undefined && ruleset !== RULESET) throw new TicketError("unknown-ruleset")
    throw new TicketError("invalid-ticket")
  }
  if (now > parsed.data.submissionDeadline) throw new TicketError("expired-ticket")
  return parsed.data
}
