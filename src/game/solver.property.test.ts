import fc from "fast-check"
import { expect, it } from "vitest"

import { solveWave } from "./solver"
import type { EntryState, WaveSegment } from "./waves"
import { replayWitness } from "./waves"

it("returns an accepted replay witness for varied exact legal entry states", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: -20, max: 20 }),
      (squad, x, velocity) => {
        const state: EntryState = {
          squad,
          upgrades: { troop: 0, damage: 0, fireRate: 0, recovery: 0 },
          x,
          velocity,
          playfieldWidth: 100,
          playerRadius: 2,
          blockerRadius: 2,
          precedingSegments: [],
        }
        const segment: WaveSegment = { id: "open", horizonMs: 6_000, blockers: [], gates: [] }
        const result = solveWave(state, segment)
        expect(result.kind).toBe("accepted")
        if (result.kind === "accepted") {
          expect(replayWitness(state, segment, result.witness).survived).toBe(true)
        }
      },
    ),
  )
})

it("composes recovery choice, entrance, and boss with one surviving offered choice", () => {
  const state: EntryState = {
    squad: 2,
    upgrades: { troop: 0, damage: 0, fireRate: 0, recovery: 0 },
    x: 50,
    velocity: 0,
    playfieldWidth: 100,
    playerRadius: 3,
    blockerRadius: 3,
    precedingSegments: [],
  }
  const composed: WaveSegment = {
    id: "composed-boss",
    horizonMs: 12_000,
    blockers: [{ fromMs: 4_000, toMs: 8_000, minX: 0, maxX: 42, damage: 2 }],
    gates: [
      { id: "recover", atMs: 1_000, x: 75, radius: 8, kind: "recovery", level: 2 },
      { id: "reward", atMs: 1_000, x: 25, radius: 8, kind: "damage", level: 2 },
    ],
  }
  expect(solveWave(state, composed).kind).toBe("accepted")
})
