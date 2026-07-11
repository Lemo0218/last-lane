import { createEffectPool, type VisibleEffect } from "./effect-pool"
import { stepSimulation } from "./simulation"
import type { SimulationState } from "./types"
import { position } from "./types"

export type StressFrame = Readonly<{
  state: SimulationState
  effects: readonly VisibleEffect[]
  step: () => StressFrame
}>

const damageEvents = Array.from({ length: 8 }, () => ({
  kind: "squad-damaged" as const,
  amount: 1,
}))

export const createStressFrame = (source: SimulationState): StressFrame => {
  const state: SimulationState = {
    ...source,
    zombies: [],
    projectiles: [],
    gates: Array.from({ length: 128 }, (_, index) => ({
      id: index + 1,
      kind: "damage" as const,
      x: position(1_000),
      level: 1,
    })),
    nextEntityId: 129,
  }
  const effects = createEffectPool().step(damageEvents, 0).effects
  const frame = (current: SimulationState): StressFrame => ({
    state: current,
    effects,
    step: () => frame(stepSimulation(current, { moveX: 0, paused: false })),
  })
  return frame(state)
}
