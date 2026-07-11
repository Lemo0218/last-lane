import { RUN_DURATION_MS } from "./config"
import type { RunStatus, SimulationEvent } from "./types"

export type RunStatusResult = Readonly<{
  status: RunStatus
  event?: SimulationEvent
}>

export const resolveRunStatus = (
  current: RunStatus,
  squad: number,
  elapsedMs: number,
): RunStatusResult => {
  if (squad === 0) return { status: "game-over", event: { kind: "game-over" } }
  if (elapsedMs >= RUN_DURATION_MS) return { status: "complete", event: { kind: "run-completed" } }
  return { status: current }
}
