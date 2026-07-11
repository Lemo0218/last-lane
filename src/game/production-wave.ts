import { STEP_MS } from "./config"
import { createSimulation, stepSimulation } from "./simulation"
import type { Gate, SimulationInput, SimulationState } from "./types"
import { position, tick } from "./types"
import type { EntryState, WaveSegment } from "./waves"

export type ProductionWaveState = Readonly<{
  simulation: SimulationState
  atMs: number
  collectedGateIds: ReadonlySet<string>
}>

export const createProductionWaveState = (entry: EntryState): ProductionWaveState => ({
  simulation: createSimulation(1, entry.upgrades, {
    playerX: entry.x,
    squad: entry.squad,
    maximumSquad: Math.max(entry.squad, 3 + entry.upgrades.troop),
    spawnCooldownMs: Number.MAX_SAFE_INTEGER,
  }),
  atMs: 0,
  collectedGateIds: new Set(),
})

const activeGates = (
  segment: WaveSegment,
  collected: ReadonlySet<string>,
  atMs: number,
): readonly Gate[] =>
  segment.gates.flatMap((gate, index) =>
    !collected.has(gate.id) && gate.atMs <= atMs && atMs < gate.atMs + STEP_MS
      ? [{ id: index + 1, kind: gate.kind, x: position(gate.x), level: gate.level }]
      : [],
  )

export const stepProductionWave = (
  entry: EntryState,
  segment: WaveSegment,
  state: ProductionWaveState,
  input: SimulationInput,
): ProductionWaveState => {
  const atMs = state.atMs + STEP_MS
  const beforeX = state.simulation.playerX
  const gates = activeGates(segment, state.collectedGateIds, atMs)
  const stepped = stepSimulation({ ...state.simulation, gates }, input, tick(STEP_MS))
  const playerX = position(Math.max(0, Math.min(entry.playfieldWidth, stepped.playerX)))
  let squad = stepped.squad
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
  for (const event of stepped.events) {
    if (event.kind !== "gate-collected") continue
    const gate = segment.gates.find(
      (candidate) =>
        candidate.atMs <= atMs &&
        atMs < candidate.atMs + STEP_MS &&
        candidate.kind === event.gateKind,
    )
    if (gate !== undefined) collected.add(gate.id)
  }
  return {
    simulation: { ...stepped, playerX, squad, gates: [] },
    atMs,
    collectedGateIds: collected,
  }
}
