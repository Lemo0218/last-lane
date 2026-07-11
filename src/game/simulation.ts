import {
  difficultyAt,
  MAX_ENTITIES,
  RUN_DURATION_MS,
  STEP_MS,
  WORLD_MAX_X,
  WORLD_MIN_X,
} from "./config"
import { nextRandom } from "./rng"
import type {
  Projectile,
  RunStatus,
  SimulationEvent,
  SimulationInput,
  SimulationOverrides,
  SimulationState,
  UpgradeLevels,
  Zombie,
  ZombieKind,
} from "./types"

const PLAYER_SPEED_PER_STEP = 8
const PROJECTILE_SPEED_PER_STEP = 40
const ZOMBIE_SPEED_PER_STEP = 4
const COLLISION_DISTANCE = 12
const COMBO_WINDOW_MS = 2000

export const createSimulation = (
  seed: number,
  upgrades: UpgradeLevels,
  overrides: SimulationOverrides = {},
): SimulationState => {
  const maximumSquad = 3 + upgrades.troop
  return {
    seed,
    elapsedMs: 0,
    distance: 0,
    playerX: 0,
    squad: maximumSquad,
    maximumSquad,
    shotDamage: 10 + upgrades.damage * 5,
    fireIntervalMs: Math.max(200, 1000 - upgrades.fireRate * 200),
    recoveryEveryMs: upgrades.recovery > 0 ? 10_000 : 0,
    fireCooldownMs: 0,
    recoveryCooldownMs: upgrades.recovery > 0 ? 10_000 : 0,
    spawnCooldownMs: 1000,
    nextEntityId: 1,
    lastBossTier: 0,
    combo: 0,
    comboExpiresMs: 0,
    zombies: [],
    projectiles: [],
    events: [],
    status: "running",
    ...overrides,
  }
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
      nextExpiry = elapsedMs + COMBO_WINDOW_MS
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
  x: WORLD_MAX_X,
  hp: kind === "boss" ? (100 + tier * 25) * 5 : 100 + tier * 25,
  damage: kind === "boss" ? 2 : 1,
})

export const stepSimulation = (
  state: SimulationState,
  input: SimulationInput,
  deltaMs: number = STEP_MS,
): SimulationState => {
  if (input.paused || state.status !== "running") return state
  const elapsedMs = state.elapsedMs + deltaMs
  const playerX = Math.min(
    WORLD_MAX_X,
    Math.max(WORLD_MIN_X, state.playerX + input.moveX * PLAYER_SPEED_PER_STEP),
  )
  const events: SimulationEvent[] = []
  let nextId = state.nextEntityId
  let projectiles = state.projectiles.map((projectile) => ({
    ...projectile,
    x: projectile.x + PROJECTILE_SPEED_PER_STEP,
  }))
  let fireCooldownMs = Math.max(0, state.fireCooldownMs - deltaMs)
  if (
    fireCooldownMs === 0 &&
    state.zombies.length > 0 &&
    state.zombies.length + projectiles.length < MAX_ENTITIES
  ) {
    projectiles = [...projectiles, { id: nextId, x: playerX, damage: state.shotDamage }]
    events.push({ kind: "shot-fired", projectileId: nextId })
    nextId += 1
    fireCooldownMs = state.fireIntervalMs
  }
  const movedZombies = state.zombies.map((zombie) => ({
    ...zombie,
    x: Math.max(WORLD_MIN_X, zombie.x - ZOMBIE_SPEED_PER_STEP),
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
  let squad = Math.max(0, state.squad - damage)
  if (damage > 0) events.push({ kind: "squad-damaged", amount: damage })
  let recoveryCooldownMs = Math.max(0, state.recoveryCooldownMs - deltaMs)
  if (state.recoveryEveryMs > 0 && recoveryCooldownMs === 0 && squad < state.maximumSquad) {
    squad += 1
    recoveryCooldownMs = state.recoveryEveryMs
    events.push({ kind: "squad-recovered", amount: 1 })
  }
  const difficulty = difficultyAt(elapsedMs)
  let lastBossTier = state.lastBossTier
  let spawnCooldownMs = Math.max(0, state.spawnCooldownMs - deltaMs)
  let zombies = collisions.zombies.filter(
    (zombie) => Math.abs(zombie.x - playerX) > COLLISION_DISTANCE,
  )
  const capacity = zombies.length + collisions.projectiles.length < MAX_ENTITIES
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
    elapsedMs,
    distance: state.distance + Math.abs(input.moveX * PLAYER_SPEED_PER_STEP),
    playerX,
    squad,
    fireCooldownMs,
    recoveryCooldownMs,
    spawnCooldownMs,
    nextEntityId: nextId,
    lastBossTier,
    combo: collisions.combo,
    comboExpiresMs: collisions.comboExpiresMs,
    zombies,
    projectiles: collisions.projectiles,
    events: [...events, ...collisions.events],
    status,
  }
}
