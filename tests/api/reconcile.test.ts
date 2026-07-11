import { expect, it } from "vitest"
import { InMemoryBlobAdapter, RankingStore } from "../../src/server/blob-store"

it("repairs a verified pending run after its ticket deadline", async () => {
  const adapter = new InMemoryBlobAdapter()
  const run = {
    nonce: "repair",
    ticketDigest: "d".repeat(64),
    nickname: "Runner",
    score: 9,
    survivalTicks: 10,
    submittedAt: "2026-01-01T00:00:00.000Z",
  }
  await adapter.put("pending/repair.json", JSON.stringify(run), { allowOverwrite: false })
  const result = await new RankingStore(adapter).reconcile()
  expect(result).toEqual({ repaired: 1, failed: 0 })
  expect(await adapter.get("runs/repair.json")).toBeDefined()
})
