import { describe, expect, it } from "vitest"
import { createProductionWaveState, stepProductionWave } from "../../src/game/production-wave"
import { type SolverResult, solveWave } from "../../src/game/solver"
import { createWaveRuntime, type WaveRuntimeDependencies } from "../../src/game/wave-runtime"
import {
  type EntryState,
  replayWitness,
  type WaveSegment,
  type WaveWitness,
} from "../../src/game/waves"

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
  it("aborts corridor expansion inside the shared four millisecond deadline", () => {
    // Given: a clock that consumes one millisecond per corridor check
    let now = 0
    const entry: EntryState = {
      squad: 1,
      upgrades: { troop: 0, damage: 0, fireRate: 0, recovery: 0 },
      x: 500,
      velocity: 0,
      playfieldWidth: 1_000,
      playerRadius: 12,
      blockerRadius: 12,
      precedingSegments: [],
    }
    const worst: WaveSegment = {
      id: "wave-1",
      horizonMs: 12_000,
      blockers: Array.from({ length: 120 }, (_, index) => ({
        fromMs: index * 100,
        toMs: index * 100 + 100,
        minX: index % 2 === 0 ? 0 : 550,
        maxX: index % 2 === 0 ? 450 : 1_000,
        damage: 1,
      })),
      gates: [],
    }

    // When: corridor expansion reaches the injected deadline
    const result = solveWave(entry, worst, { clock: { now: () => (now += 1) } })

    // Then: it immediately selects the compatible fallback within total budget
    expect(result.kind).toBe("fallback")
    expect(result.elapsedMs).toBeLessThanOrEqual(4)
    expect(now).toBeLessThanOrEqual(5)
  })
  it("returns production-replayed combat fallback when the four millisecond solver times out", () => {
    // Given: a fifth-wave candidate and a clock already at its deadline
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
    const rejected: WaveSegment = {
      id: "boss-5",
      horizonMs: 12_000,
      blockers: [],
      gates: [],
    }

    // When: the default-shaped solver is forced to time out
    const result = solveWave(entry, rejected, { budgetMs: 0, clock: { now: () => 0 } })

    // Then: fallback retains boss combat, a visible gate, and a valid production replay
    expect(result.kind).toBe("fallback")
    expect(result.segment.id).toBe("fallback-boss-5")
    expect(result.segment.blockers).toHaveLength(1)
    expect(result.segment.gates).toHaveLength(1)
    expect(replayWitness(entry, result.segment, result.witness).survived).toBe(true)
  })
  it("collects a swept gate during a forgiving approach window and preserves feedback", () => {
    // Given: a gate scheduled between fixed production ticks
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
    const gated: WaveSegment = {
      id: "wave-gate",
      horizonMs: 6_000,
      blockers: [],
      gates: [{ id: "g1", atMs: 15, x: 500, radius: 30, kind: "damage", level: 1 }],
    }

    // When: production advances across the scheduled gate time
    let production = createProductionWaveState(entry)
    production = stepProductionWave(entry, gated, production, { moveX: 0, paused: false })
    const feedback = production.simulation.events
    production = stepProductionWave(entry, gated, production, { moveX: 0, paused: false })

    // Then: collection is forgiving and its event survives the adapter
    expect([...production.collectedGateIds]).toEqual(["g1"])
    expect(feedback).toContainEqual({
      kind: "gate-collected",
      gateKind: "damage",
      level: 1,
    })
  })
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
