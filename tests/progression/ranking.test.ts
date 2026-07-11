import { beforeEach, describe, expect, it, vi } from "vitest"

import { createRankingClient } from "../../src/ranking/client"
import { createRankedRun } from "../../src/ranking/ranked-run"
import { createRetryQueue } from "../../src/ranking/retry-queue"

describe("ranking progression", () => {
  beforeEach(() => localStorage.clear())
  it("stops ticket-aware retries at the submission deadline", async () => {
    // Given
    const submit = vi.fn().mockRejectedValue(new TypeError("offline"))
    const queue = createRetryQueue({ storage: localStorage, now: () => 101 })
    queue.enqueue({
      ticket: { token: "t", deadlineMs: 100, seed: 1, ruleset: "last-lane-v1" },
      nickname: "생존자",
      transcript: { entries: [], endTick: 0 },
    })
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
    queue.enqueue({
      ticket: { token: "t", deadlineMs: 100, seed: 1, ruleset: "last-lane-v1" },
      nickname: "생존자",
      transcript: { entries: [], endTick: 0 },
    })
    // When
    const accepted = await queue.flush(submit)
    // Then
    expect(submit).toHaveBeenCalledOnce()
    expect(queue.size()).toBe(0)
    expect(accepted).toEqual([
      {
        submission: {
          ticket: { token: "t", deadlineMs: 100, seed: 1, ruleset: "last-lane-v1" },
          nickname: "생존자",
          transcript: { entries: [], endTick: 0 },
        },
        rank: 4,
      },
    ])
  })

  it("requests a ticket before a ranked run and submits only the proof payload", async () => {
    // Given
    const requestTicket = vi
      .fn()
      .mockResolvedValue({ token: "ticket", deadlineMs: 999, seed: 1, ruleset: "last-lane-v1" })
    const submit = vi.fn().mockResolvedValue({ accepted: true, rank: 7 })
    const session = createRankedRun({ requestTicket, submit, enqueue: vi.fn(), now: () => 1 })
    // When
    await session.start()
    const outcome = await session.finish("러너", {
      entries: [{ tick: 0, move: "R" }],
      endTick: 3,
    })
    // Then
    expect(requestTicket).toHaveBeenCalledOnce()
    expect(submit).toHaveBeenCalledWith({
      ticket: { token: "ticket", deadlineMs: 999, seed: 1, ruleset: "last-lane-v1" },
      nickname: "러너",
      transcript: { entries: [{ tick: 0, move: "R" }], endTick: 3 },
    })
    expect(outcome).toEqual({ kind: "ranked", rank: 7 })
  })

  it("queues transient failures without inventing a rank", async () => {
    // Given
    const enqueue = vi.fn()
    const session = createRankedRun({
      requestTicket: vi
        .fn()
        .mockResolvedValue({ token: "ticket", deadlineMs: 999, seed: 1, ruleset: "last-lane-v1" }),
      submit: vi.fn().mockRejectedValue(new TypeError("offline")),
      enqueue,
      now: () => 1,
    })
    await session.start()
    // When
    const outcome = await session.finish("러너", { entries: [], endTick: 0 })
    // Then
    expect(outcome).toEqual({ kind: "queued", token: "ticket" })
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

  it("clears a stale ticket before a failed restart", async () => {
    // Given
    const requestTicket = vi
      .fn()
      .mockResolvedValueOnce({ token: "stale", deadlineMs: 999, seed: 1, ruleset: "last-lane-v1" })
      .mockRejectedValueOnce(new Error("offline"))
    const submit = vi.fn()
    const session = createRankedRun({ requestTicket, submit, enqueue: vi.fn(), now: () => 1 })
    await session.start()
    // When
    await session.start()
    const outcome = await session.finish("러너", { entries: [], endTick: 0 })
    // Then
    expect(outcome).toEqual({ kind: "unranked" })
    expect(submit).not.toHaveBeenCalled()
  })

  it("atomically consumes a ticket after the first finish attempt", async () => {
    // Given
    const submit = vi.fn().mockResolvedValue({ accepted: true, rank: 7 })
    const session = createRankedRun({
      requestTicket: vi
        .fn()
        .mockResolvedValue({ token: "once", deadlineMs: 999, seed: 1, ruleset: "last-lane-v1" }),
      submit,
      enqueue: vi.fn(),
      now: () => 1,
    })
    await session.start()
    // When
    const first = await session.finish("러너", { entries: [], endTick: 0 })
    const duplicate = await session.finish("러너", { entries: [], endTick: 0 })
    // Then
    expect(first).toEqual({ kind: "ranked", rank: 7 })
    expect(duplicate).toEqual({ kind: "unranked" })
    expect(submit).toHaveBeenCalledOnce()
  })

  it("consumes an expired ticket instead of retaining stale authorization", async () => {
    // Given
    let now = 100
    const submit = vi.fn().mockResolvedValue({ accepted: true, rank: 7 })
    const session = createRankedRun({
      requestTicket: vi
        .fn()
        .mockResolvedValue({ token: "expired", deadlineMs: 50, seed: 1, ruleset: "last-lane-v1" }),
      submit,
      enqueue: vi.fn(),
      now: () => now,
    })
    await session.start()
    // When
    const expired = await session.finish("러너", { entries: [], endTick: 0 })
    now = 1
    const repeated = await session.finish("러너", { entries: [], endTick: 0 })
    // Then
    expect(expired).toEqual({ kind: "unranked" })
    expect(repeated).toEqual({ kind: "unranked" })
    expect(submit).not.toHaveBeenCalled()
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
      ticket: { token: "t", deadlineMs: 4, seed: 1, ruleset: "last-lane-v1" },
      nickname: "나",
      transcript: { entries: [], endTick: 0 },
    })
    const board = await client.leaderboard()
    // Then
    expect(submitted.rank).toBe(2)
    expect(board.entries[0]?.nickname).toBe("에이스")
  })

  it("rejects an excessively long leaderboard nickname at the HTTP boundary", async () => {
    const client = createRankingClient({
      post: vi.fn(),
      get: vi.fn().mockReturnValue({
        json: () =>
          Promise.resolve({ entries: [{ rank: 1, nickname: "가".repeat(17), score: 1 }] }),
      }),
    })
    await expect(client.leaderboard()).rejects.toThrow()
  })

  it("requests and parses a run ticket at the HTTP boundary", async () => {
    // Given
    const transport = {
      post: vi.fn().mockReturnValue({
        json: () =>
          Promise.resolve({
            token: "signed-ticket",
            deadlineMs: 5000,
            seed: 1,
            ruleset: "last-lane-v1",
          }),
      }),
      get: vi.fn(),
    }
    const client = createRankingClient(transport)
    // When
    const ticket = await client.requestTicket()
    // Then
    expect(transport.post).toHaveBeenCalledWith("/api/run-ticket")
    expect(ticket).toEqual({
      token: "signed-ticket",
      deadlineMs: 5000,
      seed: 1,
      ruleset: "last-lane-v1",
    })
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
