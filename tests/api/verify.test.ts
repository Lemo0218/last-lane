import { describe, expect, it } from "vitest"
import { normalizeNickname } from "../../src/server/nicknames"
import { verifyReplay } from "../../src/server/verifier"

describe("authoritative replay", () => {
  it("derives duration and score from transcript ticks", () => {
    const result = verifyReplay(7, { entries: [{ tick: 0, move: "R" }], endTick: 120 }, 10_000)
    expect(result.survivalTicks).toBe(120)
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it("rejects transcripts above the ten minute cap", () => {
    expect(() =>
      verifyReplay(7, { entries: [{ tick: 0, move: "N" }], endTick: 60_001 }, 10_000),
    ).toThrow("transcript")
  })

  it("rejects more than 2400 changes and enforces the verifier budget", () => {
    const entries = Array.from({ length: 2_401 }, (_, tick) => ({
      tick,
      move: tick % 2 === 0 ? ("L" as const) : ("R" as const),
    }))
    expect(() => verifyReplay(7, { entries, endTick: 2_402 }, 10_000)).toThrow("transcript")
    expect(() => verifyReplay(7, { entries: [{ tick: 0, move: "N" }], endTick: 200 }, -1)).toThrow(
      "timeout",
    )
  })
})

describe("nickname boundary", () => {
  it("normalizes Unicode and whitespace", () => {
    expect(normalizeNickname("  Ｎｅｏ   Kim  ")).toBe("Neo Kim")
  })

  it("rejects blocked and overlong nicknames", () => {
    expect(() => normalizeNickname("Admin")).toThrow("nickname")
    expect(() => normalizeNickname("abcdefghijklmnopq")).toThrow("nickname")
  })
})
