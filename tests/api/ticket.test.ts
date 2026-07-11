import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { issueTicket, verifyTicket } from "../../src/server/ticket"

describe("ranked tickets", () => {
  it("rejects a tampered HMAC ticket", () => {
    const ticket = issueTicket(
      "secret",
      1_000,
      () => "nonce-00000000000",
      () => 7,
    )
    expect(() => verifyTicket(`${ticket.token}x`, "secret", 1_001)).toThrow("ticket")
  })

  it("rejects an expired ticket", () => {
    const ticket = issueTicket(
      "secret",
      1_000,
      () => "nonce-00000000000",
      () => 7,
    )
    expect(() => verifyTicket(ticket.token, "secret", ticket.deadlineMs + 1)).toThrow("expired")
  })

  it("exposes the signed seed and rejects an unknown signed ruleset", () => {
    const ticket = issueTicket(
      "secret",
      1_000,
      () => "nonce-00000000000",
      () => 7,
    )
    expect(ticket).toMatchObject({ seed: 7, ruleset: "last-lane-v1" })
    const body = Buffer.from(
      JSON.stringify({
        seed: 7,
        nonce: "nonce-00000000000",
        issuedAt: 1_000,
        submissionDeadline: 2_000,
        ruleset: "future-v2",
      }),
    ).toString("base64url")
    const signature = createHmac("sha256", "secret").update(body).digest("base64url")
    expect(() => verifyTicket(`${body}.${signature}`, "secret", 1_001)).toThrow("unknown ruleset")
  })
})
