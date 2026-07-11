import type { ProductionWaveState } from "./production-wave"
import { createProductionWaveState, stepProductionWave } from "./production-wave"
import { generateWaveCandidate } from "./segment-generator"
import { type SolverResult, solveWave } from "./solver"
import type { SimulationInput, SimulationState, UpgradeLevels } from "./types"
import type { CommittedSegment, EntryState, WaveSegment } from "./waves"

export type WaveRuntimeDependencies = Readonly<{
  candidate: (entry: EntryState, index: number) => WaveSegment
  solve: (entry: EntryState, segment: WaveSegment) => SolverResult
}>

export type ActiveWave = Readonly<{
  segment: WaveSegment
  production: ProductionWaveState
  index: number
  usedFallback: boolean
  elapsedBeforeMs: number
}>

export type WaveRuntime = Readonly<{
  active: ActiveWave
  step: (input: SimulationInput) => WaveRuntime
}>

const upgradesOf = (state: SimulationState): UpgradeLevels => ({
  troop: Math.max(0, state.maximumSquad - 3),
  damage: Math.max(0, Math.floor((state.shotDamage - 10) / 5)),
  fireRate: Math.max(0, Math.floor((1000 - state.fireIntervalMs) / 200)),
  recovery: state.recoveryAmount,
})

const entryOf = (
  state: SimulationState,
  precedingSegments: readonly CommittedSegment[],
): EntryState => ({
  squad: state.squad,
  upgrades: upgradesOf(state),
  x: state.playerX,
  velocity: state.playerVelocity,
  playfieldWidth: 1000,
  playerRadius: 12,
  blockerRadius: 12,
  precedingSegments: precedingSegments.slice(-2),
})

const activate = (
  dependencies: WaveRuntimeDependencies,
  entry: EntryState,
  index: number,
  elapsedBeforeMs: number,
): ActiveWave => {
  const result = dependencies.solve(entry, dependencies.candidate(entry, index))
  return {
    segment: result.segment,
    production: createProductionWaveState(entry),
    index,
    usedFallback: result.kind === "fallback",
    elapsedBeforeMs,
  }
}

const runtimeFrom = (
  dependencies: WaveRuntimeDependencies,
  active: ActiveWave,
  preceding: readonly CommittedSegment[],
): WaveRuntime => ({
  active,
  step: (input) => {
    const production = stepProductionWave(
      entryOf(active.production.simulation, preceding),
      active.segment,
      active.production,
      input,
    )
    if (production.atMs < active.segment.horizonMs)
      return runtimeFrom(dependencies, { ...active, production }, preceding)
    const committed: CommittedSegment = {
      id: active.segment.id,
      exitX: production.simulation.playerX,
      exitVelocity: production.simulation.playerVelocity,
      survived: production.simulation.squad > 0,
    }
    const nextPreceding = [...preceding, committed].slice(-2)
    const nextEntry = entryOf(production.simulation, nextPreceding)
    return runtimeFrom(
      dependencies,
      activate(
        dependencies,
        nextEntry,
        active.index + 1,
        active.elapsedBeforeMs + active.segment.horizonMs,
      ),
      nextPreceding,
    )
  },
})

const DEFAULT_DEPENDENCIES: WaveRuntimeDependencies = {
  candidate: generateWaveCandidate,
  solve: (entry, segment) => solveWave(entry, segment, { budgetMs: 40 }),
}

export const createWaveRuntime = (
  dependencies: WaveRuntimeDependencies = DEFAULT_DEPENDENCIES,
): WaveRuntime => {
  const entry: EntryState = {
    squad: 3,
    upgrades: { troop: 0, damage: 0, fireRate: 0, recovery: 0 },
    x: 500,
    velocity: 0,
    playfieldWidth: 1000,
    playerRadius: 12,
    blockerRadius: 12,
    precedingSegments: [],
  }
  return runtimeFrom(dependencies, activate(dependencies, entry, 0, 0), [])
}
