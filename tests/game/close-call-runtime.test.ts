import { describe, expect, it } from "vitest"
import { createProductionWaveState, stepProductionWave } from "../../src/game/production-wave"
import { accumulateRunScore, finalRunScore, INITIAL_RUN_SCORE } from "../../src/game/run-score"
import type { EntryState, WaveSegment } from "../../src/game/waves"

describe("production close calls", () => {
  const entry: EntryState = {
    squad: 3,
    upgrades: { troop: 0, damage: 0, fireRate: 0, recovery: 0 },
    x: 500,
    velocity: 0,
    playfieldWidth: 1000,
    playerRadius: 12,
    blockerRadius: 12,
    precedingSegments: [],
  }

  it("emits one close-call event only after a near blocker danger window passes", () => {
    const near: WaveSegment = {
      id: "wave-near",
      horizonMs: 6000,
      blockers: [{ fromMs: 10, toMs: 100, minX: 525, maxX: 540, damage: 1 }],
      gates: [],
    }
    let production = createProductionWaveState(entry)
    const events = []
    for (let step = 0; step < 10; step += 1) {
      production = stepProductionWave(entry, near, production, { moveX: 0, paused: false })
      events.push(...production.simulation.events.filter((event) => event.kind === "close-call"))
    }
    expect(events).toHaveLength(0)
    production = stepProductionWave(entry, near, production, { moveX: 0, paused: false })
    expect(
      production.simulation.events.filter((event) => event.kind === "close-call"),
    ).toHaveLength(0)
    production = stepProductionWave(entry, near, production, { moveX: 0, paused: false })
    events.push(...production.simulation.events.filter((event) => event.kind === "close-call"))
    expect(events).toHaveLength(1)
    expect(production.simulation.squad).toBe(3)
    const counters = accumulateRunScore(INITIAL_RUN_SCORE, 0, events)
    expect(finalRunScore(counters, 0).closeCalls).toBe(50)
  })

  it("cancels a near-miss candidate when the player later collides", () => {
    const nearThenCollision: WaveSegment = {
      id: "wave-collision",
      horizonMs: 6000,
      blockers: [{ fromMs: 10, toMs: 100, minX: 525, maxX: 540, damage: 1 }],
      gates: [],
    }
    let production = createProductionWaveState(entry)
    const closeCallEvents = []
    production = stepProductionWave(entry, nearThenCollision, production, {
      moveX: 0,
      paused: false,
    })
    for (let step = 0; step < 12; step += 1) {
      production = stepProductionWave(entry, nearThenCollision, production, {
        moveX: 1,
        paused: false,
      })
      closeCallEvents.push(
        ...production.simulation.events.filter((event) => event.kind === "close-call"),
      )
    }
    expect(closeCallEvents).toHaveLength(0)
    expect(production.simulation.squad).toBeLessThan(3)
  })
})
