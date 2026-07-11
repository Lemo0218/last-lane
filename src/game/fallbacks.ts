import type { EntryState, WaveSegment, WaveWitness, WitnessFrame } from "./waves"
import { advanceMotion, NORMAL_HORIZON_MS, SOLVER_STEP_MS } from "./waves"

export type FallbackPattern = Readonly<{
  id: string
  bounds: Readonly<{
    squad: readonly [number, number]
    x: readonly [number, "playfieldWidth"]
    velocity: readonly [number, number]
    playfieldWidth: readonly [number, number]
    collisionRadii: readonly [number, number]
    precedingSegments: readonly [number, number]
  }>
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
  const productionInputs = Array.from({ length: NORMAL_HORIZON_MS / 10 }, () => ({
    moveX: 0 as const,
    paused: false,
  }))
  return { frames, productionInputs, finalSquad: entry.squad, collectedGateIds: [] }
}

export const fallbackPatterns: readonly FallbackPattern[] = [
  {
    id: "open-corridor",
    bounds: {
      squad: [1, Number.MAX_SAFE_INTEGER],
      x: [0, "playfieldWidth"],
      velocity: [-40, 40],
      playfieldWidth: [1, 1_000],
      collisionRadii: [0, 500],
      precedingSegments: [0, 2],
    },
    precondition: (entry) =>
      Object.values(entry.upgrades).every(Number.isFinite) &&
      Object.values(entry.upgrades).every((level) => level >= 0) &&
      [
        entry.squad,
        entry.x,
        entry.velocity,
        entry.playfieldWidth,
        entry.playerRadius,
        entry.blockerRadius,
      ].every(Number.isFinite) &&
      entry.squad >= 1 &&
      entry.velocity >= -40 &&
      entry.velocity <= 40 &&
      entry.playerRadius >= 0 &&
      entry.blockerRadius >= 0 &&
      entry.precedingSegments.length <= 2 &&
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
