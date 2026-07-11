export type ZombieKind = "basic" | "elite" | "boss"
export type GateKind = "troop" | "damage" | "fire-rate" | "recovery"
export type RunStatus = "running" | "game-over" | "complete"

import { requireNatural } from "./validation"

export type Tick = Readonly<{ value: number; unit: "tick" }>
export type Position = Readonly<{ value: number; unit: "position" }>
export type Score = Readonly<{ value: number; unit: "score" }>

export const tick = (value: number): Tick => ({
  value: requireNatural("tick", value),
  unit: "tick",
})
export const position = (value: number): Position => ({
  value: requireNatural("position", value),
  unit: "position",
})
export const score = (value: number): Score => ({
  value: requireNatural("score", value),
  unit: "score",
})

export type UpgradeLevels = Readonly<{
  troop: number
  damage: number
  fireRate: number
  recovery: number
}>

export type Zombie = Readonly<{
  id: number
  kind: ZombieKind
  x: number
  hp: number
  damage: number
}>

export type Projectile = Readonly<{
  id: number
  x: number
  damage: number
}>

export type Gate = Readonly<{ id: number; kind: GateKind; x: number; level: number }>

export type SimulationEvent =
  | Readonly<{ kind: "shot-fired"; projectileId: number }>
  | Readonly<{ kind: "zombie-killed"; zombieKind: ZombieKind }>
  | Readonly<{ kind: "squad-damaged"; amount: number }>
  | Readonly<{ kind: "squad-recovered"; amount: number }>
  | Readonly<{ kind: "boss-spawned"; zombieId: number }>
  | Readonly<{ kind: "gate-collected"; gateKind: GateKind; level: number }>
  | Readonly<{ kind: "run-completed" }>
  | Readonly<{ kind: "game-over" }>

export type SimulationInput = Readonly<{
  moveX: number
  paused: boolean
}>

export type SimulationState = Readonly<{
  seed: number
  elapsedMs: number
  distance: number
  playerX: number
  squad: number
  maximumSquad: number
  shotDamage: number
  fireIntervalMs: number
  recoveryEveryMs: number
  recoveryAmount: number
  fireCooldownMs: number
  recoveryCooldownMs: number
  spawnCooldownMs: number
  nextEntityId: number
  lastBossTier: number
  combo: number
  comboExpiresMs: number
  zombies: readonly Zombie[]
  projectiles: readonly Projectile[]
  gates: readonly Gate[]
  events: readonly SimulationEvent[]
  status: RunStatus
}>

export type SimulationOverrides = Partial<SimulationState>
