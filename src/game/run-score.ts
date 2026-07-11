import { type ScoreBreakdown, scoreRun } from "./scoring"
import { position, type SimulationEvent, score, tick } from "./types"

export type RunScoreCounters = Readonly<{
  distance: number
  basicKills: number
  eliteKills: number
  bosses: number
  closeCalls: number
}>

export const INITIAL_RUN_SCORE: RunScoreCounters = {
  distance: 0,
  basicKills: 0,
  eliteKills: 0,
  bosses: 0,
  closeCalls: 0,
}

export const accumulateRunScore = (
  counters: RunScoreCounters,
  distanceDelta: number,
  events: readonly SimulationEvent[],
): RunScoreCounters => ({
  distance: counters.distance + distanceDelta,
  basicKills:
    counters.basicKills +
    events.filter((event) => event.kind === "zombie-killed" && event.zombieKind === "basic").length,
  eliteKills:
    counters.eliteKills +
    events.filter((event) => event.kind === "zombie-killed" && event.zombieKind === "elite").length,
  bosses:
    counters.bosses +
    events.filter((event) => event.kind === "zombie-killed" && event.zombieKind === "boss").length,
  closeCalls: counters.closeCalls + events.filter((event) => event.kind === "close-call").length,
})

export const finalRunScore = (counters: RunScoreCounters, elapsedMs: number): ScoreBreakdown =>
  scoreRun({
    distance: position(counters.distance),
    basicKills: score(counters.basicKills),
    eliteKills: score(counters.eliteKills),
    bosses: score(counters.bosses),
    closeCalls: score(counters.closeCalls),
    survivedMs: tick(elapsedMs),
  })
