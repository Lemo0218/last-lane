import { describe, expect, it } from "vitest"

import { advanceFrame } from "../../src/game/frame-clock"

describe("frame clock", () => {
  it("caps catch-up work and drops excess accumulated time", () => {
    // Given: a frame delayed far beyond the fixed step
    // When: the running clock advances
    const result = advanceFrame({ previous: 0, accumulator: 0 }, 1_000, true)

    // Then: catch-up is capped and no backlog remains
    expect(result).toEqual({ clock: { previous: 1_000, accumulator: 0 }, steps: 8 })
  })

  it("resets hidden time without jumping when visibility resumes", () => {
    // Given: the page has accumulated partial visible time
    const beforeHide = { previous: 20, accumulator: 7 }

    // When: a hidden frame arrives much later
    const hidden = advanceFrame(beforeHide, 20_000, false)
    const resumed = advanceFrame(hidden.clock, 20_010, true)

    // Then: hidden time is discarded and only fresh visible time advances
    expect(hidden.steps).toBe(0)
    expect(resumed.steps).toBe(1)
  })
})
