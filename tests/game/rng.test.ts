import { describe, expect, it } from "vitest"
import { nextRandom } from "../../src/game/rng"

describe("seeded random generator", () => {
  it("Given equal seeds When advanced Then produces equal values and seeds", () => {
    const first = nextRandom(42)
    const second = nextRandom(42)

    expect(first).toEqual(second)
  })
})
