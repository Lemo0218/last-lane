export type ZombieKind = "basic" | "elite" | "boss"
export type RunStatus = "running" | "game-over" | "complete"

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

export type SimulationEvent =
  | Readonly<{ kind: "shot-fired"; projectileId: number }>
  | Readonly<{ kind: "zombie-killed"; zombieKind: ZombieKind }>
  | Readonly<{ kind: "squad-damaged"; amount: number }>
  | Readonly<{ kind: "squad-recovered"; amount: number }>
  | Readonly<{ kind: "boss-spawned"; zombieId: number }>
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
  fireCooldownMs: number
  recoveryCooldownMs: number
  spawnCooldownMs: number
  nextEntityId: number
  lastBossTier: number
  combo: number
  comboExpiresMs: number
  zombies: readonly Zombie[]
  projectiles: readonly Projectile[]
  events: readonly SimulationEvent[]
  status: RunStatus
}>

export type SimulationOverrides = Partial<SimulationState>
