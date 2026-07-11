import { STEP_MS } from "./config"
import { collectGates } from "./gates"
import { createSimulation, stepSimulation } from "./simulation"
import type { Gate, SimulationInput, SimulationState, Zombie, ZombieKind } from "./types"
import { position, tick, velocity } from "./types"
import type { EntryState, WaveSegment } from "./waves"

export type ProductionWaveState = Readonly<{
  simulation: SimulationState
  atMs: number
  collectedGateIds: ReadonlySet<string>
  spawnedBlockerIds: ReadonlySet<string>
}>

export const createProductionWaveState = (entry: EntryState): ProductionWaveState => ({
  simulation: createSimulation(1, entry.upgrades, {
    playerX: entry.x,
    playerVelocity: entry.velocity,
    squad: entry.squad,
    maximumSquad: Math.max(entry.squad, 3 + entry.upgrades.troop),
    spawnCooldownMs: Number.MAX_SAFE_INTEGER,
  }),
  atMs: 0,
  collectedGateIds: new Set(),
  spawnedBlockerIds: new Set(),
})

const waveNumber = (segment: WaveSegment): number => {
  const matched = /(?:wave|boss)-(\d+)$/.exec(segment.id)
  return matched?.[1] === undefined ? 1 : Number(matched[1])
}

const zombieKind = (segment: WaveSegment): ZombieKind => {
  const number = waveNumber(segment)
  if (number % 5 === 0 || segment.horizonMs === 12_000) return "boss"
  if (number % 2 === 0) return "elite"
  return "basic"
}

export const stepProductionWave = (
  entry: EntryState,
  segment: WaveSegment,
  state: ProductionWaveState,
  input: SimulationInput,
): ProductionWaveState => {
  const atMs = state.atMs + STEP_MS
  const beforeX = state.simulation.playerX
  const activating = segment.blockers.filter(
    (blocker, index) =>
      blocker.fromMs <= atMs &&
      blocker.fromMs > state.atMs &&
      !state.spawnedBlockerIds.has(`${segment.id}:${index}`),
  )
  const kind = zombieKind(segment)
  const spawned: Zombie[] = activating.map((blocker, index) => ({
    id: state.simulation.nextEntityId + index,
    kind,
    x: position(Math.round((blocker.minX + blocker.maxX) / 2)),
    hp: kind === "boss" ? 240 : kind === "elite" ? 80 : 40,
    damage: kind === "boss" ? 2 : 1,
  }))
  const stepped = stepSimulation(
    {
      ...state.simulation,
      gates: [],
      zombies: [...state.simulation.zombies, ...spawned],
      nextEntityId: state.simulation.nextEntityId + spawned.length,
    },
    input,
    tick(STEP_MS),
  )
  const playerX = position(Math.max(0, Math.min(entry.playfieldWidth, stepped.playerX)))
  const collidedWaveGates = segment.gates.filter(
    (gate) =>
      !state.collectedGateIds.has(gate.id) &&
      gate.atMs <= atMs &&
      atMs < gate.atMs + STEP_MS &&
      Math.abs(gate.x - playerX) <= gate.radius + entry.playerRadius,
  )
  const productionGates: readonly Gate[] = collidedWaveGates.map((gate, index) => ({
    id: index + 1,
    kind: gate.kind,
    x: playerX,
    level: gate.level,
  }))
  const gateResult = collectGates({ ...stepped, gates: productionGates }, playerX)
  let squad = gateResult.squad
  for (const blocker of segment.blockers) {
    const radius = entry.playerRadius + entry.blockerRadius
    if (
      blocker.fromMs < atMs &&
      blocker.toMs >= atMs - STEP_MS &&
      Math.max(beforeX, playerX) + radius >= blocker.minX &&
      Math.min(beforeX, playerX) - radius <= blocker.maxX
    )
      squad = Math.max(0, squad - blocker.damage)
  }
  const collected = new Set(state.collectedGateIds)
  for (const gate of collidedWaveGates) collected.add(gate.id)
  const spawnedBlockers = new Set(state.spawnedBlockerIds)
  for (const blocker of activating) {
    const index = segment.blockers.indexOf(blocker)
    spawnedBlockers.add(`${segment.id}:${index}`)
  }
  return {
    simulation: {
      ...stepped,
      playerX,
      playerVelocity:
        playerX === 0 || playerX === entry.playfieldWidth ? velocity(0) : stepped.playerVelocity,
      playerMotionRemainder:
        playerX === 0 || playerX === entry.playfieldWidth ? 0 : stepped.playerMotionRemainder,
      squad,
      maximumSquad: gateResult.maximumSquad,
      shotDamage: gateResult.shotDamage,
      fireIntervalMs: gateResult.fireIntervalMs,
      recoveryEveryMs: gateResult.recoveryEveryMs,
      recoveryAmount: gateResult.recoveryAmount,
      gates: [],
    },
    atMs,
    collectedGateIds: collected,
    spawnedBlockerIds: spawnedBlockers,
  }
}
