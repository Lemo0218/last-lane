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

it.each([
  6_000, 12_000,
] as const)("solves the %ims worst case or activates fallback within budget", (horizonMs) => {
  const blockers = Array.from({ length: horizonMs / 100 }, (_, index) => ({
    fromMs: index * 100,
    toMs: index * 100 + 100,
    minX: index % 2 === 0 ? 0 : 550,
    maxX: index % 2 === 0 ? 450 : 1_000,
    damage: 1,
  }))
  blockers[0] = { fromMs: 0, toMs: 100, minX: 0, maxX: 1_000, damage: 1 }
  const segment: WaveSegment = { id: "worst", horizonMs, blockers, gates: [] }
  const result = solveWave(state, segment, { budgetMs: 4 })
  expect(result.elapsedMs).toBeLessThanOrEqual(4)
  expect(result.kind).toBe("fallback")
})
