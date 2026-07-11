export const STEP_MS = 10 as const
export const RUN_DURATION_MS = 180_000 as const
export const RANKED_RUN_LIMIT_MS = 600_000 as const
export const DIFFICULTY_TIER_MS = 30_000 as const
export const BOSS_EVERY_TIERS = 2 as const
export const MAX_ENTITIES = 128 as const
export const MAX_VISIBLE_EFFECTS = 32 as const
export const WORLD_MIN_X = 0 as const
export const WORLD_MAX_X = 1000 as const

export type Difficulty = Readonly<{
  tier: number
  spawnIntervalMs: number
  zombieHp: number
  bossDue: boolean
}>

export const difficultyAt = (elapsedMs: number): Difficulty => {
  const tier = Math.floor(elapsedMs / DIFFICULTY_TIER_MS)
  return {
    tier,
    spawnIntervalMs: Math.max(250, 1200 - tier * 100),
    zombieHp: 100 + tier * 25,
    bossDue: tier > 0 && tier % BOSS_EVERY_TIERS === 0,
  }
}
