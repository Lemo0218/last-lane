import { describe, expect, it } from "vitest"

import { canvasMetrics, motionPulse } from "../../src/game/renderer"
import { soldierFormation, VISIBLE_SOLDIER_CAP } from "../../src/game/squad-renderer"

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

describe("soldier formation", () => {
  it("adds one visible silhouette when a troop gate grows a small squad", () => {
    // Given: a three-soldier formation before a troop gate
    const before = soldierFormation(3, 390)

    // When: the gate adds one troop
    const after = soldierFormation(4, 390)

    // Then: an additional individual soldier is visible
    expect(after.members).toHaveLength(before.members.length + 1)
    expect(after.overflow).toBe(0)
  })

  it("caps draw work while preserving an overflow count for large squads", () => {
    // Given: a squad larger than the renderer's visual budget
    // When: its responsive formation is calculated
    const formation = soldierFormation(VISIBLE_SOLDIER_CAP + 9, 320)

    // Then: individual drawing stays capped and the remaining rank is represented
    expect(formation.members).toHaveLength(VISIBLE_SOLDIER_CAP)
    expect(formation.overflow).toBe(9)
    expect(Math.max(...formation.members.map((member) => Math.abs(member.x)))).toBeLessThan(130)
  })
})
