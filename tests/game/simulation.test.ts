import { describe, expect, it } from "vitest"
import { difficultyAt, MAX_ENTITIES, STEP_MS } from "../../src/game/config"
import { createSimulation, stepSimulation } from "../../src/game/simulation"
import type { SimulationState, UpgradeLevels } from "../../src/game/types"

const noUpgrades: UpgradeLevels = { troop: 0, damage: 0, fireRate: 0, recovery: 0 }

const step = (state: SimulationState, moveX = 0) => stepSimulation(state, { moveX, paused: false })

describe("combat simulation", () => {
  it("Given movement input When fixed step runs Then player remains in bounds", () => {
    let state = createSimulation(1, noUpgrades, { spawnCooldownMs: 100_000 })
    for (let index = 0; index < 500; index += 1) state = step(state, 1)

    expect(state.playerX).toBe(1000)
    expect(state.elapsedMs).toBe(500 * STEP_MS)
  })

  it("Given a target and ready weapon When stepped Then automatically fires", () => {
    const state = createSimulation(1, noUpgrades, {
      zombies: [{ id: 1, kind: "basic", x: 500, hp: 100, damage: 1 }],
    })

    const result = step(state)

    expect(result.events.some((event) => event.kind === "shot-fired")).toBe(true)
  })

  it("Given a colliding zombie When stepped Then squad takes zombie damage", () => {
    const state = createSimulation(1, noUpgrades, {
      zombies: [{ id: 1, kind: "basic", x: 0, hp: 100, damage: 2 }],
    })

    const result = step(state)

    expect(result.squad).toBe(1)
  })

  it("Given upgrade levels When created Then troop damage fire-rate and recovery gates apply", () => {
    const state = createSimulation(1, { troop: 2, damage: 3, fireRate: 2, recovery: 1 })

    expect(state.squad).toBe(5)
    expect(state.shotDamage).toBe(25)
    expect(state.fireIntervalMs).toBe(600)
    expect(state.recoveryEveryMs).toBe(10_000)
  })

  it("Given elapsed time When tiers are queried Then difficulty rises each 30 seconds and bosses recur", () => {
    expect(difficultyAt(29_999)).toMatchObject({ tier: 0, bossDue: false })
    expect(difficultyAt(30_000)).toMatchObject({ tier: 1, bossDue: false })
    expect(difficultyAt(60_000)).toMatchObject({ tier: 2, bossDue: true })
    expect(difficultyAt(120_000)).toMatchObject({ tier: 4, bossDue: true })
  })

  it("Given successive kills When time remains in window Then combo increments and later decays", () => {
    const state = createSimulation(1, noUpgrades, {
      combo: 2,
      comboExpiresMs: 1000,
      zombies: [{ id: 1, kind: "basic", x: 40, hp: 10, damage: 1 }],
      projectiles: [{ id: 2, x: 0, damage: 10 }],
      fireCooldownMs: 1000,
    })

    const incremented = step(state)
    const decayed = stepSimulation(incremented, { moveX: 0, paused: false }, 3000)

    expect(incremented.combo).toBe(3)
    expect(decayed.combo).toBe(0)
  })

  it("Given the last squad member is hit When stepped Then run is game over", () => {
    const state = createSimulation(1, noUpgrades, {
      squad: 1,
      zombies: [{ id: 1, kind: "basic", x: 0, hp: 100, damage: 1 }],
    })

    const result = step(state)

    expect(result.status).toBe("game-over")
  })

  it("Given entity cap reached When stepped Then no additional entity is spawned", () => {
    const zombies = Array.from({ length: MAX_ENTITIES }, (_, id) => ({
      id,
      kind: "basic" as const,
      x: 2000,
      hp: 100,
      damage: 1,
    }))
    const state = createSimulation(1, noUpgrades, { zombies, spawnCooldownMs: 0 })

    const result = step(state)

    expect(result.zombies.length + result.projectiles.length).toBeLessThanOrEqual(MAX_ENTITIES)
  })

  it("Given pause input When stepped Then simulation is unchanged", () => {
    const state = createSimulation(1, noUpgrades)

    const result = stepSimulation(state, { moveX: 1, paused: true })

    expect(result).toBe(state)
  })

  it("Given run duration reached When stepped Then run completes", () => {
    const state = createSimulation(1, noUpgrades, { elapsedMs: 179_984 })

    const result = step(state)

    expect(result.status).toBe("complete")
  })
})
