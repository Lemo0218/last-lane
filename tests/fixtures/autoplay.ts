import { createTranscriptRecorder, type Transcript } from "../../src/game/transcript"
import { createWaveRuntime } from "../../src/game/wave-runtime"

export const generateTenMinuteWitness = (seed: number): Transcript => {
  let runtime = createWaveRuntime(undefined, 0, seed)
  const recorder = createTranscriptRecorder()
  for (let tick = 0; tick < 60_000; tick += 1) {
    const witnessIndex = Math.floor(runtime.active.production.atMs / 10)
    const input = runtime.active.witness.productionInputs[witnessIndex] ?? {
      moveX: 0,
      paused: false,
    }
    recorder.record(tick, input.moveX)
    runtime = runtime.step(input)
    const status = runtime.active.production.simulation.status
    if (status === "game-over" && tick + 1 !== 60_000)
      throw new Error(`autoplayer terminated at tick ${tick + 1}`)
  }
  const transcript = recorder.snapshot(60_000)
  if (transcript.entries.length > 2_400) throw new Error("autoplayer transcript exceeds cap")
  return transcript
}
