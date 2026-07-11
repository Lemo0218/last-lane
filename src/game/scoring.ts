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

export const distanceScore = (distance: number): number => Math.floor(distance / 100)
export const basicKillScore = (kills: number): number => kills * 100
export const eliteScore = (kills: number): number => kills * 250
export const bossScore = (kills: number): number => kills * 1000
export const closeCallScore = (closeCalls: number): number => closeCalls * 50

export const survivalMultiplierPermille = (survivedMs: number): number =>
  1000 + Math.floor(survivedMs / 30_000) * 250

export const scoreRun = (metrics: RunMetrics): ScoreBreakdown => {
  const distance = distanceScore(metrics.distance)
  const basicKills = basicKillScore(metrics.basicKills)
  const elites = eliteScore(metrics.eliteKills)
  const bosses = bossScore(metrics.bosses)
  const closeCalls = closeCallScore(metrics.closeCalls)
  const subtotal = distance + basicKills + elites + bosses + closeCalls
  const multiplier = survivalMultiplierPermille(metrics.survivedMs)
  return {
    distance,
    basicKills,
    elites,
    bosses,
    closeCalls,
    subtotal,
    survivalMultiplierPermille: multiplier,
    total: Math.floor((subtotal * multiplier) / 1000),
  }
}
