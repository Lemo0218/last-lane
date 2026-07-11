import { fallbackFor } from "./fallbacks"
import type { ProductionWaveState } from "./production-wave"
import { createProductionWaveState, stepProductionWave } from "./production-wave"
import type { SimulationInput } from "./types"
import type { EntryState, Move, WaveSegment, WaveWitness, WitnessFrame } from "./waves"
import { hasEscapeCorridor, REACTION_DELAY_MS, replayWitness, SOLVER_STEP_MS } from "./waves"

export type Clock = Readonly<{ now: () => number }>
export type SolverOptions = Readonly<{ budgetMs?: number; clock?: Clock }>
export type SolverResult =
  | Readonly<{ kind: "accepted"; segment: WaveSegment; witness: WaveWitness; elapsedMs: number }>
  | Readonly<{
      kind: "fallback"
      rejectedSegment: WaveSegment
      segment: WaveSegment
      witness: WaveWitness
      patternId: string
      elapsedMs: number
    }>

type SearchState = Readonly<{
  production: ProductionWaveState
  inputs: readonly SimulationInput[]
  frames: readonly WitnessFrame[]
}>
const moves = [-1, 0, 1] as const
export const squadHealthBin = (squad: number): number => Math.floor(squad / 3)

const stateKey = (state: SearchState): string => {
  const simulation = state.production.simulation
  return `${Math.round(simulation.playerX)}:${simulation.playerVelocity}:${squadHealthBin(simulation.squad)}:${[...state.production.collectedGateIds].sort().join(",")}`
}

const expandAction = (
  entry: EntryState,
  segment: WaveSegment,
  state: SearchState,
  move: Move,
  deadline: number,
  clock: Clock,
): SearchState | null => {
  let production = state.production
  const inputs: SimulationInput[] = [...state.inputs]
  for (let index = 0; index < SOLVER_STEP_MS / 10; index += 1) {
    if (clock.now() >= deadline) return null
    const moveX: Move = production.atMs < REACTION_DELAY_MS ? 0 : move
    const input: SimulationInput = { moveX, paused: false }
    production = stepProductionWave(entry, segment, production, input)
    inputs.push(input)
  }
  const simulation = production.simulation
  return {
    production,
    inputs,
    frames: [
      ...state.frames,
      {
        atMs: production.atMs,
        move,
        x: simulation.playerX,
        velocity: simulation.playerVelocity,
        squad: simulation.squad,
      },
    ],
  }
}

const witnessOf = (state: SearchState): WaveWitness => ({
  frames: state.frames,
  productionInputs: state.inputs,
  finalSquad: state.production.simulation.squad,
  finalX: state.production.simulation.playerX,
  finalVelocity: state.production.simulation.playerVelocity,
  collectedGateIds: [...state.production.collectedGateIds],
})

const initialState = (entry: EntryState): SearchState => ({
  production: createProductionWaveState(entry),
  inputs: [],
  frames: [],
})

const hasContinuousEntry = (entry: EntryState): boolean => {
  if (entry.precedingSegments.length > 2) return false
  const preceding = entry.precedingSegments.at(-1)
  return (
    preceding === undefined ||
    (preceding.survived && preceding.exitX === entry.x && preceding.exitVelocity === entry.velocity)
  )
}

const fallbackResult = (
  entry: EntryState,
  segment: WaveSegment,
  clock: Clock,
  startedAt: number,
): SolverResult => {
  const fallback = fallbackFor(entry, segment)
  return {
    kind: "fallback",
    rejectedSegment: segment,
    ...fallback,
    elapsedMs: clock.now() - startedAt,
  }
}

export const solveWave = (
  entry: EntryState,
  segment: WaveSegment,
  options: SolverOptions = {},
): SolverResult => {
  const clock = options.clock ?? { now: () => performance.now() }
  const budgetMs = options.budgetMs ?? 4
  const startedAt = clock.now()
  const deadline = startedAt + budgetMs / 2
  if (!hasContinuousEntry(entry) || !hasEscapeCorridor(entry, segment))
    return fallbackResult(entry, segment, clock, startedAt)
  let bestWitness: WaveWitness | undefined
  const retainBest = (witness: WaveWitness): void => {
    const replay = replayWitness(entry, segment, witness)
    if (!replay.survived || !replay.continuous || !replay.escapeCorridor) return
    if (bestWitness === undefined || witness.finalSquad > bestWitness.finalSquad)
      bestWitness = witness
  }
  for (const policy of moves) {
    let state: SearchState | null = initialState(entry)
    for (let atMs = SOLVER_STEP_MS; atMs <= segment.horizonMs; atMs += SOLVER_STEP_MS) {
      state = state === null ? null : expandAction(entry, segment, state, policy, deadline, clock)
      if (state === null) {
        if (bestWitness !== undefined)
          return {
            kind: "accepted",
            segment,
            witness: bestWitness,
            elapsedMs: clock.now() - startedAt,
          }
        return fallbackResult(entry, segment, clock, startedAt)
      }
      if (state.production.simulation.squad < 1) break
    }
    if (state !== null && state.production.atMs === segment.horizonMs) {
      retainBest(witnessOf(state))
    }
  }
  let frontier: readonly SearchState[] = [initialState(entry)]
  for (let atMs = SOLVER_STEP_MS; atMs <= segment.horizonMs; atMs += SOLVER_STEP_MS) {
    const deduplicated = new Map<string, SearchState>()
    for (const state of frontier) {
      for (const move of moves) {
        const candidate = expandAction(entry, segment, state, move, deadline, clock)
        if (candidate === null) {
          if (bestWitness !== undefined)
            return {
              kind: "accepted",
              segment,
              witness: bestWitness,
              elapsedMs: clock.now() - startedAt,
            }
          return fallbackResult(entry, segment, clock, startedAt)
        }
        if (candidate.production.simulation.squad < 1) continue
        const key = stateKey(candidate)
        const previous = deduplicated.get(key)
        if (
          previous === undefined ||
          candidate.production.simulation.squad > previous.production.simulation.squad
        )
          deduplicated.set(key, candidate)
      }
    }
    frontier = [...deduplicated.values()]
      .sort((left, right) => right.production.simulation.squad - left.production.simulation.squad)
      .slice(0, 4)
    if (frontier.length === 0) break
  }
  for (const completed of frontier)
    if (completed.production.atMs === segment.horizonMs) retainBest(witnessOf(completed))
  if (bestWitness !== undefined)
    return { kind: "accepted", segment, witness: bestWitness, elapsedMs: clock.now() - startedAt }
  return fallbackResult(entry, segment, clock, startedAt)
}
