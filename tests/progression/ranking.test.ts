import { describe, expect, it, vi } from "vitest"

import { createRankingClient } from "../../src/ranking/client"
import { createRankedRun } from "../../src/ranking/ranked-run"
import { createRetryQueue } from "../../src/ranking/retry-queue"

describe("ranking progression", () => {
  it("stops ticket-aware retries at the submission deadline", async () => {
    // Given
    const submit = vi.fn().mockRejectedValue(new TypeError("offline"))
    const queue = createRetryQueue({ storage: localStorage, now: () => 101 })
    queue.enqueue({ ticket: { token: "t", deadlineMs: 100 }, nickname: "생존자", transcript: [] })
    // When
    await queue.flush(submit)
    // Then
    expect(submit).not.toHaveBeenCalled()
    expect(queue.size()).toBe(0)
  })

  it("removes an accepted retry after connectivity returns", async () => {
    // Given
    const submit = vi.fn().mockResolvedValue({ accepted: true, rank: 4 })
    const queue = createRetryQueue({ storage: localStorage, now: () => 10 })
    queue.enqueue({ ticket: { token: "t", deadlineMs: 100 }, nickname: "생존자", transcript: [] })
    // When
    await queue.flush(submit)
    // Then
    expect(submit).toHaveBeenCalledOnce()
    expect(queue.size()).toBe(0)
  })

  it("requests a ticket before a ranked run and submits only the proof payload", async () => {
    // Given
    const requestTicket = vi.fn().mockResolvedValue({ token: "ticket", deadlineMs: 999 })
    const submit = vi.fn().mockResolvedValue({ accepted: true, rank: 7 })
    const session = createRankedRun({ requestTicket, submit, enqueue: vi.fn(), now: () => 1 })
    // When
    await session.start()
    const outcome = await session.finish("러너", [{ tick: 3, move: "R" }])
    // Then
    expect(requestTicket).toHaveBeenCalledOnce()
    expect(submit).toHaveBeenCalledWith({
      ticket: { token: "ticket", deadlineMs: 999 },
      nickname: "러너",
      transcript: [{ tick: 3, move: "R" }],
    })
    expect(outcome).toEqual({ kind: "ranked", rank: 7 })
  })

  it("queues transient failures without inventing a rank", async () => {
    // Given
    const enqueue = vi.fn()
    const session = createRankedRun({
      requestTicket: vi.fn().mockResolvedValue({ token: "ticket", deadlineMs: 999 }),
      submit: vi.fn().mockRejectedValue(new TypeError("offline")),
      enqueue,
      now: () => 1,
    })
    await session.start()
    // When
    const outcome = await session.finish("러너", [])
    // Then
    expect(outcome).toEqual({ kind: "queued" })
    expect(enqueue).toHaveBeenCalledOnce()
  })

  it("starts an explicit unranked run when the ticket endpoint is unavailable", async () => {
    // Given
    const session = createRankedRun({
      requestTicket: vi.fn().mockRejectedValue(new Error("ticket endpoint unavailable")),
      submit: vi.fn(),
      enqueue: vi.fn(),
    })
    // When
    const ranked = await session.start()
    // Then
    expect(ranked).toBe(false)
  })

  it("parses leaderboard entries and returned ranks at the HTTP boundary", async () => {
    // Given
    const transport = {
      post: vi.fn().mockReturnValue({ json: () => Promise.resolve({ accepted: true, rank: 2 }) }),
      get: vi.fn().mockReturnValue({
        json: () => Promise.resolve({ entries: [{ rank: 1, nickname: "에이스", score: 3000 }] }),
      }),
    }
    const client = createRankingClient(transport)
    // When
    const submitted = await client.submit({
      ticket: { token: "t", deadlineMs: 4 },
      nickname: "나",
      transcript: [],
    })
    const board = await client.leaderboard()
    // Then
    expect(submitted.rank).toBe(2)
    expect(board.entries[0]?.nickname).toBe("에이스")
  })

  it("requests and parses a run ticket at the HTTP boundary", async () => {
    // Given
    const transport = {
      post: vi.fn().mockReturnValue({
        json: () => Promise.resolve({ token: "signed-ticket", deadlineMs: 5000 }),
      }),
      get: vi.fn(),
    }
    const client = createRankingClient(transport)
    // When
    const ticket = await client.requestTicket()
    // Then
    expect(transport.post).toHaveBeenCalledWith("/api/run-ticket")
    expect(ticket).toEqual({ token: "signed-ticket", deadlineMs: 5000 })
  })

  it("recovers an invalid persisted retry queue without crashing", () => {
    // Given
    localStorage.setItem("last-lane:ranking-retry-v1", "not-json")
    const queue = createRetryQueue({ storage: localStorage })
    // When
    const size = queue.size()
    // Then
    expect(size).toBe(0)
  })
})
