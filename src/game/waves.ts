import { createProductionWaveState, stepProductionWave } from "./production-wave"
import type { GateKind, SimulationInput, UpgradeLevels } from "./types"

export const SOLVER_STEP_MS = 100 as const
export const REACTION_DELAY_MS = 250 as const
export const NORMAL_HORIZON_MS = 6_000 as const
export const BOSS_HORIZON_MS = 12_000 as const
export type Move = -1 | 0 | 1
export type CommittedSegment = Readonly<{
  id: string
  exitX: number
  exitVelocity: number
  survived: boolean
}>
export type EntryState = Readonly<{
  squad: number
  upgrades: UpgradeLevels
  x: number
  velocity: number
  playfieldWidth: number
  playerRadius: number
  blockerRadius: number
  precedingSegments: readonly CommittedSegment[]
}>
export type WaveBlocker = Readonly<{
  fromMs: number
  toMs: number
  minX: number
  maxX: number
  damage: number
}>
export type WaveGate = Readonly<{
  id: string
  atMs: number
  x: number
  radius: number
  kind: GateKind
  level: number
}>
export type WaveSegment = Readonly<{
  id: string
  horizonMs: typeof NORMAL_HORIZON_MS | typeof BOSS_HORIZON_MS
  blockers: readonly WaveBlocker[]
  gates: readonly WaveGate[]
}>
export type WitnessFrame = Readonly<{
  atMs: number
  move: Move
  x: number
  velocity: number
  squad: number
}>
export type WaveWitness = Readonly<{
  frames: readonly WitnessFrame[]
  productionInputs: readonly SimulationInput[]
  finalSquad: number
  finalX: number
  finalVelocity: number
  collectedGateIds: readonly string[]
}>
export type ReplayResult = Readonly<{
  survived: boolean
  continuous: boolean
  escapeCorridor: boolean
  finalSquad: number
  finalX: number
  finalVelocity: number
  collectedGateIds: readonly string[]
}>

const freeIntervals = (
  entry: EntryState,
  segment: WaveSegment,
  atMs: number,
): readonly [number, number][] => {
  const blocked = segment.blockers
    .filter((blocker) => blocker.fromMs < atMs && blocker.toMs >= atMs - 10)
    .map((blocker) => ({
      min: Math.max(0, blocker.minX - entry.blockerRadius - entry.playerRadius),
      max: Math.min(entry.playfieldWidth, blocker.maxX + entry.blockerRadius + entry.playerRadius),
    }))
    .sort((left, right) => left.min - right.min)
  const free: [number, number][] = []
  let cursor = 0
  for (const interval of blocked) {
    if (interval.min > cursor) free.push([cursor, interval.min])
    cursor = Math.max(cursor, interval.max)
  }
  if (cursor < entry.playfieldWidth) free.push([cursor, entry.playfieldWidth])
  return free
}

export const hasEscapeCorridor = (entry: EntryState, segment: WaveSegment): boolean => {
  let reachable: readonly [number, number][] = [[entry.x, entry.x]]
  for (let atMs = 10; atMs <= segment.horizonMs; atMs += 10) {
    const next: [number, number][] = []
    for (const [minimum, maximum] of reachable) {
      for (const [freeMinimum, freeMaximum] of freeIntervals(entry, segment, atMs)) {
        const low = Math.max(freeMinimum, minimum - 5)
        const high = Math.min(freeMaximum, maximum + 5)
        if (low <= high) next.push([low, high])
      }
    }
    reachable = next
    if (reachable.length === 0) return false
  }
  return true
}

export const replayWitness = (
  entry: EntryState,
  segment: WaveSegment,
  witness: WaveWitness,
): ReplayResult => {
  let state = createProductionWaveState(entry)
  for (const input of witness.productionInputs)
    state = stepProductionWave(entry, segment, state, input)
  const finalSquad = state.simulation.squad
  const finalX = state.simulation.playerX
  const collectedGateIds = [...state.collectedGateIds]
  const exact =
    witness.productionInputs.length === segment.horizonMs / 10 &&
    witness.frames.length === segment.horizonMs / SOLVER_STEP_MS &&
    witness.finalX === finalX &&
    witness.finalSquad === finalSquad &&
    witness.finalVelocity === state.simulation.playerVelocity &&
    witness.collectedGateIds.join() === collectedGateIds.join()
  return {
    survived: finalSquad >= 1 && exact,
    continuous: exact,
    escapeCorridor: hasEscapeCorridor(entry, segment),
    finalSquad,
    finalX,
    finalVelocity: state.simulation.playerVelocity,
    collectedGateIds,
  }
}
