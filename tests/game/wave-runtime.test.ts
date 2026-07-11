import { describe, expect, it } from "vitest"
import { createProductionWaveState, stepProductionWave } from "../../src/game/production-wave"
import type { SolverResult } from "../../src/game/solver"
import { createWaveRuntime, type WaveRuntimeDependencies } from "../../src/game/wave-runtime"
import type { EntryState, WaveSegment, WaveWitness } from "../../src/game/waves"

const segment: WaveSegment = { id: "accepted", horizonMs: 6_000, blockers: [], gates: [] }
const witness: WaveWitness = {
  frames: [],
  productionInputs: [],
  finalSquad: 3,
  finalX: 500,
  finalVelocity: 0,
  collectedGateIds: [],
}

describe("wave runtime", () => {
  it("materializes blockers as deterministic zombies that trigger auto-fire", () => {
    // Given: a production segment whose blocker activates on the first tick
    const entry: EntryState = {
      squad: 3,
      upgrades: { troop: 0, damage: 0, fireRate: 0, recovery: 0 },
      x: 500,
      velocity: 0,
      playfieldWidth: 1000,
      playerRadius: 12,
      blockerRadius: 12,
      precedingSegments: [],
    }
    const combat: WaveSegment = {
      id: "wave-2",
      horizonMs: 6_000,
      blockers: [{ fromMs: 10, toMs: 100, minX: 680, maxX: 720, damage: 1 }],
      gates: [],
    }

    // When: production crosses the blocker activation time
    const stepped = stepProductionWave(entry, combat, createProductionWaveState(entry), {
      moveX: 0,
      paused: false,
    })

    // Then: a real elite zombie and projectile exist in the simulation
    expect(stepped.simulation.zombies).toMatchObject([{ kind: "elite" }])
    expect(stepped.simulation.projectiles).toHaveLength(1)
  })
  it("solves candidates with the exact entry state and applies an accepted segment", () => {
    // Given: an injected candidate generator and accepting solver
    const entries: EntryState[] = []
    const dependencies: WaveRuntimeDependencies = {
      candidate: () => segment,
      solve: (entry): SolverResult => {
        entries.push(entry)
        return { kind: "accepted", segment, witness, elapsedMs: 0 }
      },
    }

    // When: the production runtime is created
    const runtime = createWaveRuntime(dependencies)

    // Then: the solver receives the production entry and its segment becomes active
    expect(entries[0]).toMatchObject({ x: 500, velocity: 0, squad: 3, precedingSegments: [] })
    expect(runtime.active.segment.id).toBe("accepted")
  })

  it("applies the solver fallback instead of the rejected candidate", () => {
    // Given: a solver that returns a fallback segment
    const fallback = { ...segment, id: "fallback" }
    const dependencies: WaveRuntimeDependencies = {
      candidate: () => ({ ...segment, id: "rejected" }),
      solve: (_entry, rejected): SolverResult => ({
        kind: "fallback",
        rejectedSegment: rejected,
        segment: fallback,
        witness,
        patternId: "safe",
        elapsedMs: 0,
      }),
    }

    // When: the runtime activates its first segment
    const runtime = createWaveRuntime(dependencies)

    // Then: production drives the fallback returned by the solver
    expect(runtime.active.segment.id).toBe("fallback")
  })
})
