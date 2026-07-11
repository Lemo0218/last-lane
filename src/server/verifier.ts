import { finalRunScore } from "../game/run-score"
import { transcriptSchema } from "../game/transcript"
import { createWaveRuntime } from "../game/wave-runtime"

export class VerificationError extends Error {
  constructor(readonly code: "invalid-transcript" | "invalid-outcome" | "verification-timeout") {
    super(code.replaceAll("-", " "))
    this.name = "VerificationError"
  }
}

export const verifyReplay = (seed: number, input: unknown, budgetMs = 1_500) => {
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
  let distance = 0
  let basicKills = 0
  let eliteKills = 0
  let bosses = 0
  let closeCalls = 0
  let movement: -1 | 0 | 1 = 0
  let index = 0
  let terminalTick: number | undefined
  for (let current = 0; current < parsed.data.endTick; current += 1) {
    const next = parsed.data.entries[index]
    if (next?.tick === current) {
      movement = next.move === "L" ? -1 : next.move === "R" ? 1 : 0
      index += 1
    }
    const before = runtime.active.production.simulation.distance
    runtime = runtime.step({ moveX: movement, paused: false })
    const state = runtime.active.production.simulation
    distance += Math.max(0, state.distance - before)
    for (const event of state.events) {
      if (event.kind === "close-call") closeCalls += 1
      if (event.kind !== "zombie-killed") continue
      if (event.zombieKind === "basic") basicKills += 1
      if (event.zombieKind === "elite") eliteKills += 1
      if (event.zombieKind === "boss") bosses += 1
    }
    if (state.status === "game-over") {
      terminalTick = current + 1
      break
    }
    if (current % 128 === 0 && performance.now() - started > budgetMs)
      throw new VerificationError("verification-timeout")
  }
  if (terminalTick === undefined || terminalTick !== parsed.data.endTick)
    throw new VerificationError("invalid-outcome")
  const elapsedMs = runtime.active.elapsedBeforeMs + runtime.active.production.atMs
  const breakdown = finalRunScore(
    { distance, basicKills, eliteKills, bosses, closeCalls },
    elapsedMs,
  )
  const state = runtime.active.production.simulation
  return {
    score: Number(breakdown.total),
    survivalTicks: terminalTick,
    breakdown,
    finalState: { playerX: state.playerX, squad: state.squad, wave: runtime.active.index },
    events: state.events,
  }
}
