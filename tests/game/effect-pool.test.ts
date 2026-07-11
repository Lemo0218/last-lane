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

  it("uses one static short flash per damage event with reduced motion", () => {
    // Given: reduced-motion rendering receives repeated damage events
    const pool = createEffectPool(true).step(
      [
        { kind: "squad-damaged", amount: 1 },
        { kind: "squad-damaged", amount: 1 },
      ],
      0,
    )

    // When: less than and then exactly 150 milliseconds elapse without new events
    const visible = pool.step([], 149)
    const expired = visible.step([], 1)

    // Then: only static flashes exist and none can remain pinned while paused
    expect(pool.effects).toHaveLength(2)
    expect(pool.effects.every((effect) => effect.moving === false)).toBe(true)
    expect(visible.effects).toHaveLength(2)
    expect(expired.effects).toHaveLength(0)
  })

  it("does not duplicate a stepped event across 120Hz zero-step and paused frames", () => {
    // Given: one fixed simulation tick emits damage before a 120Hz RAF sequence
    let pool = createEffectPool().step([{ kind: "squad-damaged", amount: 1 }], 8)
    let maximum = pool.effects.length

    // When: zero-step RAFs and paused RAFs advance time with no newly stepped events
    for (let frame = 0; frame < 125; frame += 1) {
      pool = pool.step([], 8)
      maximum = Math.max(maximum, pool.effects.length)
    }

    // Then: the event is consumed once and effects expire instead of being duplicated or pinned
    expect(maximum).toBe(4)
    expect(pool.effects).toHaveLength(0)
  })
})
