import { describe, expect, it } from "vitest"
import { RANKED_RUN_LIMIT_MS, STEP_MS } from "../../src/game/config"
import type { SimulationInput } from "../../src/game/types"
import { createWaveRuntime } from "../../src/game/wave-runtime"
import { replayWitness } from "../../src/game/waves"

const runUntilStopped = (
  inputAt: (runtime: ReturnType<typeof createWaveRuntime>) => SimulationInput,
): number => {
  let runtime = createWaveRuntime(undefined, 0, 17)
  for (let elapsedMs = 0; elapsedMs < RANKED_RUN_LIMIT_MS; elapsedMs += STEP_MS) {
    runtime = runtime.step(inputAt(runtime))
    if (runtime.active.production.simulation.status !== "running") return elapsedMs + STEP_MS
  }
  return RANKED_RUN_LIMIT_MS
}

describe("production difficulty tuning", () => {
  it("keeps a conservative neutral fixture alive for three to three-and-a-half minutes", () => {
    // Given: a deterministic conservative player who holds the middle lane
    // When: production waves run until the squad is defeated
    const survivedMs = runUntilStopped((runtime) => {
      const witnessIndex = Math.floor(runtime.active.production.atMs / STEP_MS)
      if (runtime.active.elapsedBeforeMs >= 84_000) return { moveX: 0, paused: false }
      return runtime.active.witness.productionInputs[witnessIndex] ?? { moveX: 0, paused: false }
    })

    // Then: the baseline run lands in the intended median-survival envelope
    expect(survivedMs).toBeGreaterThanOrEqual(150_000)
    expect(survivedMs).toBeLessThanOrEqual(210_000)
  })

  it("keeps an expert witness alive beyond five minutes", () => {
    // Given: the accepted solver witness for each production wave
    // When: the witness inputs are replayed continuously
    const survivedMs = runUntilStopped((runtime) => {
      const witnessIndex = Math.floor(runtime.active.production.atMs / STEP_MS)
      return runtime.active.witness.productionInputs[witnessIndex] ?? { moveX: 0, paused: false }
    })

    // Then: skilled deterministic play exceeds the upper target duration
    expect(survivedMs).toBeGreaterThan(300_000)
  })

  it("accepts only segments whose exact production witness remains solvable", () => {
    // Given: sixty consecutive production decisions spanning the ranked limit
    let runtime = createWaveRuntime(undefined, 0, 17)

    // When: each accepted segment is checked and advanced with its witness
    for (let index = 0; index < 60; index += 1) {
      const active = runtime.active
      if (!active.usedFallback) {
        const entry = {
          squad: active.production.simulation.squad,
          upgrades: {
            troop: Math.max(0, active.production.simulation.maximumSquad - 3),
            damage: Math.max(0, Math.floor((active.production.simulation.shotDamage - 10) / 5)),
            fireRate: Math.max(
              0,
              Math.floor((1000 - active.production.simulation.fireIntervalMs) / 200),
            ),
            recovery: active.production.simulation.recoveryAmount,
          },
          x: active.production.simulation.playerX,
          velocity: active.production.simulation.playerVelocity,
          playfieldWidth: 1000,
          playerRadius: 12,
          blockerRadius: 12,
          precedingSegments: [],
        }
        expect(replayWitness(entry, active.segment, active.witness).survived).toBe(true)
      }
      const startingWave = runtime.active.index
      while (
        runtime.active.index === startingWave &&
        runtime.active.production.simulation.status === "running"
      ) {
        const witnessIndex = Math.floor(runtime.active.production.atMs / STEP_MS)
        runtime = runtime.step(
          runtime.active.witness.productionInputs[witnessIndex] ?? { moveX: 0, paused: false },
        )
      }
    }
  })
})
