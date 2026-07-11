import { describe, expect, it } from "vitest"
import { rankingSecrets } from "../../src/server/secrets"

describe("rankingSecrets", () => {
  it("returns independent ticket and IP-hash secrets when both are configured", () => {
    // Given
    const environment = {
      RUN_TICKET_SECRET: "ticket-secret",
      IP_HASH_SECRET: "ip-hash-secret",
    }

    // When
    const secrets = rankingSecrets(environment)

    // Then
    expect(secrets).toEqual({ ticket: "ticket-secret", ipHash: "ip-hash-secret" })
  })

  it("returns unavailable when either secret is missing", () => {
    // Given
    const environment = { RUN_TICKET_SECRET: "ticket-secret" }

    // When
    const secrets = rankingSecrets(environment)

    // Then
    expect(secrets).toBeUndefined()
  })
})
