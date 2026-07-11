import fc from "fast-check"
import { expect, it } from "vitest"

import { solveWave } from "./solver"
import type { EntryState, WaveSegment } from "./waves"
import { replayWitness } from "./waves"

it("returns an accepted replay witness for varied exact legal entry states", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 50, max: 500 }),
      fc.integer({ min: 0, max: 500 }),
      fc.integer({ min: 0, max: 10 }),
      fc.integer({ min: -20, max: 20 }),
      fc.integer({ min: 0, max: 4 }),
      fc.integer({ min: 0, max: 4 }),
      fc.integer({ min: 0, max: 2 }),
      fc.boolean(),
      (squad, width, xSeed, radius, velocity, troop, recovery, precedingCount, obstructed) => {
        const x = xSeed % (width + 1)
        const preceding = [
          { id: "older", exitX: x - 1, exitVelocity: 0, survived: true },
          { id: "latest", exitX: x, exitVelocity: velocity, survived: true },
        ]
        const state: EntryState = {
          squad,
          upgrades: { troop, damage: troop, fireRate: recovery, recovery },
          x,
          velocity,
          playfieldWidth: width,
          playerRadius: radius,
          blockerRadius: radius,
          precedingSegments: preceding.slice(2 - precedingCount),
        }
        const segment: WaveSegment = {
          id: "varied",
          horizonMs: 6_000,
          blockers: obstructed
            ? [{ fromMs: 2_000, toMs: 2_100, minX: 0, maxX: width / 4, damage: 1 }]
            : [],
          gates: [{ id: "choice", atMs: 1_000, x, radius: radius + 1, kind: "recovery", level: 1 }],
        }
        const result = solveWave(state, segment, { clock: { now: () => 0 } })
        expect(result.kind).toBe("accepted")
        if (result.kind === "accepted") {
          const replay = replayWitness(state, segment, result.witness)
          expect(replay.survived).toBe(true)
          expect(result.witness.productionInputs).toHaveLength(600)
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
    blockers: [{ fromMs: 4_000, toMs: 8_000, minX: 0, maxX: 44, damage: 2 }],
    gates: [
      { id: "recover", atMs: 1_000, x: 100, radius: 8, kind: "recovery", level: 2 },
      { id: "reward", atMs: 1_000, x: 0, radius: 8, kind: "damage", level: 2 },
    ],
  }
  const result = solveWave(state, composed, { clock: { now: () => 0 } })
  expect(result.kind).toBe("accepted")
  if (result.kind === "accepted") {
    const replay = replayWitness(state, composed, result.witness)
    expect(replay.survived).toBe(true)
    expect(replay.collectedGateIds).toContain("recover")
  }
})
