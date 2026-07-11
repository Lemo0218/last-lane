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
      fc.integer({ min: 0, max: 10 }),
      fc.integer({ min: -20, max: 20 }),
      fc.integer({ min: 0, max: 4 }),
      fc.integer({ min: 0, max: 4 }),
      (squad, width, radius, velocity, troop, recovery) => {
        const x = Math.floor(width / 2)
        const state: EntryState = {
          squad,
          upgrades: { troop, damage: troop, fireRate: recovery, recovery },
          x,
          velocity,
          playfieldWidth: width,
          playerRadius: radius,
          blockerRadius: radius,
          precedingSegments: [
            { id: "older", exitX: x - 1, exitVelocity: 0, survived: true },
            { id: "latest", exitX: x, exitVelocity: velocity, survived: true },
          ],
        }
        const segment: WaveSegment = {
          id: "varied",
          horizonMs: 6_000,
          blockers: [],
          gates: [{ id: "choice", atMs: 1_000, x, radius: radius + 1, kind: "recovery", level: 1 }],
        }
        const result = solveWave(state, segment)
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
      { id: "recover", atMs: 1_000, x: 75, radius: 8, kind: "recovery", level: 2 },
      { id: "reward", atMs: 1_000, x: 25, radius: 8, kind: "damage", level: 2 },
    ],
  }
  const result = solveWave(state, composed)
  expect(result.kind).toBe("accepted")
  if (result.kind === "accepted") {
    const replay = replayWitness(state, composed, result.witness)
    expect(replay.survived).toBe(true)
    expect(replay.collectedGateIds).toContain("recover")
  }
})
