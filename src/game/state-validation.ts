import { MAX_ENTITIES } from "./config"
import type { SimulationState } from "./types"
import { requireNatural, requireUint32 } from "./validation"

export const validateSimulationState = (state: SimulationState): SimulationState => {
  requireUint32("seed", state.seed)
  if (state.zombies.length + state.projectiles.length + state.gates.length > MAX_ENTITIES) {
    throw new RangeError("entity count exceeds MAX_ENTITIES")
  }
  const fields = [
    ["elapsed milliseconds", state.elapsedMs],
    ["distance", state.distance],
    ["player position", state.playerX],
    ["squad", state.squad],
    ["maximum squad", state.maximumSquad],
    ["shot damage", state.shotDamage],
    ["fire interval", state.fireIntervalMs],
    ["recovery interval", state.recoveryEveryMs],
    ["recovery amount", state.recoveryAmount],
    ["fire cooldown", state.fireCooldownMs],
    ["recovery cooldown", state.recoveryCooldownMs],
    ["spawn cooldown", state.spawnCooldownMs],
    ["next entity id", state.nextEntityId],
    ["boss tier", state.lastBossTier],
    ["combo", state.combo],
    ["combo expiry", state.comboExpiresMs],
  ] as const
  for (const [field, value] of fields) requireNatural(field, value)
  for (const zombie of state.zombies) {
    requireNatural("zombie id", zombie.id)
    requireNatural("zombie position", zombie.x)
    requireNatural("zombie hp", zombie.hp)
    requireNatural("zombie damage", zombie.damage)
  }
  for (const projectile of state.projectiles) {
    requireNatural("projectile id", projectile.id)
    requireNatural("projectile position", projectile.x)
    requireNatural("projectile damage", projectile.damage)
  }
  for (const gate of state.gates) {
    requireNatural("gate id", gate.id)
    requireNatural("gate position", gate.x)
    requireNatural("gate level", gate.level)
  }
  return state
}
