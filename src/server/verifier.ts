import { STEP_MS } from "../game/config"
import { scoreRun } from "../game/scoring"
import { createSimulation, stepSimulation } from "../game/simulation"
import { type Transcript, transcriptSchema } from "../game/transcript"
import { score } from "../game/types"

const MAX_TICKS = 60_000
export class VerificationError extends Error {
  constructor(readonly code: "invalid-transcript" | "verification-timeout") {
    super(code.replaceAll("-", " "))
    this.name = "VerificationError"
  }
}

export const verifyReplay = (seed: number, input: Transcript, budgetMs = 1_500) => {
  const parsed = transcriptSchema.safeParse(input)
  if (!parsed.success) throw new VerificationError("invalid-transcript")
  let lastTick = 0
  for (const entry of parsed.data) {
    if (entry.tick <= lastTick || entry.tick > MAX_TICKS)
      throw new VerificationError("invalid-transcript")
    lastTick = entry.tick
  }
  const started = performance.now()
  let state = createSimulation(seed, { troop: 0, damage: 0, fireRate: 0, recovery: 0 })
  let movement: -1 | 0 | 1 = 0
  let index = 0
  let basicKills = 0,
    eliteKills = 0,
    bosses = 0,
    closeCalls = 0
  for (let current = 1; current <= lastTick && state.status === "running"; current += 1) {
    const next = parsed.data[index]
    if (next?.tick === current) {
      movement = next.move === "L" ? -1 : next.move === "R" ? 1 : 0
      index += 1
    }
    state = stepSimulation(state, { moveX: movement, paused: false })
    for (const event of state.events) {
      if (event.kind === "zombie-killed") {
        if (event.zombieKind === "basic") basicKills += 1
        else if (event.zombieKind === "elite") eliteKills += 1
        else bosses += 1
      }
      if (event.kind === "close-call") closeCalls += 1
    }
    if (current % 256 === 0 && performance.now() - started > budgetMs)
      throw new VerificationError("verification-timeout")
  }
  const breakdown = scoreRun({
    distance: state.distance,
    basicKills: score(basicKills),
    eliteKills: score(eliteKills),
    bosses: score(bosses),
    closeCalls: score(closeCalls),
    survivedMs: state.elapsedMs,
  })
  return {
    score: Number(breakdown.total),
    survivalTicks: Math.floor(Number(state.elapsedMs) / STEP_MS),
    breakdown,
  }
}
