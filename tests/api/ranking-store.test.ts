import { describe, expect, it } from "vitest"
import { InMemoryBlobAdapter, RankingStore, scorePath } from "../../src/server/blob-store"

describe("ranking store", () => {
  it("orders deterministic score paths lexicographically", () => {
    const high = scorePath({
      score: 20,
      survivalTicks: 2,
      submittedAt: "2026-01-01T00:00:00Z",
      nonce: "a",
    })
    const low = scorePath({
      score: 10,
      survivalTicks: 2,
      submittedAt: "2026-01-01T00:00:00Z",
      nonce: "b",
    })
    expect(high.localeCompare(low)).toBe(-1)
  })

  it("publishes pending then audit and remains idempotent", async () => {
    const adapter = new InMemoryBlobAdapter()
    const store = new RankingStore(adapter)
    const run = {
      nonce: "n",
      ticketDigest: "d".repeat(64),
      nickname: "Neo",
      score: 1,
      survivalTicks: 2,
      submittedAt: "2026-01-01T00:00:00Z",
    }
    await store.publish(run)
    await store.publish(run)
    expect((await store.leaderboard()).map((entry) => entry.nonce)).toEqual(["n"])
  })
})
