import { describe, expect, it } from "vitest"

import { movementForKey, quantizeHorizontal } from "../../src/game/input"

describe("game input", () => {
  it("quantizes pointer drag into left neutral and right lanes", () => {
    // Given: a centered pointer origin
    // When: the pointer crosses the drag thresholds
    // Then: movement is constrained to the simulation input domain
    expect([-30, -8, 0, 8, 30].map((x) => quantizeHorizontal(x, 0))).toEqual([-1, 0, 0, 0, 1])
  })

  it("maps Korean-friendly keyboard controls", () => {
    // Given: arrow and A/D keys
    // When: a key is interpreted
    // Then: only horizontal controls produce movement
    expect(["ArrowLeft", "a", "ArrowRight", "D", "Space"].map(movementForKey)).toEqual([
      -1, -1, 1, 1, 0,
    ])
  })
})
