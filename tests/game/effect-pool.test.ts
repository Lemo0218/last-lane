import { describe, expect, it } from "vitest"
import { createEffectPool } from "../../src/game/effect-pool"

describe("visible effect pool", () => {
  it("refuses new effects at capacity and expires real event effects", () => {
    // Given: enough real damage events to fill the visible effect pool
    let pool = createEffectPool()
    for (let index = 0; index < 8; index += 1)
      pool = pool.step([{ kind: "squad-damaged", amount: 1 }], 0)

    // When: another damage event arrives at capacity and time then advances
    const full = pool.step([{ kind: "squad-damaged", amount: 1 }], 0)
    const expired = full.step([], 1_000)

    // Then: the pool never exceeds 32 and effects disappear after their lifetime
    expect(pool.effects).toHaveLength(32)
    expect(full.effects).toHaveLength(32)
    expect(expired.effects).toHaveLength(0)
  })
})
