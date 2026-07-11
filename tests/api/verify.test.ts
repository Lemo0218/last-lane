import { describe, expect, it } from "vitest"
import { createWaveRuntime } from "../../src/game/wave-runtime"
import { normalizeNickname } from "../../src/server/nicknames"
import { verifyReplay } from "../../src/server/verifier"

describe("authoritative replay", () => {
  it("rejects a live run at an arbitrary claimed end", () => {
    expect(() =>
      verifyReplay(7, { entries: [{ tick: 0, move: "R" }], endTick: 120 }, 10_000),
    ).toThrow("outcome")
  })

  it("accepts only the exact first game-over tick", () => {
    let runtime = createWaveRuntime(undefined, 0, 1)
    let terminalTick = 0
    for (let tick = 1; tick <= 60_000; tick += 1) {
      runtime = runtime.step({ moveX: 0, paused: false })
      if (runtime.active.production.simulation.status === "game-over") {
        terminalTick = tick
        break
      }
    }
    expect(terminalTick).toBeGreaterThan(0)
    const transcript = { entries: [{ tick: 0, move: "N" as const }], endTick: terminalTick }
    expect(verifyReplay(1, transcript, 2_000).survivalTicks).toBe(terminalTick)
    expect(() => verifyReplay(1, { ...transcript, endTick: terminalTick - 1 }, 2_000)).toThrow(
      "outcome",
    )
    expect(() => verifyReplay(1, { ...transcript, endTick: terminalTick + 1 }, 2_000)).toThrow(
      "outcome",
    )
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
