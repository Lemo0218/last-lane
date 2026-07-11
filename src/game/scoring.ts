import type { Position, Score, Tick } from "./types"
import { score } from "./types"
import { requireNatural, requireSafeProduct, requireSafeSum } from "./validation"

export type RunMetrics = Readonly<{
  distance: Position
  basicKills: Score
  eliteKills: Score
  bosses: Score
  closeCalls: Score
  survivedMs: Tick
}>

export type ScoreBreakdown = Readonly<{
  distance: Score
  basicKills: Score
  elites: Score
  bosses: Score
  closeCalls: Score
  subtotal: Score
  survivalMultiplierPermille: number
  total: Score
}>

export const distanceScore = (distance: number): number =>
  Math.floor(requireNatural("distance", distance) / 100)
export const basicKillScore = (kills: number): number =>
  requireSafeProduct("basic kill score", requireNatural("basic kills", kills), 100)
export const eliteScore = (kills: number): number =>
  requireSafeProduct("elite score", requireNatural("elite kills", kills), 250)
export const bossScore = (kills: number): number =>
  requireSafeProduct("boss score", requireNatural("bosses", kills), 1000)
export const closeCallScore = (closeCalls: number): number =>
  requireSafeProduct("close call score", requireNatural("close calls", closeCalls), 50)

export const survivalMultiplierPermille = (survivedMs: number): number => {
  const tiers = Math.floor(requireNatural("survived milliseconds", survivedMs) / 30_000)
  return requireSafeSum("survival multiplier", [
    1000,
    requireSafeProduct("survival bonus", tiers, 250),
  ])
}

export const scoreRun = (metrics: RunMetrics): ScoreBreakdown => {
  const distance = distanceScore(metrics.distance)
  const basicKills = basicKillScore(metrics.basicKills)
  const elites = eliteScore(metrics.eliteKills)
  const bosses = bossScore(metrics.bosses)
  const closeCalls = closeCallScore(metrics.closeCalls)
  const subtotal = requireSafeSum("score subtotal", [
    distance,
    basicKills,
    elites,
    bosses,
    closeCalls,
  ])
  const multiplier = survivalMultiplierPermille(metrics.survivedMs)
  const scaledTotal = requireSafeProduct("scaled total", subtotal, multiplier)
  return {
    distance: score(distance),
    basicKills: score(basicKills),
    elites: score(elites),
    bosses: score(bosses),
    closeCalls: score(closeCalls),
    subtotal: score(subtotal),
    survivalMultiplierPermille: multiplier,
    total: score(Math.floor(scaledTotal / 1000)),
  }
}
