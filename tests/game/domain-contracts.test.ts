import { describe, expect, it } from "vitest"
import { MAX_ENTITIES, STEP_MS } from "../../src/game/config"
import { scoreRun } from "../../src/game/scoring"
import { createSimulation, stepSimulation } from "../../src/game/simulation"
import type { UpgradeLevels } from "../../src/game/types"
import { position, score, tick, velocity } from "../../src/game/types"

const noUpgrades: UpgradeLevels = { troop: 0, damage: 0, fireRate: 0, recovery: 0 }

describe("opaque domain contracts", () => {
  it.each([
    -1, 0x1_0000_0000,
  ])("Given invalid seed %s When created Then rejects uint32 overflow", (seed) => {
    expect(() => createSimulation(seed, noUpgrades)).toThrow()
    expect(() => createSimulation(1, noUpgrades, { seed })).toThrow()
  })
  it.each([
    -1,
    0,
    1.5,
    STEP_MS * 2,
  ])("Given delta %s When simulation steps Then rejects anything except one fixed tick", (deltaMs) => {
    const state = createSimulation(1, noUpgrades)

    expect(() =>
      Reflect.apply(stepSimulation, undefined, [state, { moveX: 0, paused: false }, deltaMs]),
    ).toThrow()
  })

  it("Given fatal collision and ready recovery When stepped Then remains game over", () => {
    const state = createSimulation(
      1,
      { ...noUpgrades, recovery: 3 },
      {
        squad: 1,
        recoveryCooldownMs: 0,
        zombies: [{ id: 1, kind: "basic", x: 0, hp: 100, damage: 1 }],
      },
    )

    const result = stepSimulation(state, { moveX: 0, paused: false })

    expect(result.status).toBe("game-over")
    expect(result.squad).toBe(0)
  })

  it("Given an oversized initial entity set When created Then rejects it", () => {
    const zombies = Array.from({ length: MAX_ENTITIES + 1 }, (_, id) => ({
      id,
      kind: "basic" as const,
      x: 500,
      hp: 100,
      damage: 1,
    }))

    expect(() => createSimulation(1, noUpgrades, { zombies })).toThrow()
  })

  it("Given a simulation When inspected Then state and entities carry opaque units", () => {
    const state = createSimulation(1, noUpgrades, {
      zombies: [{ id: 1, kind: "basic", x: 500, hp: 100, damage: 1 }],
    })

    expect(state.elapsedMs).toEqual(tick(0))
    expect(state.playerX).toEqual(position(0))
    expect(state.playerVelocity).toEqual(velocity(0))
    expect(state.zombies[0]?.x).toEqual(position(500))
  })

  it("Given scoring metrics When scored Then inputs and outputs use opaque score units", () => {
    const result = Reflect.apply(scoreRun, undefined, [
      {
        distance: position(100),
        basicKills: score(1),
        eliteKills: score(1),
        bosses: score(1),
        closeCalls: score(1),
        survivedMs: tick(30_000),
      },
    ])

    expect(result.total).toEqual(score(1751))
  })

  it("Given an unknown gate variant When collected Then exhaustive matching throws", () => {
    const state = createSimulation(1, noUpgrades, {
      gates: [{ id: 1, kind: "damage", x: 0, level: 1 }],
    })
    const invalidGate = { ...state.gates[0], kind: "unknown" }

    expect(() =>
      Reflect.apply(stepSimulation, undefined, [
        { ...state, gates: [invalidGate] },
        { moveX: 0, paused: false },
      ]),
    ).toThrow()
  })

  it.each([
    "troop",
    "damage",
    "fire-rate",
    "recovery",
  ] as const)("Given overflowing %s gate When collected Then rejects before producing state", (kind) => {
    const state = createSimulation(
      1,
      { troop: 1, damage: 1, fireRate: 1, recovery: 1 },
      {
        gates: [{ id: 1, kind, x: 0, level: Number.MAX_SAFE_INTEGER }],
      },
    )

    expect(() => stepSimulation(state, { moveX: 0, paused: false })).toThrow()
  })
})
