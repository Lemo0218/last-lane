import { describe, expect, it } from "vitest"
import { createFramePerformance } from "../../src/game/frame-performance"

describe("frame performance telemetry", () => {
  it("reports p95 work and bounded high-water marks", () => {
    // Given: deterministic frame work samples and bounded pools
    const metrics = createFramePerformance()

    // When: enough frames are observed to include a slow tail
    for (let index = 1; index <= 100; index += 1)
      metrics.record(index / 10, 100 + index, index, index === 100 ? 51 : index / 3)

    // Then: p95 uses the nearest-rank sample and caps retain their high-water marks
    expect(metrics.snapshot()).toEqual({
      p95WorkMs: 9.5,
      p95IntervalMs: 31.666666666666668,
      longFrames: 1,
      maxEntities: 200,
      maxEffects: 100,
    })
  })
})
