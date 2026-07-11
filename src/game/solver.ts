import { fallbackFor } from "./fallbacks"
import type { EntryState, Move, WaveSegment, WaveWitness, WitnessFrame } from "./waves"
import {
  advanceMotion,
  hasEscapeCorridor,
  REACTION_DELAY_MS,
  replayWitness,
  SOLVER_STEP_MS,
} from "./waves"

export type SolverOptions = Readonly<{ budgetMs?: number; now?: () => number }>
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
  x: number
  velocity: number
  squad: number
  gates: ReadonlySet<string>
  depth: number
  parent: SearchState | null
  frame: WitnessFrame | null
}>

const moves = [-1, 0, 1] as const
export const squadHealthBin = (squad: number): number => Math.floor(squad / 3)

const stateKey = (state: SearchState): string =>
  `${Math.round(state.x)}:${Math.round(state.velocity / 8)}:${squadHealthBin(state.squad)}:${[...state.gates].sort().join(",")}`

const advance = (
  entry: EntryState,
  segment: WaveSegment,
  state: SearchState,
  move: Move,
  atMs: number,
): SearchState => {
  const motion = advanceMotion(state.x, state.velocity, move, entry.playfieldWidth)
  let squad = state.squad
  const gates = new Set(state.gates)
  for (const blocker of segment.blockers) {
    if (
      blocker.fromMs <= atMs &&
      atMs < blocker.toMs &&
      motion.x + entry.playerRadius + entry.blockerRadius >= blocker.minX &&
      motion.x - entry.playerRadius - entry.blockerRadius <= blocker.maxX
    )
      squad = Math.max(0, squad - blocker.damage)
  }
  for (const gate of segment.gates) {
    if (
      !gates.has(gate.id) &&
      Math.abs(gate.atMs - atMs) < SOLVER_STEP_MS &&
      Math.abs(gate.x - motion.x) <= gate.radius + entry.playerRadius
    ) {
      gates.add(gate.id)
      if (gate.kind === "troop" || gate.kind === "recovery") squad += gate.level
    }
  }
  return {
    x: motion.x,
    velocity: motion.velocity,
    squad,
    gates,
    depth: state.depth + 1,
    parent: state,
    frame: { atMs, move, x: motion.x, velocity: motion.velocity, squad },
  }
}

const witnessOf = (state: SearchState): WaveWitness => {
  const frames: WitnessFrame[] = []
  let cursor: SearchState | null = state
  while (cursor?.frame !== null && cursor?.frame !== undefined) {
    frames.push(cursor.frame)
    cursor = cursor.parent
  }
  frames.reverse()
  const productionInputs = frames.flatMap((frame) =>
    Array.from({ length: SOLVER_STEP_MS / 10 }, (_, index) => ({
      moveX: frame.atMs - SOLVER_STEP_MS + (index + 1) * 10 <= REACTION_DELAY_MS ? 0 : frame.move,
      paused: false,
    })),
  )
  return { frames, productionInputs, finalSquad: state.squad, collectedGateIds: [...state.gates] }
}

const policyWitness = (entry: EntryState, segment: WaveSegment, move: Move): WaveWitness => {
  let state: SearchState = {
    x: entry.x,
    velocity: entry.velocity,
    squad: entry.squad,
    gates: new Set(),
    depth: 0,
    parent: null,
    frame: null,
  }
  for (let atMs = SOLVER_STEP_MS; atMs <= segment.horizonMs; atMs += SOLVER_STEP_MS) {
    state = advance(entry, segment, state, atMs <= REACTION_DELAY_MS ? 0 : move, atMs)
  }
  return witnessOf(state)
}

const hasContinuousEntry = (entry: EntryState): boolean => {
  if (entry.precedingSegments.length > 2) return false
  const preceding = entry.precedingSegments.at(-1)
  return (
    preceding === undefined ||
    (preceding.survived && preceding.exitX === entry.x && preceding.exitVelocity === entry.velocity)
  )
}

export const solveWave = (
  entry: EntryState,
  segment: WaveSegment,
  options: SolverOptions = {},
): SolverResult => {
  const now = options.now ?? performance.now.bind(performance)
  const startedAt = now()
  const budgetMs = options.budgetMs ?? 4
  if (hasEscapeCorridor(entry, segment) && hasContinuousEntry(entry)) {
    for (const move of moves) {
      const witness = policyWitness(entry, segment, move)
      const generationElapsedMs = now() - startedAt
      if (generationElapsedMs > budgetMs) break
      const replay = replayWitness(entry, segment, witness)
      if (replay.survived && replay.continuous && replay.escapeCorridor)
        return { kind: "accepted", segment, witness, elapsedMs: generationElapsedMs }
    }
  }
  let frontier: readonly SearchState[] = [
    {
      x: entry.x,
      velocity: entry.velocity,
      squad: entry.squad,
      gates: new Set(),
      depth: 0,
      parent: null,
      frame: null,
    },
  ]
  if (hasEscapeCorridor(entry, segment) && hasContinuousEntry(entry)) {
    for (let atMs = SOLVER_STEP_MS; atMs <= segment.horizonMs; atMs += SOLVER_STEP_MS) {
      if (now() - startedAt > budgetMs) break
      const deduplicated = new Map<string, SearchState>()
      const legalMoves: readonly Move[] = atMs <= REACTION_DELAY_MS ? [0] : moves
      for (const state of frontier) {
        for (const move of legalMoves) {
          if (now() - startedAt >= budgetMs) break
          const candidate = advance(entry, segment, state, move, atMs)
          if (candidate.squad < 1) continue
          const key = stateKey(candidate)
          const previous = deduplicated.get(key)
          if (previous === undefined || candidate.squad > previous.squad)
            deduplicated.set(key, candidate)
        }
      }
      frontier = [...deduplicated.values()].sort((left, right) => right.squad - left.squad)
      if (frontier.length === 0) break
    }
  }
  const completed = frontier.find((state) => state.depth === segment.horizonMs / SOLVER_STEP_MS)
  if (completed !== undefined) {
    const witness = witnessOf(completed)
    const replay = replayWitness(entry, segment, witness)
    if (replay.survived && replay.continuous && replay.escapeCorridor) {
      return {
        kind: "accepted",
        segment,
        witness,
        elapsedMs: Math.min(budgetMs, now() - startedAt),
      }
    }
  }
  const fallback = fallbackFor(entry)
  return {
    kind: "fallback",
    rejectedSegment: segment,
    ...fallback,
    elapsedMs: Math.min(budgetMs, now() - startedAt),
  }
}
