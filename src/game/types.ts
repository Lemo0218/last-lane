export type ZombieKind = "basic" | "elite" | "boss"
export type GateKind = "troop" | "damage" | "fire-rate" | "recovery"
export type RunStatus = "running" | "game-over" | "complete"

import { requireNatural } from "./validation"

declare const tickBrand: unique symbol
declare const positionBrand: unique symbol
declare const scoreBrand: unique symbol
export type Tick = number & { readonly [tickBrand]: "Tick" }
export type Position = number & { readonly [positionBrand]: "Position" }
export type Score = number & { readonly [scoreBrand]: "Score" }

export const tick = (value: number): Tick => requireNatural("tick", value) as Tick
export const position = (value: number): Position => requireNatural("position", value) as Position
export const score = (value: number): Score => requireNatural("score", value) as Score

export type UpgradeLevels = Readonly<{
  troop: number
  damage: number
  fireRate: number
  recovery: number
}>

export type Zombie = Readonly<{
  id: number
  kind: ZombieKind
  x: Position
  hp: number
  damage: number
}>

export type Projectile = Readonly<{
  id: number
  x: Position
  damage: number
}>

export type Gate = Readonly<{ id: number; kind: GateKind; x: Position; level: number }>

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
  moveX: -1 | 0 | 1
  paused: boolean
}>

export type SimulationState = Readonly<{
  seed: number
  elapsedMs: Tick
  distance: Position
  playerX: Position
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

type RawZombie = Omit<Zombie, "x"> & Readonly<{ x: number }>
type RawProjectile = Omit<Projectile, "x"> & Readonly<{ x: number }>
type RawGate = Omit<Gate, "x"> & Readonly<{ x: number }>
export type SimulationOverrides = Partial<
  Omit<SimulationState, "elapsedMs" | "distance" | "playerX" | "zombies" | "projectiles" | "gates">
> &
  Readonly<{
    elapsedMs?: number
    distance?: number
    playerX?: number
    zombies?: readonly RawZombie[]
    projectiles?: readonly RawProjectile[]
    gates?: readonly RawGate[]
  }>
