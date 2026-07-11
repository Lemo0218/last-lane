import { beforeEach, describe, expect, it, vi } from "vitest"
import { createRetryQueue } from "../../src/ranking/retry-queue"

describe("retry queue concurrency", () => {
  beforeEach(() => localStorage.clear())

  it("shares one flush between overlapping callers without duplicate submissions", async () => {
    let release: (() => void) | undefined
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const submit = vi.fn(async () => {
      await blocked
      return { accepted: true as const, rank: 1 }
    })
    const queue = createRetryQueue({ storage: localStorage, now: () => 1 })
    queue.enqueue({ ticket: { token: "one", deadlineMs: 100 }, nickname: "한번", transcript: [] })
    const first = queue.flush(submit)
    const second = queue.flush(submit)
    release?.()
    const [a, b] = await Promise.all([first, second])
    expect(submit).toHaveBeenCalledOnce()
    expect(a).toEqual(b)
  })

  it("preserves an item enqueued while a flush is awaiting the network", async () => {
    let release: (() => void) | undefined
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const queue = createRetryQueue({ storage: localStorage, now: () => 1 })
    queue.enqueue({ ticket: { token: "old", deadlineMs: 100 }, nickname: "이전", transcript: [] })
    const flushing = queue.flush(async () => {
      await blocked
      return { accepted: true, rank: 1 }
    })
    queue.enqueue({ ticket: { token: "new", deadlineMs: 100 }, nickname: "신규", transcript: [] })
    release?.()
    await flushing
    expect(queue.size()).toBe(1)
  })

  it("persists accepted progress before a later unexpected failure", async () => {
    const queue = createRetryQueue({ storage: localStorage, now: () => 1 })
    queue.enqueue({
      ticket: { token: "accepted", deadlineMs: 100 },
      nickname: "성공",
      transcript: [],
    })
    queue.enqueue({
      ticket: { token: "broken", deadlineMs: 100 },
      nickname: "오류",
      transcript: [],
    })
    const submit = vi
      .fn()
      .mockResolvedValueOnce({ accepted: true, rank: 1 })
      .mockRejectedValueOnce(new Error("boom"))
    await expect(queue.flush(submit)).rejects.toThrow("boom")
    expect(queue.size()).toBe(1)
    await queue.flush(vi.fn().mockResolvedValue({ accepted: true, rank: 2 }))
    expect(queue.size()).toBe(0)
  })
})
