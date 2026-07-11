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
    const longer = scorePath({
      score: 20,
      survivalTicks: 3,
      submittedAt: "2026-01-01T00:00:00.000Z",
      nonce: "b",
    })
    const earlier = scorePath({
      score: 20,
      survivalTicks: 3,
      submittedAt: "2025-12-31T23:59:00.000Z",
      nonce: "z",
    })
    const stableNonce = scorePath({
      score: 20,
      survivalTicks: 3,
      submittedAt: "2025-12-31T23:59:00.000Z",
      nonce: "a",
    })
    expect(longer.localeCompare(high)).toBe(-1)
    expect(earlier.localeCompare(longer)).toBe(-1)
    expect(stableNonce.localeCompare(earlier)).toBe(-1)
  })

  it("adopts the winning pending timestamp for concurrent identical publication", async () => {
    const adapter = new InMemoryBlobAdapter()
    const store = new RankingStore(adapter)
    const base = {
      nonce: "concurrent",
      ticketDigest: "c".repeat(64),
      nickname: "Neo",
      score: 7,
      survivalTicks: 8,
    }
    const early = { ...base, submittedAt: "2026-01-01T00:00:00.000Z" }
    const late = { ...base, submittedAt: "2026-01-01T00:01:00.000Z" }
    const [first, second] = await Promise.all([store.publish(early), store.publish(late)])
    expect(first).toEqual(early)
    expect(second).toEqual(early)
    expect(await store.repairExisting(late)).toEqual(early)
  })

  it("rejects a concurrent conflicting result for the same nonce", async () => {
    const adapter = new InMemoryBlobAdapter()
    const store = new RankingStore(adapter)
    const run = {
      nonce: "collision",
      ticketDigest: "d".repeat(64),
      nickname: "Neo",
      score: 7,
      survivalTicks: 8,
      submittedAt: "2026-01-01T00:00:00.000Z",
    }
    const settled = await Promise.allSettled([
      store.publish(run),
      store.publish({ ...run, ticketDigest: "e".repeat(64) }),
    ])
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(settled.filter((result) => result.status === "rejected")).toHaveLength(1)
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

  it("repairs a matching pending result and rejects a conflicting retry", async () => {
    const adapter = new InMemoryBlobAdapter()
    const store = new RankingStore(adapter)
    const run = {
      nonce: "stable",
      ticketDigest: "a".repeat(64),
      nickname: "Neo",
      score: 1,
      survivalTicks: 2,
      submittedAt: "2026-01-01T00:00:00.000Z",
    }
    await adapter.put("pending/stable.json", JSON.stringify(run), { allowOverwrite: false })
    expect(await store.repairExisting({ ...run, submittedAt: "2026-01-01T00:09:00.000Z" })).toEqual(
      run,
    )
    await expect(store.publish({ ...run, nickname: "Other" })).rejects.toThrow("conflict")
  })

  it("writes pending then score then run then deletes pending", async () => {
    const operations: string[] = []
    class RecordingAdapter extends InMemoryBlobAdapter {
      override async put(
        path: string,
        body: string,
        options: Readonly<{ allowOverwrite: boolean }>,
      ): Promise<void> {
        operations.push(`put:${path}:${String(options.allowOverwrite)}`)
        await super.put(path, body, options)
      }
      override async delete(path: string): Promise<void> {
        operations.push(`delete:${path}`)
        await super.delete(path)
      }
    }
    const run = {
      nonce: "ordered",
      ticketDigest: "a".repeat(64),
      nickname: "Neo",
      score: 2,
      survivalTicks: 3,
      submittedAt: "2026-01-01T00:00:00.000Z",
    }
    await new RankingStore(new RecordingAdapter()).publish(run)
    expect(operations.map((value) => value.split(":")[0])).toEqual([
      "put",
      "put",
      "put",
      "put",
      "delete",
      "put",
    ])
    expect(operations.slice(0, 4).every((value) => value.endsWith("false"))).toBe(true)
    expect(operations.at(-1)?.endsWith("true")).toBe(true)
  })
})
