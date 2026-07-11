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
})
