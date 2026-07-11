import { STEP_MS } from "./config"

export type FrameClock = Readonly<{ previous: number; accumulator: number }>
export type FrameAdvance = Readonly<{ clock: FrameClock; steps: number }>

export const advanceFrame = (clock: FrameClock, now: number, running: boolean): FrameAdvance => {
  if (!running) return { clock: { previous: now, accumulator: 0 }, steps: 0 }
  const elapsed = Math.min(100, Math.max(0, now - clock.previous))
  const accumulated = clock.accumulator + elapsed
  const steps = Math.min(8, Math.floor(accumulated / STEP_MS))
  return {
    clock: {
      previous: now,
      accumulator: steps === 8 ? 0 : accumulated - steps * STEP_MS,
    },
    steps,
  }
}
