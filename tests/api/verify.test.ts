import { describe, expect, it } from "vitest"
import { normalizeNickname } from "../../src/server/nicknames"
import { verifyReplay } from "../../src/server/verifier"

describe("authoritative replay", () => {
  it("derives duration and score from transcript ticks", () => {
    const result = verifyReplay(7, [{ tick: 120, move: "R" }], 10_000)
    expect(result.survivalTicks).toBe(120)
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it("rejects transcripts above the ten minute cap", () => {
    expect(() => verifyReplay(7, [{ tick: 60_001, move: "N" }], 10_000)).toThrow("transcript")
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
