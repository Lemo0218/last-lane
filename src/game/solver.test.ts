import { describe, expect, it } from "vitest"

import { fallbackPatterns } from "./fallbacks"
import { solveWave, squadHealthBin } from "./solver"
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
  it("discretizes squad health into stable three-soldier bins", () => {
    expect([squadHealthBin(3), squadHealthBin(4), squadHealthBin(5)]).toEqual([1, 1, 1])
    expect(squadHealthBin(6)).toBe(2)
  })
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

  it("detects a blocker crossed between solver samples", () => {
    const segment: WaveSegment = {
      id: "swept",
      horizonMs: 6_000,
      blockers: [{ fromMs: 300, toMs: 400, minX: 45, maxX: 46, damage: 20 }],
      gates: [],
    }
    const result = solveWave(entry({ x: 40, velocity: 40 }), segment)
    if (result.kind === "accepted")
      expect(replayWitness(entry({ x: 40, velocity: 40 }), segment, result.witness).survived).toBe(
        true,
      )
  })

  it("holds production input neutral for exactly 250ms", () => {
    const result = solveWave(entry(), { id: "open", horizonMs: 6_000, blockers: [], gates: [] })
    const witness = result.witness
    expect(witness.productionInputs.slice(0, 25).every((input) => input.moveX === 0)).toBe(true)
    expect(witness.productionInputs).toHaveLength(600)
  })

  it("falls back when the monotonic generation clock overruns", () => {
    let instant = 0
    const result = solveWave(
      entry(),
      { id: "open", horizonMs: 6_000, blockers: [], gates: [] },
      { clock: { now: () => (instant += 2) } },
    )
    expect(result.kind).toBe("fallback")
    expect(result.elapsedMs).toBeLessThanOrEqual(4)
  })

  it("requires a time-connected corridor rather than pointwise gaps", () => {
    const segment: WaveSegment = {
      id: "switching-gap",
      horizonMs: 6_000,
      blockers: [
        { fromMs: 0, toMs: 100, minX: 45, maxX: 100, damage: 1 },
        { fromMs: 100, toMs: 200, minX: 0, maxX: 55, damage: 1 },
      ],
      gates: [],
    }
    expect(solveWave(entry({ x: 10 }), segment).kind).toBe("fallback")
  })

  it("uses nonzero production velocity when deciding reachability", () => {
    const segment: WaveSegment = {
      id: "momentum",
      horizonMs: 6_000,
      blockers: [{ fromMs: 250, toMs: 500, minX: 0, maxX: 50, damage: 4 }],
      gates: [],
    }
    const clock = { now: () => 0 }
    expect(solveWave(entry({ x: 60, velocity: 500 }), segment, { clock }).kind).toBe("accepted")
    expect(solveWave(entry({ x: 60, velocity: -500 }), segment, { clock }).kind).toBe("fallback")
  })

  it("honors gate radii and preserves same-kind same-tick IDs", () => {
    const state = entry({ x: 50 })
    const segment: WaveSegment = {
      id: "gate-radius",
      horizonMs: 6_000,
      blockers: [],
      gates: [
        { id: "wide-a", atMs: 10, x: 70, radius: 25, kind: "recovery", level: 1 },
        { id: "wide-b", atMs: 10, x: 75, radius: 30, kind: "recovery", level: 1 },
        { id: "narrow", atMs: 10, x: 70, radius: 1, kind: "recovery", level: 1 },
      ],
    }
    const result = solveWave(state, segment, { clock: { now: () => 0 } })
    expect(result.witness.collectedGateIds).toEqual(["wide-a", "wide-b"])
  })

  it("selects the least-damaged witness among surviving policies", () => {
    const state = entry({ squad: 5, x: 50 })
    const segment: WaveSegment = {
      id: "damage-ranking",
      horizonMs: 6_000,
      blockers: [{ fromMs: 300, toMs: 310, minX: 0, maxX: 40, damage: 1 }],
      gates: [],
    }
    const result = solveWave(state, segment, { clock: { now: () => 0 } })
    expect(result.kind).toBe("accepted")
    expect(result.witness.finalSquad).toBe(5)
    expect(result.witness.frames[2]?.move).toBe(0)
  })

  it("chooses survival over a reward before a boss", () => {
    const segment: WaveSegment = {
      id: "boss",
      horizonMs: 12_000,
      blockers: [{ fromMs: 3_000, toMs: 12_000, minX: 40, maxX: 100, damage: 4 }],
      gates: [{ id: "reward", atMs: 1_500, x: 80, radius: 6, kind: "damage", level: 5 }],
    }
    const result = solveWave(entry(), segment, { clock: { now: () => 0 } })
    expect(result.kind).toBe("accepted")
    if (result.kind === "accepted") {
      expect(result.witness.finalSquad).toBeGreaterThanOrEqual(1)
      expect(result.witness.collectedGateIds).toHaveLength(0)
      expect(replayWitness(entry(), segment, result.witness).survived).toBe(true)
    }
  })

  it("fallbacks declare preconditions and replayable witnesses", () => {
    const state = entry()
    const eligible = fallbackPatterns.filter((pattern) => pattern.precondition(state))
    expect(eligible.length).toBeGreaterThan(0)
    for (const pattern of eligible) {
      const replay = replayWitness(state, pattern.segment(state), pattern.witness(state))
      expect(replay.survived).toBe(true)
      expect(replay.escapeCorridor).toBe(true)
      expect(() => JSON.stringify(pattern.bounds)).not.toThrow()
    }
  })

  it("rejects non-finite fallback entries at the machine-readable boundary", () => {
    expect(fallbackPatterns[0]?.precondition(entry({ velocity: Number.NaN }))).toBe(false)
    expect(fallbackPatterns[0]?.precondition(entry({ playerRadius: -1 }))).toBe(false)
    expect(fallbackPatterns[0]?.precondition(entry({ squad: 1.5 }))).toBe(false)
    expect(fallbackPatterns[0]?.precondition(entry({ playfieldWidth: 100.5 }))).toBe(false)
  })
})
