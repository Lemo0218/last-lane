import type { ScoreBreakdown } from "./scoring"
import type { Transcript } from "./transcript"
import type { SimulationState } from "./types"

export const captureE2EGolden = (
  enabled: boolean,
  seed: number,
  transcript: Transcript,
  score: ScoreBreakdown,
  state: SimulationState,
  wave: number,
): void => {
  if (!enabled) return
  sessionStorage.setItem(
    "last-lane:e2e-golden",
    JSON.stringify({
      seed,
      transcript,
      expected: {
        score: Number(score.total),
        survivalTicks: transcript.endTick,
        breakdown: score,
        finalState: { playerX: state.playerX, squad: state.squad, wave },
        events: state.events,
      },
    }),
  )
}
