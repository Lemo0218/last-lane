import { describe, expect, it } from "vitest"

import { fallbackPatterns } from "./fallbacks"
import { solveWave } from "./solver"
import type { EntryState, WaveSegment } from "./waves"
import { replayWitness } from "./waves"

const entry = (overrides: Partial<EntryState> = {}): EntryState => ({
  squad: 3,
  upgrades: { troop: 0, damage: 0, fireRate: 0, recovery: 0 },
  x: 50,
  velocity: 0,
  playfieldWidth: 100,
  playerRadius: 3,
  blockerRadius: 3,
  precedingSegments: [],
  ...overrides,
})

describe("wave solver", () => {
  it("rejects a visually open lane that cannot be reached after reaction delay", () => {
    const segment: WaveSegment = {
      id: "unreachable",
      horizonMs: 6_000,
      blockers: [{ fromMs: 250, toMs: 1_200, minX: 0, maxX: 82, damage: 3 }],
      gates: [],
    }
    expect(solveWave(entry({ x: 10 }), segment).kind).toBe("fallback")
  })

  it("rejects full-field blocker closure", () => {
    const segment: WaveSegment = {
      id: "closed",
      horizonMs: 6_000,
      blockers: [{ fromMs: 500, toMs: 900, minX: 0, maxX: 100, damage: 1 }],
      gates: [],
    }
    expect(solveWave(entry(), segment).kind).toBe("fallback")
  })

  it("chooses survival over a reward before a boss", () => {
    const segment: WaveSegment = {
      id: "boss",
      horizonMs: 12_000,
      blockers: [{ fromMs: 3_000, toMs: 12_000, minX: 40, maxX: 100, damage: 4 }],
      gates: [{ id: "reward", atMs: 1_500, x: 80, radius: 6, kind: "damage", level: 5 }],
    }
    const result = solveWave(entry(), segment)
    expect(result.kind).toBe("accepted")
    if (result.kind === "accepted") {
      expect(result.witness.finalSquad).toBeGreaterThanOrEqual(1)
      expect(result.witness.collectedGateIds).toHaveLength(0)
      expect(replayWitness(entry(), segment, result.witness).survived).toBe(true)
    }
  })

  it("fallbacks declare preconditions and replayable witnesses", () => {
    const state = entry()
    for (const pattern of fallbackPatterns) {
      expect(pattern.precondition(state)).toBe(true)
      const replay = replayWitness(state, pattern.segment(state), pattern.witness(state))
      expect(replay.survived).toBe(true)
      expect(replay.escapeCorridor).toBe(true)
    }
  })
})
