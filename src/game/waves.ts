import { createSimulation, stepSimulation } from "./simulation"
import type { GateKind, SimulationInput, UpgradeLevels } from "./types"
import { tick } from "./types"

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

const MAX_SPEED = 40
const ACCELERATION = 80

export const advanceMotion = (
  x: number,
  velocity: number,
  move: Move,
  width: number,
): Readonly<{ x: number; velocity: number }> => {
  const nextVelocity = Math.max(
    -MAX_SPEED,
    Math.min(MAX_SPEED, velocity + move * ACCELERATION * 0.1),
  )
  const nextX = Math.max(0, Math.min(width, x + nextVelocity * 0.1))
  return { x: nextX, velocity: nextX === 0 || nextX === width ? 0 : nextVelocity }
}

export const hasEscapeCorridor = (entry: EntryState, segment: WaveSegment): boolean => {
  for (let atMs = 0; atMs <= segment.horizonMs; atMs += SOLVER_STEP_MS) {
    const active = segment.blockers
      .filter((blocker) => blocker.fromMs <= atMs && atMs < blocker.toMs)
      .map((blocker) => ({
        min: Math.max(0, blocker.minX - entry.blockerRadius - entry.playerRadius),
        max: Math.min(
          entry.playfieldWidth,
          blocker.maxX + entry.blockerRadius + entry.playerRadius,
        ),
      }))
      .sort((left, right) => left.min - right.min)
    let cursor = 0
    for (const interval of active) {
      if (interval.min > cursor) break
      cursor = Math.max(cursor, interval.max)
    }
    if (cursor >= entry.playfieldWidth) return false
  }
  return true
}

export const replayWitness = (
  entry: EntryState,
  segment: WaveSegment,
  witness: WaveWitness,
): ReplayResult => {
  let x = entry.x
  let velocity = entry.velocity
  let squad = entry.squad
  const collected = new Set<string>()
  let continuous = witness.frames.length === segment.horizonMs / SOLVER_STEP_MS
  let production = createSimulation(1, entry.upgrades, {
    playerX: entry.x,
    squad: entry.squad,
    maximumSquad: Math.max(entry.squad, 3 + entry.upgrades.troop),
    spawnCooldownMs: Number.MAX_SAFE_INTEGER,
  })
  for (const input of witness.productionInputs)
    production = stepSimulation(production, input, tick(10))
  continuous &&= witness.productionInputs.length === segment.horizonMs / 10
  for (let index = 0; index < witness.frames.length; index += 1) {
    const frame = witness.frames[index]
    if (frame === undefined) continue
    const atMs = (index + 1) * SOLVER_STEP_MS
    const allowedMove: Move = atMs <= REACTION_DELAY_MS ? 0 : frame.move
    const previousX = x
    const motion = advanceMotion(x, velocity, allowedMove, entry.playfieldWidth)
    x = motion.x
    velocity = motion.velocity
    for (const blocker of segment.blockers) {
      if (
        blocker.fromMs <= atMs &&
        atMs < blocker.toMs &&
        Math.max(previousX, x) + entry.playerRadius + entry.blockerRadius >= blocker.minX &&
        Math.min(previousX, x) - entry.playerRadius - entry.blockerRadius <= blocker.maxX
      )
        squad = Math.max(0, squad - blocker.damage)
    }
    for (const gate of segment.gates) {
      if (
        !collected.has(gate.id) &&
        Math.abs(gate.atMs - atMs) < SOLVER_STEP_MS &&
        Math.abs(gate.x - x) <= gate.radius + entry.playerRadius
      ) {
        collected.add(gate.id)
        if (gate.kind === "troop" || gate.kind === "recovery") squad += gate.level
      }
    }
    continuous &&= Math.abs(frame.x - x) < 0.001 && frame.atMs === atMs
  }
  return {
    survived: squad >= 1 && production.squad >= 1 && continuous,
    continuous,
    escapeCorridor: hasEscapeCorridor(entry, segment),
    finalSquad: squad,
    finalX: x,
    finalVelocity: velocity,
    collectedGateIds: [...collected],
  }
}
