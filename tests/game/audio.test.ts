import { describe, expect, it } from "vitest"

import { createGameAudio, type SynthContext } from "../../src/game/audio"

describe("game audio", () => {
  it("stays silent before gesture unlock and honors mute before closing", async () => {
    // Given: a synthesized audio context with observable calls
    const calls: string[] = []
    const synth: SynthContext = {
      resume: async () => {
        calls.push("resume")
      },
      close: async () => {
        calls.push("close")
      },
      tone: (frequency) => {
        calls.push(`tone:${frequency}`)
      },
    }
    const audio = createGameAudio(() => synth)

    // When: effects play before and after unlock, then while muted
    audio.play([{ kind: "shot-fired", projectileId: 1 }])
    await audio.unlock()
    audio.play([{ kind: "shot-fired", projectileId: 2 }])
    audio.setMuted(true)
    audio.play([{ kind: "squad-damaged", amount: 1 }])
    await audio.close()

    // Then: only the unlocked unmuted effect reaches the context and cleanup closes it
    expect(calls).toEqual(["resume", "tone:180", "close"])
  })
})
