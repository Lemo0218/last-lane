import { expect, it } from "vitest"

import { solveWave } from "./solver"
import type { EntryState, WaveSegment } from "./waves"

const state: EntryState = {
  squad: 10,
  upgrades: { troop: 3, damage: 3, fireRate: 3, recovery: 3 },
  x: 500,
  velocity: 0,
  playfieldWidth: 1_000,
  playerRadius: 4,
  blockerRadius: 4,
  precedingSegments: [],
}

const worstSegment = (horizonMs: 6_000 | 12_000): WaveSegment => {
  const blockers = Array.from({ length: horizonMs / 100 }, (_, index) => ({
    fromMs: index * 100,
    toMs: index * 100 + 100,
    minX: index % 2 === 0 ? 0 : 550,
    maxX: index % 2 === 0 ? 450 : 1_000,
    damage: 1,
  }))
  return { id: "worst", horizonMs, blockers, gates: [] }
}

it.each([
  6_000, 12_000,
] as const)("uses the exact four millisecond solver budget for the %ims worst case", (horizonMs) => {
  const segment = worstSegment(horizonMs)
  let fakeNow = 0
  const deterministic = solveWave(state, segment, {
    clock: { now: () => (fakeNow += 0.01) },
  })
  expect(deterministic.kind).toBe("fallback")
  expect(deterministic.elapsedMs).toBeLessThanOrEqual(4)
})

it.skip.each([
  6_000, 12_000,
] as const)("diagnoses p95 wall time for the %ims worst case", (horizonMs) => {
  const segment = worstSegment(horizonMs)
  for (let warmup = 0; warmup < 5; warmup += 1) solveWave(state, segment)
  const samples = Array.from({ length: 25 }, () => {
    const startedAt = performance.now()
    solveWave(state, segment)
    return performance.now() - startedAt
  }).sort((left, right) => left - right)
  expect(samples[23]).toBeLessThanOrEqual(4)
})
