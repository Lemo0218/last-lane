import { describe, expect, it } from "vitest"
import {
  basicKillScore,
  bossScore,
  closeCallScore,
  distanceScore,
  eliteScore,
  scoreRun,
  survivalMultiplierPermille,
} from "../../src/game/scoring"
import { position, score, tick } from "../../src/game/types"

describe("run scoring", () => {
  it("Given metrics When components are scored Then each source remains separate", () => {
    expect(distanceScore(12_345)).toBe(123)
    expect(basicKillScore(3)).toBe(300)
    expect(eliteScore(2)).toBe(500)
    expect(bossScore(1)).toBe(1000)
    expect(closeCallScore(4)).toBe(200)
  })

  it("Given longer survival When multiplier is calculated Then it increases", () => {
    expect(survivalMultiplierPermille(90_000)).toBeGreaterThan(survivalMultiplierPermille(30_000))
  })

  it("Given completed run metrics When scored Then returns an integer breakdown", () => {
    const result = scoreRun({
      distance: position(12_345),
      basicKills: score(3),
      eliteKills: score(2),
      bosses: score(1),
      closeCalls: score(4),
      survivedMs: tick(90_000),
    })

    expect(result).toEqual({
      distance: 123,
      basicKills: 300,
      elites: 500,
      bosses: 1000,
      closeCalls: 200,
      subtotal: 2123,
      survivalMultiplierPermille: 1750,
      total: 3715,
    })
  })

  it.each([
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER,
  ])("Given invalid distance %s When scored Then rejects unsafe metrics", (distance) => {
    expect(() =>
      Reflect.apply(scoreRun, undefined, [
        {
          distance,
          basicKills: 3,
          eliteKills: 2,
          bosses: 1,
          closeCalls: 4,
          survivedMs: 90_000,
        },
      ]),
    ).toThrow()
  })

  it("Given valid metrics When scored Then every component is a safe integer", () => {
    const breakdown = scoreRun({
      distance: position(100),
      basicKills: score(1),
      eliteKills: score(1),
      bosses: score(1),
      closeCalls: score(1),
      survivedMs: tick(30_000),
    })

    expect(Object.values(breakdown).every(Number.isSafeInteger)).toBe(true)
  })
})
