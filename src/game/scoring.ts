export type RunMetrics = Readonly<{
  distance: number
  basicKills: number
  eliteKills: number
  bosses: number
  closeCalls: number
  survivedMs: number
}>

export type ScoreBreakdown = Readonly<{
  distance: number
  basicKills: number
  elites: number
  bosses: number
  closeCalls: number
  subtotal: number
  survivalMultiplierPermille: number
  total: number
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
    distance,
    basicKills,
    elites,
    bosses,
    closeCalls,
    subtotal,
    survivalMultiplierPermille: multiplier,
    total: Math.floor(scaledTotal / 1000),
  }
}

import { requireNatural, requireSafeProduct, requireSafeSum } from "./validation"
