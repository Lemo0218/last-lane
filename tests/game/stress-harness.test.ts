import { describe, expect, it } from "vitest"
import { createSimulation } from "../../src/game/simulation"
import { createStressFrame } from "../../src/game/stress-harness"

describe("development stress frame", () => {
  it("keeps exactly maximum entities and effects through the production step path", () => {
    // Given: a normal production simulation promoted to stress capacity
    const stress = createStressFrame(
      createSimulation(1, { troop: 0, damage: 0, fireRate: 0, recovery: 0 }),
    )

    // When: the harness advances through the production simulation adapter
    const next = stress.step()

    // Then: functional state is retained while raw render loads stay at their real caps
    expect(
      next.state.zombies.length + next.state.projectiles.length + next.state.gates.length,
    ).toBe(128)
    expect(next.effects).toHaveLength(32)
    expect(next.state.status).toBe("running")
    expect(next.state.elapsedMs).toBe(10)
  })
})
