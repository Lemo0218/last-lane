import { describe, expect, it } from "vitest"
import { scoreForCombat } from "../../src/game/GameCanvas"
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
  it("kills a materialized basic zombie through real projectile collisions", () => {
    // Given: a basic wave with a reachable blocker enemy
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
      id: "wave-1",
      horizonMs: 6_000,
      blockers: [{ fromMs: 10, toMs: 10, minX: 680, maxX: 720, damage: 1 }],
      gates: [],
    }

    // When: production advances through auto-fire collision
    let production = createProductionWaveState(entry)
    let killed = false
    for (let step = 0; step < 100; step += 1) {
      production = stepProductionWave(entry, combat, production, { moveX: 0, paused: false })
      killed ||= production.simulation.events.some((event) => event.kind === "zombie-killed")
    }

    // Then: the real zombie is removed and a kill event was emitted
    expect(killed).toBe(true)
    expect(production.simulation.zombies).toHaveLength(0)
    expect(scoreForCombat(production.simulation, 1)).toBeGreaterThan(
      scoreForCombat(production.simulation, 0),
    )
  })

  it("allows a moving squad to kill a deterministic boss with the same combat rules", () => {
    // Given: a fifth-wave boss at production combat distance
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
    const boss: WaveSegment = {
      id: "boss-5",
      horizonMs: 12_000,
      blockers: [{ fromMs: 10, toMs: 10, minX: 880, maxX: 920, damage: 2 }],
      gates: [],
    }

    // When: the squad retreats while auto-fire resolves the boss
    let production = createProductionWaveState(entry)
    let bossKilled = false
    for (let step = 0; step < 500; step += 1) {
      production = stepProductionWave(entry, boss, production, { moveX: -1, paused: false })
      bossKilled ||= production.simulation.events.some(
        (event) => event.kind === "zombie-killed" && event.zombieKind === "boss",
      )
    }

    // Then: boss death is reached without injecting a fake event
    expect(bossKilled).toBe(true)
    expect(production.simulation.squad).toBeGreaterThan(0)
  })
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
