import type { Gate, SimulationEvent, SimulationState } from "./types"
import { requireNatural, requireSafeProduct, requireSafeSum } from "./validation"

const COLLISION_DISTANCE = 12

export type GateResult = Readonly<{
  gates: readonly Gate[]
  maximumSquad: number
  squad: number
  shotDamage: number
  fireIntervalMs: number
  recoveryEveryMs: number
  recoveryAmount: number
  events: readonly SimulationEvent[]
}>

export const collectGates = (state: SimulationState, playerX: number): GateResult => {
  const collected = state.gates.filter((gate) => Math.abs(gate.x - playerX) <= COLLISION_DISTANCE)
  const remaining = state.gates.filter((gate) => Math.abs(gate.x - playerX) > COLLISION_DISTANCE)
  let maximumSquad = state.maximumSquad
  let squad = state.squad
  let shotDamage = state.shotDamage
  let fireIntervalMs = state.fireIntervalMs
  let recoveryEveryMs = state.recoveryEveryMs
  let recoveryAmount = state.recoveryAmount
  const events: SimulationEvent[] = []
  for (const gate of collected) {
    requireNatural("gate level", gate.level)
    switch (gate.kind) {
      case "troop":
        maximumSquad = requireSafeSum("maximum squad", [maximumSquad, gate.level])
        squad = requireSafeSum("squad", [squad, gate.level])
        break
      case "damage":
        shotDamage = requireSafeSum("shot damage", [
          shotDamage,
          requireSafeProduct("damage gate", gate.level, 5),
        ])
        break
      case "fire-rate":
        fireIntervalMs = Math.max(
          200,
          fireIntervalMs - requireSafeProduct("fire-rate gate", gate.level, 200),
        )
        break
      case "recovery":
        recoveryAmount = requireSafeSum("recovery amount", [recoveryAmount, gate.level])
        recoveryEveryMs = 10_000
        break
      default:
        assertNeverGate(gate.kind)
    }
    events.push({ kind: "gate-collected", gateKind: gate.kind, level: gate.level })
  }
  return {
    gates: remaining,
    maximumSquad,
    squad,
    shotDamage,
    fireIntervalMs,
    recoveryEveryMs,
    recoveryAmount,
    events,
  }
}

const assertNeverGate = (kind: never): never => {
  throw new RangeError(`unknown gate kind: ${String(kind)}`)
}
