import { describe, expect, it } from "vitest"
import { nextRandom } from "../../src/game/rng"

describe("seeded random generator", () => {
  it("Given equal seeds When advanced Then produces equal values and seeds", () => {
    const first = nextRandom(42)
    const second = nextRandom(42)

    expect(first).toEqual(second)
  })

  it("Given seed one When repeatedly advanced Then matches the golden sequence", () => {
    let seed = 1
    const values: number[] = []
    for (let index = 0; index < 4; index += 1) {
      const result = nextRandom(seed)
      seed = result.seed
      values.push(result.value)
    }

    expect(values).toEqual([568748, 5467, 703038, 450565])
  })

  it.each([
    1.5,
    -1,
    Number.MAX_SAFE_INTEGER + 1,
  ])("Given invalid seed %s When advanced Then rejects it", (seed) => {
    expect(() => nextRandom(seed)).toThrow()
  })
})
