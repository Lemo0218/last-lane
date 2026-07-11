import { accumulateRunScore, finalRunScore, INITIAL_RUN_SCORE } from "../game/run-score"
import { type Transcript, transcriptSchema } from "../game/transcript"
import { createWaveRuntime } from "../game/wave-runtime"

export class VerificationError extends Error {
  constructor(readonly code: "invalid-transcript" | "verification-timeout") {
    super(code.replaceAll("-", " "))
    this.name = "VerificationError"
  }
}

export const verifyReplay = (seed: number, input: Transcript, budgetMs = 1_500) => {
  const parsed = transcriptSchema.safeParse(input)
  if (!parsed.success) throw new VerificationError("invalid-transcript")
  let priorTick = -1
  let priorMove: "L" | "N" | "R" | undefined
  for (const entry of parsed.data.entries) {
    if (entry.tick <= priorTick || entry.tick >= parsed.data.endTick || entry.move === priorMove)
      throw new VerificationError("invalid-transcript")
    priorTick = entry.tick
    priorMove = entry.move
  }
  if (parsed.data.endTick > 0 && parsed.data.entries[0]?.tick !== 0)
    throw new VerificationError("invalid-transcript")
  const started = performance.now()
  let runtime = createWaveRuntime(undefined, 0, seed)
  let counters = INITIAL_RUN_SCORE
  let movement: -1 | 0 | 1 = 0
  let index = 0
  for (let current = 0; current < parsed.data.endTick; current += 1) {
    const next = parsed.data.entries[index]
    if (next?.tick === current) {
      movement = next.move === "L" ? -1 : next.move === "R" ? 1 : 0
      index += 1
    }
    const before = Number(runtime.active.production.simulation.distance)
    runtime = runtime.step({ moveX: movement, paused: false })
    const state = runtime.active.production.simulation
    counters = accumulateRunScore(
      counters,
      Math.max(0, Number(state.distance) - before),
      state.events,
    )
    if (current % 128 === 0 && performance.now() - started > budgetMs)
      throw new VerificationError("verification-timeout")
  }
  const elapsedMs = runtime.active.elapsedBeforeMs + runtime.active.production.atMs
  const breakdown = finalRunScore(counters, elapsedMs)
  const state = runtime.active.production.simulation
  return {
    score: Number(breakdown.total),
    survivalTicks: parsed.data.endTick,
    breakdown,
    finalState: { playerX: state.playerX, squad: state.squad, wave: runtime.active.index },
    events: state.events,
  }
}
