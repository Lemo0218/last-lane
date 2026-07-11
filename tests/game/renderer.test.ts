import { describe, expect, it } from "vitest"

import { canvasMetrics } from "../../src/game/renderer"

describe("canvas metrics", () => {
  it("caps device pixel ratio while preserving CSS size", () => {
    // Given: a high-density portrait viewport
    // When: backing-store metrics are calculated
    // Then: resolution is capped without changing layout dimensions
    expect(canvasMetrics(390, 700, 3)).toEqual({
      cssWidth: 390,
      cssHeight: 700,
      width: 780,
      height: 1400,
      dpr: 2,
    })
  })
})
