import { describe, expect, it } from "vitest"
import { createSimulation, stepSimulation } from "../../src/game/simulation"
import type { UpgradeLevels } from "../../src/game/types"

const noUpgrades: UpgradeLevels = { troop: 0, damage: 0, fireRate: 0, recovery: 0 }

describe("simulation determinism", () => {
  it("Given equal states and input transcript When simulated Then full states remain deterministic", () => {
    const inputs = [1, 0, -1, 1, 1, 0, -1] as const
    let first = createSimulation(1234, noUpgrades, { spawnCooldownMs: 0 })
    let second = createSimulation(1234, noUpgrades, { spawnCooldownMs: 0 })

    for (const moveX of inputs) {
      first = stepSimulation(first, { moveX, paused: false })
      second = stepSimulation(second, { moveX, paused: false })
    }

    expect(first).toEqual(second)
    expect(first.seed).toBe(second.seed)
    expect(first.events).toEqual(second.events)
  })
})
