import {
  difficultyAt,
  MAX_ENTITIES,
  RUN_DURATION_MS,
  STEP_MS,
  WORLD_MAX_X,
  WORLD_MIN_X,
} from "./config"
import { collectGates } from "./gates"
import { nextRandom } from "./rng"
import { validateSimulationState } from "./state-validation"
import type {
  Projectile,
  RunStatus,
  SimulationEvent,
  SimulationInput,
  SimulationOverrides,
  SimulationState,
  Tick,
  UpgradeLevels,
  Zombie,
  ZombieKind,
} from "./types"
import { position, tick } from "./types"
import { requireNatural } from "./validation"

const PLAYER_SPEED_PER_STEP = 8
const PROJECTILE_SPEED_PER_STEP = 40
const COLLISION_DISTANCE = 12

export const createSimulation = (
  seed: number,
  upgrades: UpgradeLevels,
  overrides: SimulationOverrides = {},
): SimulationState => {
  requireNatural("seed", seed)
  requireNatural("troop upgrade", upgrades.troop)
  requireNatural("damage upgrade", upgrades.damage)
  requireNatural("fire rate upgrade", upgrades.fireRate)
  requireNatural("recovery upgrade", upgrades.recovery)
  const maximumSquad = 3 + upgrades.troop
  const initial: SimulationState = {
    seed,
    elapsedMs: tick(0),
    distance: position(0),
    playerX: position(0),
    squad: maximumSquad,
    maximumSquad,
    shotDamage: 10 + upgrades.damage * 5,
    fireIntervalMs: Math.max(200, 1000 - upgrades.fireRate * 200),
    recoveryEveryMs: upgrades.recovery > 0 ? 10_000 : 0,
    recoveryAmount: upgrades.recovery,
    fireCooldownMs: 0,
    recoveryCooldownMs: upgrades.recovery > 0 ? 10_000 : 0,
    spawnCooldownMs: 1000,
    nextEntityId: 1,
    lastBossTier: 0,
    combo: 0,
    comboExpiresMs: 0,
    zombies: [],
    projectiles: [],
    gates: [],
    events: [],
    status: "running",
  }
  return validateSimulationState({
    ...initial,
    ...overrides,
    elapsedMs: tick(overrides.elapsedMs ?? 0),
    distance: position(overrides.distance ?? 0),
    playerX: position(overrides.playerX ?? 0),
    zombies: (overrides.zombies ?? []).map((zombie) => ({ ...zombie, x: position(zombie.x) })),
    projectiles: (overrides.projectiles ?? []).map((projectile) => ({
      ...projectile,
      x: position(projectile.x),
    })),
    gates: (overrides.gates ?? []).map((gate) => ({ ...gate, x: position(gate.x) })),
  })
}

type CollisionResult = Readonly<{
  zombies: readonly Zombie[]
  projectiles: readonly Projectile[]
  events: readonly SimulationEvent[]
  combo: number
  comboExpiresMs: number
}>

const resolveProjectileCollisions = (
  zombies: readonly Zombie[],
  projectiles: readonly Projectile[],
  elapsedMs: number,
  combo: number,
  comboExpiresMs: number,
): CollisionResult => {
  const remainingZombies = [...zombies]
  const remainingProjectiles: Projectile[] = []
  const events: SimulationEvent[] = []
  let nextCombo = elapsedMs > comboExpiresMs ? 0 : combo
  let nextExpiry = comboExpiresMs
  for (const projectile of projectiles) {
    const targetIndex = remainingZombies.findIndex(
      (zombie) => Math.abs(zombie.x - projectile.x) <= COLLISION_DISTANCE,
    )
    if (targetIndex < 0) {
      if (projectile.x <= WORLD_MAX_X) remainingProjectiles.push(projectile)
      continue
    }
    const target = remainingZombies[targetIndex]
    if (target === undefined) continue
    const hp = target.hp - projectile.damage
    if (hp > 0) remainingZombies[targetIndex] = { ...target, hp }
    else {
      remainingZombies.splice(targetIndex, 1)
      nextCombo += 1
      nextExpiry = elapsedMs + 2000
      events.push({ kind: "zombie-killed", zombieKind: target.kind })
    }
  }
  return {
    zombies: remainingZombies,
    projectiles: remainingProjectiles,
    events,
    combo: nextCombo,
    comboExpiresMs: nextExpiry,
  }
}

const zombieForTier = (id: number, tier: number, kind: ZombieKind): Zombie => ({
  id,
  kind,
  x: position(WORLD_MAX_X),
  hp: kind === "boss" ? (100 + tier * 25) * 5 : 100 + tier * 25,
  damage: kind === "boss" ? 2 : 1,
})

