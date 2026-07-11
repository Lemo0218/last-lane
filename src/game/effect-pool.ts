import { MAX_VISIBLE_EFFECTS } from "./config"
import type { SimulationEvent } from "./types"

export type VisibleEffect = Readonly<{
  angle: number
  remainingMs: number
  moving: boolean
}>

export type EffectPool = Readonly<{
  effects: readonly VisibleEffect[]
  step: (events: readonly SimulationEvent[], deltaMs: number) => EffectPool
}>

const nextPool = (
  effects: readonly VisibleEffect[],
  events: readonly SimulationEvent[],
  deltaMs: number,
  reducedMotion: boolean,
): EffectPool => {
  const retained = effects
    .map((effect) => ({ ...effect, remainingMs: effect.remainingMs - deltaMs }))
    .filter((effect) => effect.remainingMs > 0)
  const damageEvents = events.filter((event) => event.kind === "squad-damaged").length
  const available = Math.max(0, MAX_VISIBLE_EFFECTS - retained.length)
  const additions = Math.min(available, damageEvents * (reducedMotion ? 1 : 4))
  const added = Array.from({ length: additions }, (_, index) => ({
    angle: (Math.PI * 2 * index) / Math.max(1, additions),
    remainingMs: reducedMotion ? 150 : 1_000,
    moving: !reducedMotion,
  }))
  const next = [...retained, ...added]
  return {
    effects: next,
    step: (futureEvents, futureDeltaMs) =>
      nextPool(next, futureEvents, futureDeltaMs, reducedMotion),
  }
}

export const createEffectPool = (reducedMotion = false): EffectPool =>
  nextPool([], [], 0, reducedMotion)
