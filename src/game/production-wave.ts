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
  closeCallBlockerIds: ReadonlySet<string>
  nearMissCandidateIds: ReadonlySet<string>
  collidedBlockerIds: ReadonlySet<string>
}>

export const createProductionWaveState = (entry: EntryState, seed = 1): ProductionWaveState => ({
  simulation: createSimulation(seed, entry.upgrades, {
    playerX: entry.x,
    playerVelocity: entry.velocity,
    squad: entry.squad,
    maximumSquad: Math.max(entry.squad, 3 + entry.upgrades.troop),
    spawnCooldownMs: Number.MAX_SAFE_INTEGER,
  }),
  atMs: 0,
  collectedGateIds: new Set(),
  spawnedBlockerIds: new Set(),
  closeCallBlockerIds: new Set(),
  nearMissCandidateIds: new Set(),
  collidedBlockerIds: new Set(),
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
  const spawned: Zombie[] = []
  if (activating.length > 0) {
    const kind = zombieKind(segment)
    for (const blocker of activating)
      spawned.push({
        id: state.simulation.nextEntityId + spawned.length,
        kind,
        x: position(Math.round((blocker.minX + blocker.maxX) / 2)),
        hp: kind === "boss" ? 30 : kind === "elite" ? 20 : 10,
        damage: kind === "boss" ? 2 : 1,
      })
  }
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
      gate.atMs - 350 <= atMs &&
      atMs <= gate.atMs + 500 &&
      gate.x + gate.radius + entry.playerRadius >= Math.min(beforeX, playerX) &&
      gate.x - gate.radius - entry.playerRadius <= Math.max(beforeX, playerX),
  )
  const productionGates: readonly Gate[] = collidedWaveGates.map((gate, index) => ({
    id: index + 1,
    kind: gate.kind,
    x: playerX,
    level: gate.level,
  }))
  const gateResult = collectGates({ ...stepped, gates: productionGates }, playerX)
  let squad = gateResult.squad
  let closeCalls: Set<string> | undefined
  let nearMissCandidates: Set<string> | undefined
  let collidedBlockers: Set<string> | undefined
  const closeCallEvents: Array<Readonly<{ kind: "close-call"; blockerId: string }>> = []
  for (const [index, blocker] of segment.blockers.entries()) {
    const radius = entry.playerRadius + entry.blockerRadius
    const blockerId = `${segment.id}:${index}`
    const active = blocker.fromMs < atMs && blocker.toMs >= atMs - STEP_MS
    const collides =
      active &&
      Math.max(beforeX, playerX) + radius >= blocker.minX &&
      Math.min(beforeX, playerX) - radius <= blocker.maxX
    if (collides) {
      squad = Math.max(0, squad - blocker.damage)
      collidedBlockers ??= new Set(state.collidedBlockerIds)
      collidedBlockers.add(blockerId)
      nearMissCandidates ??= new Set(state.nearMissCandidateIds)
      nearMissCandidates.delete(blockerId)
    }
    const nearRadius = radius + 24
    if (
      active &&
      !collides &&
      !(collidedBlockers?.has(blockerId) ?? state.collidedBlockerIds.has(blockerId)) &&
      !(closeCalls?.has(blockerId) ?? state.closeCallBlockerIds.has(blockerId)) &&
      Math.max(beforeX, playerX) + nearRadius >= blocker.minX &&
      Math.min(beforeX, playerX) - nearRadius <= blocker.maxX
    ) {
      nearMissCandidates ??= new Set(state.nearMissCandidateIds)
      nearMissCandidates.add(blockerId)
    }
    if (
      atMs > blocker.toMs + STEP_MS &&
      (nearMissCandidates?.has(blockerId) ?? state.nearMissCandidateIds.has(blockerId)) &&
      !(collidedBlockers?.has(blockerId) ?? state.collidedBlockerIds.has(blockerId))
    ) {
      nearMissCandidates ??= new Set(state.nearMissCandidateIds)
      nearMissCandidates.delete(blockerId)
      closeCalls ??= new Set(state.closeCallBlockerIds)
      closeCalls.add(blockerId)
      closeCallEvents.push({ kind: "close-call", blockerId })
    }
  }
  let collected: Set<string> | undefined
  for (const gate of collidedWaveGates) {
    collected ??= new Set(state.collectedGateIds)
    collected.add(gate.id)
  }
  let spawnedBlockers: Set<string> | undefined
  if (activating.length > 0) {
    spawnedBlockers = new Set(state.spawnedBlockerIds)
    for (const [index, blocker] of segment.blockers.entries())
      if (activating.includes(blocker)) spawnedBlockers.add(`${segment.id}:${index}`)
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
      events: [...stepped.events, ...gateResult.events, ...closeCallEvents],
    },
    atMs,
    collectedGateIds: collected ?? state.collectedGateIds,
    spawnedBlockerIds: spawnedBlockers ?? state.spawnedBlockerIds,
    closeCallBlockerIds: closeCalls ?? state.closeCallBlockerIds,
    nearMissCandidateIds: nearMissCandidates ?? state.nearMissCandidateIds,
    collidedBlockerIds: collidedBlockers ?? state.collidedBlockerIds,
  }
}
