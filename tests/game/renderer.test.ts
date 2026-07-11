import { describe, expect, it } from "vitest"

import { canvasMetrics, motionPulse } from "../../src/game/renderer"

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

  it("freezes telegraph animation when reduced motion is requested", () => {
    // Given: two different animation timestamps
    // When: pulse values are computed with reduced motion enabled
    // Then: feedback remains stable instead of oscillating
    expect(motionPulse(0, true)).toBe(motionPulse(700, true))
    expect(motionPulse(0, false)).not.toBe(motionPulse(700, false))
  })
})
