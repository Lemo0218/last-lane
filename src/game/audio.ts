import type { SimulationEvent } from "./types"

export type GameAudio = Readonly<{
  unlock: () => Promise<void>
  setMuted: (muted: boolean) => void
  play: (events: readonly SimulationEvent[]) => void
  close: () => Promise<void>
}>

export const createGameAudio = (): GameAudio => {
  let context: AudioContext | undefined
  let muted = false
  const tone = (frequency: number, duration: number): void => {
    if (context === undefined || muted) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.035, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + duration)
  }
  return {
    unlock: async () => {
      context ??= new AudioContext()
      await context.resume()
    },
    setMuted: (nextMuted) => {
      muted = nextMuted
    },
    play: (events) => {
      for (const event of events) {
        if (event.kind === "shot-fired") tone(180, 0.04)
        if (event.kind === "zombie-killed") tone(event.zombieKind === "boss" ? 80 : 420, 0.1)
        if (event.kind === "gate-collected") tone(720, 0.16)
        if (event.kind === "squad-damaged") tone(95, 0.18)
      }
    },
    close: async () => {
      if (context !== undefined) await context.close()
    },
  }
}
