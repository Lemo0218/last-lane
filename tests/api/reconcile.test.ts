import { expect, it } from "vitest"
import reconcile from "../../api/reconcile"
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

it("returns unavailable without a cron secret and unauthorized for a wrong secret", async () => {
  const previous = process.env["CRON_SECRET"]
  delete process.env["CRON_SECRET"]
  const missing = await reconcile(new Request("https://example.test/api/reconcile"))
  process.env["CRON_SECRET"] = "expected"
  const wrong = await reconcile(
    new Request("https://example.test/api/reconcile", {
      headers: { authorization: "Bearer wrong" },
    }),
  )
  if (previous === undefined) delete process.env["CRON_SECRET"]
  else process.env["CRON_SECRET"] = previous
  expect(missing.status).toBe(503)
  expect(wrong.status).toBe(401)
})

it("quarantines pending results older than 24 hours", async () => {
  const adapter = new InMemoryBlobAdapter(() => 0)
  const run = {
    nonce: "old",
    ticketDigest: "d".repeat(64),
    nickname: "Runner",
    score: 9,
    survivalTicks: 10,
    submittedAt: "2026-01-01T00:00:00.000Z",
  }
  await adapter.put("pending/old.json", JSON.stringify(run), { allowOverwrite: false })
  const result = await new RankingStore(adapter).reconcile(24 * 60 * 60 * 1_000 + 1)
  expect(result).toEqual({ repaired: 0, failed: 1 })
  expect(await adapter.get("failed/old.json")).toBeDefined()
})

it("repairs a post-pending failure without scanning 101 published scores", async () => {
  class FailingAdapter extends InMemoryBlobAdapter {
    failScore = true
    override async put(
      path: string,
      body: string,
      options: Readonly<{ allowOverwrite: boolean }>,
    ): Promise<void> {
      if (this.failScore && path.startsWith("scores/")) {
        this.failScore = false
        throw new Error("injected projection failure")
      }
      await super.put(path, body, options)
    }
  }
  const adapter = new FailingAdapter()
  const store = new RankingStore(adapter)
  const run = {
    nonce: "recover",
    ticketDigest: "d".repeat(64),
    nickname: "Runner",
    score: 9,
    survivalTicks: 10,
    submittedAt: "2026-01-01T00:00:00.000Z",
  }
  await expect(store.publish(run)).rejects.toThrow("injected")
  for (let index = 0; index < 101; index += 1)
    await adapter.put(`scores/existing-${String(index).padStart(3, "0")}.json`, "{}", {
      allowOverwrite: false,
    })
  expect(await store.reconcile()).toEqual({ repaired: 1, failed: 0 })
  expect(await adapter.get("runs/recover.json")).toBeDefined()
})

it("serializes quarantine against repair so a nonce is never failed and ranked", async () => {
  const adapter = new InMemoryBlobAdapter(() => 0)
  const run = {
    nonce: "lease-race",
    ticketDigest: "f".repeat(64),
    nickname: "Runner",
    score: 3,
    survivalTicks: 4,
    submittedAt: "2026-01-01T00:00:00.000Z",
  }
  await adapter.put("pending/lease-race.json", JSON.stringify(run), { allowOverwrite: false })
  const store = new RankingStore(adapter, () => 100_000_000)
  await Promise.allSettled([store.reconcile(100_000_000), store.repairExisting(run)])
  const failed = await adapter.get("failed/lease-race.json")
  const ranked = await adapter.get("runs/lease-race.json")
  expect(Number(failed !== undefined) + Number(ranked !== undefined)).toBe(1)
})

it("recovers a conservatively expired publication lease", async () => {
  const adapter = new InMemoryBlobAdapter()
  await adapter.put(
    "locks/stale",
    JSON.stringify({ owner: "00000000-0000-4000-8000-000000000000", expiresAt: 1 }),
    { allowOverwrite: false },
  )
  const run = {
    nonce: "stale",
    ticketDigest: "a".repeat(64),
    nickname: "Runner",
    score: 3,
    survivalTicks: 4,
    submittedAt: "2026-01-01T00:00:00.000Z",
  }
  await expect(new RankingStore(adapter, () => 10_000).publish(run)).resolves.toEqual(run)
})
