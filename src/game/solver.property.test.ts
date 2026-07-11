import fc from "fast-check"
import { expect, it } from "vitest"
import { fallbackPatterns } from "./fallbacks"
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
    { numRuns: 30 },
  )
})

it("production-replays every generated entry accepted by fallback preconditions", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 0, max: 1_000 }),
      fc.integer({ min: -40, max: 40 }),
      (squad, x, velocity) => {
        const state: EntryState = {
          squad,
          upgrades: { troop: 1, damage: 1, fireRate: 1, recovery: 1 },
          x,
          velocity,
          playfieldWidth: 1_000,
          playerRadius: 12,
          blockerRadius: 12,
          precedingSegments: [],
        }
        const pattern = fallbackPatterns[0]
        if (pattern?.precondition(state) !== true) return
        const witness = pattern.witness(state)
        const replay = replayWitness(state, pattern.segment(state), witness)
        expect(replay.survived).toBe(true)
        expect(replay.finalSquad).toBe(witness.finalSquad)
        expect(replay.finalX).toBe(witness.finalX)
        expect(replay.collectedGateIds).toEqual(witness.collectedGateIds)
      },
    ),
    { numRuns: 30 },
  )
})

it("retains the least-damaged witness across surviving constant policies", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 3, max: 20 }),
      fc.integer({ min: 1, max: 2 }),
      (squad, damage) => {
        const state: EntryState = {
          squad,
          upgrades: { troop: 0, damage: 0, fireRate: 0, recovery: 0 },
          x: 50,
          velocity: 0,
          playfieldWidth: 100,
          playerRadius: 3,
          blockerRadius: 3,
          precedingSegments: [],
        }
        const segment: WaveSegment = {
          id: "ranked",
          horizonMs: 6_000,
          blockers: [{ fromMs: 300, toMs: 310, minX: 0, maxX: 40, damage }],
          gates: [],
        }
        const result = solveWave(state, segment, { clock: { now: () => 0 } })
        expect(result.witness.finalSquad).toBe(squad)
      },
    ),
    { numRuns: 30 },
  )
})

it("composes recovery choice, entrance, and boss with one surviving offered choice", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 45, max: 60 }),
      fc.integer({ min: -2, max: 2 }),
      fc.integer({ min: 1, max: 4 }),
      fc.integer({ min: 75, max: 85 }),
      (squad, x, velocity, rewardLevel, bossReach) => {
        const state: EntryState = {
          squad,
          upgrades: { troop: 0, damage: rewardLevel, fireRate: 0, recovery: 0 },
          x,
          velocity,
          playfieldWidth: 100,
          playerRadius: 3,
          blockerRadius: 3,
          precedingSegments: [],
        }
        const composed: WaveSegment = {
          id: "composed-boss",
          horizonMs: 12_000,
          blockers: [{ fromMs: 4_000, toMs: 8_000, minX: 0, maxX: bossReach, damage: squad }],
          gates: [
            { id: "recover", atMs: 1_000, x: 100, radius: 8, kind: "recovery", level: rewardLevel },
            { id: "reward", atMs: 1_000, x: 0, radius: 8, kind: "damage", level: rewardLevel },
          ],
        }
        const result = solveWave(state, composed, { clock: { now: () => 0 } })
        expect(result.kind).toBe("accepted")
        if (result.kind === "accepted") {
          const replay = replayWitness(state, composed, result.witness)
          expect(replay.survived).toBe(true)
          expect(replay.collectedGateIds).toContain("recover")
        }
      },
    ),
    { numRuns: 30 },
  )
})
