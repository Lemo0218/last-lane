import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { submitScore } from "../../api/submit-score"
import { InMemoryBlobAdapter, RankingStore } from "../../src/server/blob-store"
import { LayeredRateLimiter } from "../../src/server/rate-limit"
import { issueTicket, verifyTicket } from "../../src/server/ticket"
import { verifyReplay } from "../../src/server/verifier"

const secret = "handler-secret"
const limiter = (): LayeredRateLimiter =>
  new LayeredRateLimiter("tests", { burst: 100, sustained: 100 })
const request = (body: unknown, headers?: HeadersInit): Request =>
  new Request("https://example.test/api/submit-score", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })

describe("submit score handler", () => {
  it("rejects a declared body above 128 KiB", async () => {
    const response = await submitScore(request({}, { "content-length": "131073" }), {
      secret,
      store: new RankingStore(new InMemoryBlobAdapter()),
      now: () => 1,
      limiter: limiter(),
    })
    expect(response.status).toBe(413)
  })

  it("rejects more than 2400 transcript changes", async () => {
    const ticket = issueTicket(
      secret,
      0,
      () => "handler-nonce-000",
      () => 1,
    )
    const entries = Array.from({ length: 2_401 }, (_, tick) => ({
      tick,
      move: tick % 2 === 0 ? "L" : "R",
    }))
    const response = await submitScore(
      request({ ticket, nickname: "Runner", transcript: { entries, endTick: 2_402 } }),
      {
        secret,
        store: new RankingStore(new InMemoryBlobAdapter()),
        now: () => 1,
        limiter: limiter(),
      },
    )
    expect(response.status).toBe(400)
  })

  it("repairs an expired matching pending result and preserves its first timestamp", async () => {
    const ticket = issueTicket(
      secret,
      0,
      () => "handler-nonce-001",
      () => 1,
    )
    const transcript = { entries: [{ tick: 0, move: "N" }], endTick: 844 }
    const result = verifyReplay(1, transcript, 2_000)
    const payload = verifyTicket(ticket.token, secret, 1, true)
    const stored = {
      nonce: payload.nonce,
      ticketDigest: createHash("sha256").update(ticket.token).digest("hex"),
      nickname: "Runner",
      score: result.score,
      survivalTicks: result.survivalTicks,
      submittedAt: "1970-01-01T00:01:00.000Z",
    }
    const adapter = new InMemoryBlobAdapter()
    await adapter.put(`pending/${stored.nonce}.json`, JSON.stringify(stored), {
      allowOverwrite: false,
    })
    const response = await submitScore(request({ ticket, nickname: "Runner", transcript }), {
      secret,
      store: new RankingStore(adapter),
      now: () => ticket.deadlineMs + 60_000,
      limiter: limiter(),
    })
    expect(response.status).toBe(200)
    expect(JSON.parse((await adapter.get(`runs/${stored.nonce}.json`))?.body ?? "null")).toEqual(
      stored,
    )
  })

  it("settles simultaneous identical retries on the earliest server minute", async () => {
    const ticket = issueTicket(
      secret,
      0,
      () => "handler-nonce-002",
      () => 1,
    )
    const transcript = { entries: [{ tick: 0, move: "N" }], endTick: 844 }
    const adapter = new InMemoryBlobAdapter()
    const store = new RankingStore(adapter)
    const payload = { ticket, nickname: "Runner", transcript }
    const [early, late] = await Promise.all([
      submitScore(request(payload), {
        secret,
        store,
        now: () => 60_001,
        limiter: limiter(),
      }),
      submitScore(request(payload), {
        secret,
        store,
        now: () => 120_001,
        limiter: limiter(),
      }),
    ])
    const nonce = verifyTicket(ticket.token, secret, 1, true).nonce
    const stored = JSON.parse((await adapter.get(`runs/${nonce}.json`))?.body ?? "null")
    expect([early.status, late.status]).toEqual([200, 200])
    expect(stored.submittedAt).toBe("1970-01-01T00:01:00.000Z")
  })

  it("rejects a simultaneous conflicting nickname for one nonce", async () => {
    const ticket = issueTicket(
      secret,
      0,
      () => "handler-nonce-003",
      () => 1,
    )
    const transcript = { entries: [{ tick: 0, move: "N" }], endTick: 844 }
    const store = new RankingStore(new InMemoryBlobAdapter())
    const responses = await Promise.all([
      submitScore(request({ ticket, nickname: "First", transcript }), {
        secret,
        store,
        now: () => 1,
        limiter: limiter(),
      }),
      submitScore(request({ ticket, nickname: "Second", transcript }), {
        secret,
        store,
        now: () => 1,
        limiter: limiter(),
      }),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
  })
})
