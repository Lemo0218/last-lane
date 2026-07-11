import { STEP_MS } from "./config"
import { collectGates } from "./gates"
import { createSimulation, stepSimulation } from "./simulation"
import type { Gate, SimulationInput, SimulationState } from "./types"
import { position, tick, velocity } from "./types"
import type { EntryState, WaveSegment } from "./waves"

export type ProductionWaveState = Readonly<{
  simulation: SimulationState
  atMs: number
  collectedGateIds: ReadonlySet<string>
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
})

export const stepProductionWave = (
  entry: EntryState,
  segment: WaveSegment,
  state: ProductionWaveState,
  input: SimulationInput,
): ProductionWaveState => {
  const atMs = state.atMs + STEP_MS
  const beforeX = state.simulation.playerX
  const stepped = stepSimulation({ ...state.simulation, gates: [] }, input, tick(STEP_MS))
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
  }
}