export const stepSimulation = (
  state: SimulationState,
  input: SimulationInput,
  deltaMs: Tick = tick(STEP_MS),
): SimulationState => {
  if (deltaMs !== STEP_MS) throw new RangeError("deltaMs must equal STEP_MS")
  if (input.paused || state.status !== "running") return state
  if (state.squad === 0) return { ...state, events: [{ kind: "game-over" }], status: "game-over" }
  if (input.moveX !== -1 && input.moveX !== 0 && input.moveX !== 1) {
    throw new RangeError("moveX must be -1, 0, or 1")
  }
  const elapsedMs = state.elapsedMs + deltaMs
  const playerX = Math.min(
    WORLD_MAX_X,
    Math.max(WORLD_MIN_X, state.playerX + input.moveX * PLAYER_SPEED_PER_STEP),
  )
  const gates = collectGates(state, playerX)
  const events: SimulationEvent[] = [...gates.events]
  let nextId = state.nextEntityId
  let projectiles: Projectile[] = state.projectiles.map((projectile) => ({
    ...projectile,
    x: position(projectile.x + PROJECTILE_SPEED_PER_STEP),
  }))
  let fireCooldownMs = Math.max(0, state.fireCooldownMs - deltaMs)
  if (
    fireCooldownMs === 0 &&
    state.zombies.length > 0 &&
    state.zombies.length + projectiles.length + state.gates.length < MAX_ENTITIES
  ) {
    projectiles = [...projectiles, { id: nextId, x: position(playerX), damage: gates.shotDamage }]
    events.push({ kind: "shot-fired", projectileId: nextId })
    nextId += 1
    fireCooldownMs = gates.fireIntervalMs
  }
  const movedZombies: Zombie[] = state.zombies.map((zombie) => ({
    ...zombie,
    x: position(Math.max(WORLD_MIN_X, zombie.x - 4)),
  }))
  const collisions = resolveProjectileCollisions(
    movedZombies,
    projectiles,
    elapsedMs,
    state.combo,
    state.comboExpiresMs,
  )
  const attackers = collisions.zombies.filter(
    (zombie) => Math.abs(zombie.x - playerX) <= COLLISION_DISTANCE,
  )
  const damage = attackers.reduce((total, zombie) => total + zombie.damage, 0)
  let squad = Math.max(0, gates.squad - damage)
  if (damage > 0) events.push({ kind: "squad-damaged", amount: damage })
  let recoveryCooldownMs = Math.max(0, state.recoveryCooldownMs - deltaMs)
  if (
    squad > 0 &&
    gates.recoveryEveryMs > 0 &&
    recoveryCooldownMs === 0 &&
    squad < gates.maximumSquad
  ) {
    const recovery = Math.min(gates.recoveryAmount, gates.maximumSquad - squad)
    squad += recovery
    recoveryCooldownMs = gates.recoveryEveryMs
    events.push({ kind: "squad-recovered", amount: recovery })
  }
  const difficulty = difficultyAt(elapsedMs)
  let lastBossTier = state.lastBossTier
  let spawnCooldownMs = Math.max(0, state.spawnCooldownMs - deltaMs)
  let zombies = collisions.zombies.filter(
    (zombie) => Math.abs(zombie.x - playerX) > COLLISION_DISTANCE,
  )
  const capacity =
    zombies.length + collisions.projectiles.length + gates.gates.length < MAX_ENTITIES
  if (difficulty.bossDue && difficulty.tier !== lastBossTier && capacity) {
    zombies = [...zombies, zombieForTier(nextId, difficulty.tier, "boss")]
    events.push({ kind: "boss-spawned", zombieId: nextId })
    nextId += 1
    lastBossTier = difficulty.tier
  } else if (spawnCooldownMs === 0 && capacity) {
    const random = nextRandom(state.seed)
    zombies = [
      ...zombies,
      zombieForTier(nextId, difficulty.tier, random.value % 8 === 0 ? "elite" : "basic"),
    ]
    nextId += 1
    spawnCooldownMs = difficulty.spawnIntervalMs
  }
  let status: RunStatus = state.status
  if (squad === 0) {
    status = "game-over"
    events.push({ kind: "game-over" })
  } else if (elapsedMs >= RUN_DURATION_MS) {
    status = "complete"
    events.push({ kind: "run-completed" })
  }
  return {
    ...state,
    seed: nextRandom(state.seed).seed,
    elapsedMs: tick(elapsedMs),
    distance: position(state.distance + Math.abs(input.moveX * PLAYER_SPEED_PER_STEP)),
    playerX: position(playerX),
    squad,
    maximumSquad: gates.maximumSquad,
    shotDamage: gates.shotDamage,
    fireIntervalMs: gates.fireIntervalMs,
    recoveryEveryMs: gates.recoveryEveryMs,
    recoveryAmount: gates.recoveryAmount,
    fireCooldownMs,
    recoveryCooldownMs,
    spawnCooldownMs,
    nextEntityId: nextId,
    lastBossTier,
    combo: collisions.combo,
    comboExpiresMs: collisions.comboExpiresMs,
    zombies,
    projectiles: collisions.projectiles,
    gates: gates.gates,
    events: [...events, ...collisions.events],
    status,
  }
}
