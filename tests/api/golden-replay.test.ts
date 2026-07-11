import { expect, it } from "vitest"
import { accumulateRunScore, finalRunScore, INITIAL_RUN_SCORE } from "../../src/game/run-score"
import type { Transcript } from "../../src/game/transcript"
import { createWaveRuntime } from "../../src/game/wave-runtime"
import { verifyReplay } from "../../src/server/verifier"

it("produces a stable authoritative result for the golden transcript", () => {
  const transcript: Transcript = {
    entries: [
      { tick: 0, move: "N" },
      { tick: 20, move: "R" },
      { tick: 80, move: "L" },
      { tick: 120, move: "N" },
    ],
    endTick: 121,
  }
  let runtime = createWaveRuntime(undefined, 0, 0x1234_5678)
  let counters = INITIAL_RUN_SCORE
  let movement: -1 | 0 | 1 = 0
  let entry = 0
  for (let tick = 0; tick < transcript.endTick; tick += 1) {
    const change = transcript.entries[entry]
    if (change?.tick === tick) {
      movement = change.move === "L" ? -1 : change.move === "R" ? 1 : 0
      entry += 1
    }
    const before = Number(runtime.active.production.simulation.distance)
    runtime = runtime.step({ moveX: movement, paused: false })
    const state = runtime.active.production.simulation
    counters = accumulateRunScore(counters, Number(state.distance) - before, state.events)
  }
  const state = runtime.active.production.simulation
  const elapsed = runtime.active.elapsedBeforeMs + runtime.active.production.atMs
  const server = verifyReplay(0x1234_5678, transcript, 2_000)
  expect(server).toMatchObject({
    score: Number(finalRunScore(counters, elapsed).total),
    finalState: { playerX: state.playerX, squad: state.squad, wave: runtime.active.index },
    events: state.events,
  })
})
