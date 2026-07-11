import type { EntryState, WaveSegment, WaveWitness, WitnessFrame } from "./waves"
import { advanceMotion, NORMAL_HORIZON_MS, SOLVER_STEP_MS } from "./waves"

export type FallbackPattern = Readonly<{
  id: string
  precondition: (entry: EntryState) => boolean
  segment: (entry: EntryState) => WaveSegment
  witness: (entry: EntryState) => WaveWitness
}>

const openSegment = (): WaveSegment => ({
  id: "fallback-open-corridor",
  horizonMs: NORMAL_HORIZON_MS,
  blockers: [],
  gates: [],
})

const neutralWitness = (entry: EntryState): WaveWitness => {
  const frames: WitnessFrame[] = []
  let x = entry.x
  let velocity = entry.velocity
  for (let atMs = SOLVER_STEP_MS; atMs <= NORMAL_HORIZON_MS; atMs += SOLVER_STEP_MS) {
    const motion = advanceMotion(x, velocity, 0, entry.playfieldWidth)
    x = motion.x
    velocity = motion.velocity
    frames.push({ atMs, move: 0, x, velocity, squad: entry.squad })
  }
  return { frames, finalSquad: entry.squad, collectedGateIds: [] }
}

export const fallbackPatterns: readonly FallbackPattern[] = [
  {
    id: "open-corridor",
    precondition: (entry) =>
      entry.squad >= 1 &&
      entry.playfieldWidth > entry.playerRadius * 2 &&
      entry.x >= 0 &&
      entry.x <= entry.playfieldWidth,
    segment: openSegment,
    witness: neutralWitness,
  },
] as const

export const fallbackFor = (
  entry: EntryState,
): Readonly<{
  patternId: string
  segment: WaveSegment
  witness: WaveWitness
}> => {
  const pattern = fallbackPatterns.find((candidate) => candidate.precondition(entry))
  if (pattern === undefined) throw new RangeError("entry state has no safe fallback")
  return { patternId: pattern.id, segment: pattern.segment(entry), witness: pattern.witness(entry) }
}
