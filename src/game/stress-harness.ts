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
    zombies: Array.from({ length: 64 }, (_, index) => ({
      id: index + 1,
      kind: "basic" as const,
      x: position(1_000),
      hp: 100,
      damage: 1,
    })),
    projectiles: Array.from({ length: 64 }, (_, index) => ({
      id: index + 65,
      x: position(0),
      damage: 1,
    })),
    gates: [],
    nextEntityId: 129,
  }
  const effects = createEffectPool().step(damageEvents, 0).effects
  const frame = (current: SimulationState): StressFrame => ({
    state: current,
    effects,
    step: () => frame(stepSimulation(current, { moveX: 0, paused: true })),
  })
  return frame(state)
}
