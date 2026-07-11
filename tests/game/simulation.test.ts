import { describe, expect, it } from "vitest"
import { difficultyAt, MAX_ENTITIES, STEP_MS } from "../../src/game/config"
import { createSimulation, stepSimulation } from "../../src/game/simulation"
import type { SimulationState, UpgradeLevels } from "../../src/game/types"
import { position, score, tick } from "../../src/game/types"

const noUpgrades: UpgradeLevels = { troop: 0, damage: 0, fireRate: 0, recovery: 0 }

const step = (state: SimulationState, moveX: -1 | 0 | 1 = 0) =>
  stepSimulation(state, { moveX, paused: false })

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
    const decayed = stepSimulation(
      { ...incremented, comboExpiresMs: incremented.elapsedMs },
      { moveX: 0, paused: false },
    )

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

  it("Given zero squad at entry When stepped Then game over precedes recovery", () => {
    const state = createSimulation(
      1,
      { ...noUpgrades, recovery: 3 },
      { squad: 0, recoveryCooldownMs: 0 },
    )

    const result = step(state)

    expect(result.status).toBe("game-over")
    expect(result.squad).toBe(0)
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

  it("Given invalid movement When stepped Then rejects non-quantized input", () => {
    const state = createSimulation(1, noUpgrades)

    expect(() =>
      Reflect.apply(stepSimulation, undefined, [state, { moveX: 0.5, paused: false }]),
    ).toThrow()
  })

  it("Given semantic values When constructed Then reject fractional and unsafe units", () => {
    expect(tick(3)).toBe(3)
    expect(position(10)).toBe(10)
    expect(score(20)).toBe(20)
    expect(() => tick(1.5)).toThrow()
    expect(() => position(Number.MAX_SAFE_INTEGER + 1)).toThrow()
    expect(() => createSimulation(1, noUpgrades, { playerX: 1.5 })).toThrow()
  })

  it("Given upgrade gates When combat advances Then they alter real transitions and events", () => {
    const upgraded = createSimulation(
      1,
      { troop: 2, damage: 2, fireRate: 2, recovery: 2 },
      {
        squad: 3,
        recoveryCooldownMs: 0,
        zombies: [{ id: 1, kind: "basic", x: 500, hp: 20, damage: 1 }],
      },
    )

    const result = step(upgraded)

    expect(result.squad).toBe(5)
    expect(result.fireCooldownMs).toBe(600)
    expect(result.projectiles[0]?.damage).toBe(20)
    expect(result.events).toContainEqual({ kind: "squad-recovered", amount: 2 })
  })

  it("Given gate entities When player collides Then all gate kinds transition and emit events", () => {
    const state = createSimulation(1, noUpgrades, {
      gates: [
        { id: 1, kind: "troop", x: 0, level: 1 },
        { id: 2, kind: "damage", x: 0, level: 1 },
        { id: 3, kind: "fire-rate", x: 0, level: 1 },
        { id: 4, kind: "recovery", x: 0, level: 2 },
      ],
    })

    const result = step(state)

    expect(result.gates).toHaveLength(0)
    expect(result.maximumSquad).toBe(4)
    expect(result.shotDamage).toBe(15)
    expect(result.fireIntervalMs).toBe(800)
    expect(result.recoveryAmount).toBe(2)
    expect(result.events.filter((event) => event.kind === "gate-collected")).toHaveLength(4)
  })

  it("Given each due boss tier When stepped Then one boss and cadence event are emitted", () => {
    const state = createSimulation(1, noUpgrades, { elapsedMs: 59_984, spawnCooldownMs: 1000 })

    const result = step(state)

    expect(result.zombies.filter((zombie) => zombie.kind === "boss")).toHaveLength(1)
    expect(result.events.some((event) => event.kind === "boss-spawned")).toBe(true)
  })

  it.each([
    2, 4, 6,
  ])("Given due boss tier %s When crossed Then cadence emits exactly one boss", (tier) => {
    const state = createSimulation(1, noUpgrades, {
      elapsedMs: tier * 30_000 - STEP_MS,
      spawnCooldownMs: 1000,
    })

    const result = step(state)

    expect(result.zombies.filter((zombie) => zombie.kind === "boss")).toHaveLength(1)
    expect(result.events.filter((event) => event.kind === "boss-spawned")).toHaveLength(1)
  })

  it("Given mixed entities at cap When stepped Then firing and spawning preserve the cap", () => {
    const zombies = Array.from({ length: 59 }, (_, id) => ({
      id,
      kind: "basic" as const,
      x: 500,
      hp: 100,
      damage: 1,
    }))
    const projectiles = Array.from({ length: 59 }, (_, id) => ({ id: id + 100, x: 100, damage: 1 }))
    const gates = Array.from({ length: 10 }, (_, id) => ({
      id: id + 200,
      kind: "damage" as const,
      x: 500,
      level: 1,
    }))
    const state = createSimulation(1, noUpgrades, {
      zombies,
      projectiles,
      gates,
      spawnCooldownMs: 0,
    })

    const result = step(state)

    expect(
      result.zombies.length + result.projectiles.length + result.gates.length,
    ).toBeLessThanOrEqual(MAX_ENTITIES)
  })
})
