import type { HudStats } from "../ui/Hud"
import type { SimulationState } from "./types"
import type { ActiveWave } from "./wave-runtime"

export const INITIAL_STATS: HudStats = {
  score: 0,
  elapsedMs: 0,
  squad: 3,
  maximumSquad: 3,
  combo: 0,
  difficulty: 1,
}

export const scoreForCombat = (state: SimulationState, kills: number): number =>
  Math.floor(Number(state.distance) / 8) + kills * 100 + state.combo * 25

export const statsOf = (state: SimulationState, kills: number, active: ActiveWave): HudStats => ({
  score: scoreForCombat(state, kills),
  elapsedMs: active.elapsedBeforeMs + active.production.atMs,
  squad: state.squad,
  maximumSquad: state.maximumSquad,
  combo: state.combo,
  difficulty: active.index + 1,
})
