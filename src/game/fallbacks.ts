import type { FallbackPattern } from "./fallback-types"
import type { EntryState, WaveSegment, WaveWitness, WitnessFrame } from "./waves"
import { BOSS_HORIZON_MS, NORMAL_HORIZON_MS, SOLVER_STEP_MS } from "./waves"

export type { FallbackPattern } from "./fallback-types"

const fallbackSegment = (entry: EntryState, waveIndex = 1): WaveSegment => {
  const movesLeft = entry.x <= entry.playfieldWidth / 2
  const gateKinds = ["troop", "damage", "fire-rate", "recovery"] as const
  const boss = waveIndex % 5 === 0
  const enemyX = movesLeft ? entry.playfieldWidth * 0.9 : entry.playfieldWidth * 0.1
  return {
    id: `fallback-${boss ? "boss" : "wave"}-${waveIndex}`,
    horizonMs: boss ? BOSS_HORIZON_MS : NORMAL_HORIZON_MS,
    blockers: [
      {
        fromMs: 1_500,
        toMs: 1_500,
        minX: Math.max(0, enemyX - 20),
        maxX: Math.min(entry.playfieldWidth, enemyX + 20),
        damage: boss ? 2 : 1,
      },
    ],
    gates: [
      {
        id: `fallback-gate-${waveIndex}`,
        atMs: 4_200,
        x: movesLeft ? 0 : entry.playfieldWidth,
        radius: 80,
        kind: gateKinds[(waveIndex - 1) % gateKinds.length] ?? "troop",
        level: 1,
      },
    ],
  }
}

const inputTemplate = (move: -1 | 1, ticks: number) =>
  Object.freeze(
    Array.from({ length: ticks }, (_, index) =>
      Object.freeze({ moveX: index < 25 ? (0 as const) : move, paused: false }),
    ),
  )

const frameTemplate = (move: -1 | 1, count: number): readonly WitnessFrame[] =>
  Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({ atMs: (index + 1) * SOLVER_STEP_MS, move, x: 0, velocity: 0, squad: 0 }),
    ),
  )

const LEFT_NORMAL = inputTemplate(-1, NORMAL_HORIZON_MS / 10)
const RIGHT_NORMAL = inputTemplate(1, NORMAL_HORIZON_MS / 10)
const LEFT_BOSS = inputTemplate(-1, BOSS_HORIZON_MS / 10)
const RIGHT_BOSS = inputTemplate(1, BOSS_HORIZON_MS / 10)
const LEFT_NORMAL_FRAMES = frameTemplate(-1, NORMAL_HORIZON_MS / SOLVER_STEP_MS)
const RIGHT_NORMAL_FRAMES = frameTemplate(1, NORMAL_HORIZON_MS / SOLVER_STEP_MS)
const LEFT_BOSS_FRAMES = frameTemplate(-1, BOSS_HORIZON_MS / SOLVER_STEP_MS)
const RIGHT_BOSS_FRAMES = frameTemplate(1, BOSS_HORIZON_MS / SOLVER_STEP_MS)

const closedWitness = (entry: EntryState, segment: WaveSegment): WaveWitness => {
  const movesLeft = entry.x <= entry.playfieldWidth / 2
  const boss = segment.horizonMs === BOSS_HORIZON_MS
  const troopGate = segment.gates[0]?.kind === "troop"
  return {
    frames: boss
      ? movesLeft
        ? LEFT_BOSS_FRAMES
        : RIGHT_BOSS_FRAMES
      : movesLeft
        ? LEFT_NORMAL_FRAMES
        : RIGHT_NORMAL_FRAMES,
    productionInputs: boss
      ? movesLeft
        ? LEFT_BOSS
        : RIGHT_BOSS
      : movesLeft
        ? LEFT_NORMAL
        : RIGHT_NORMAL,
    finalSquad: entry.squad + (troopGate ? 1 : 0),
    finalX: movesLeft ? 0 : entry.playfieldWidth,
    finalVelocity: 0,
    collectedGateIds: segment.gates[0] === undefined ? [] : [segment.gates[0].id],
  }
}

const productionWitness = (entry: EntryState, waveIndex = 1): WaveWitness =>
  closedWitness(entry, fallbackSegment(entry, waveIndex))

const openSegment = (): WaveSegment => ({
  id: "fallback-open-corridor",
  horizonMs: NORMAL_HORIZON_MS,
  blockers: [],
  gates: [],
})

const openWitness = (entry: EntryState): WaveWitness => closedWitness(entry, openSegment())

export const fallbackPatterns: readonly FallbackPattern[] = [
  {
    id: "production-combat",
    bounds: {
      squad: [1, Number.MAX_SAFE_INTEGER],
      x: [0, "playfieldWidth"],
      velocity: [-500, 500],
      playfieldWidth: [1, 1_000],
      collisionRadii: [0, 500],
      precedingSegments: [0, 2],
      upgrades: {
        troop: [0, 100],
        damage: [0, 100],
        fireRate: [0, 100],
        recovery: [0, 100],
      },
      integerOnly: [
        "squad",
        "x",
        "velocity",
        "playfieldWidth",
        "playerRadius",
        "blockerRadius",
        "upgrades.troop",
        "upgrades.damage",
        "upgrades.fireRate",
        "upgrades.recovery",
      ],
    },
    precondition: (entry) =>
      entry.playfieldWidth === 1_000 &&
      entry.playerRadius === 12 &&
      entry.blockerRadius === 12 &&
      Object.values(entry.upgrades).every(Number.isFinite) &&
      [
        entry.squad,
        entry.x,
        entry.velocity,
        entry.playfieldWidth,
        entry.playerRadius,
        entry.blockerRadius,
        ...Object.values(entry.upgrades),
      ].every(Number.isSafeInteger) &&
      Object.values(entry.upgrades).every((level) => level >= 0) &&
      Object.values(entry.upgrades).every((level) => level <= 100) &&
      [
        entry.squad,
        entry.x,
        entry.velocity,
        entry.playfieldWidth,
        entry.playerRadius,
        entry.blockerRadius,
      ].every(Number.isFinite) &&
      entry.squad >= 1 &&
      entry.squad <= Number.MAX_SAFE_INTEGER &&
      entry.velocity >= -500 &&
      entry.velocity <= 500 &&
      entry.playerRadius >= 0 &&
      entry.playerRadius <= 500 &&
      entry.blockerRadius >= 0 &&
      entry.blockerRadius <= 500 &&
      entry.precedingSegments.length <= 2 &&
      entry.playfieldWidth >= 1 &&
      entry.playfieldWidth <= 1_000 &&
      entry.playfieldWidth > entry.playerRadius * 2 &&
      entry.x >= 0 &&
      entry.x <= entry.playfieldWidth,
    segment: fallbackSegment,
    witness: productionWitness,
  },
  {
    id: "universal-open",
    bounds: {
      squad: [1, Number.MAX_SAFE_INTEGER],
      x: [0, "playfieldWidth"],
      velocity: [-500, 500],
      playfieldWidth: [1, 1_000],
      collisionRadii: [0, 500],
      precedingSegments: [0, 2],
      upgrades: { troop: [0, 100], damage: [0, 100], fireRate: [0, 100], recovery: [0, 100] },
      integerOnly: [
        "squad",
        "x",
        "velocity",
        "playfieldWidth",
        "playerRadius",
        "blockerRadius",
        "upgrades.troop",
        "upgrades.damage",
        "upgrades.fireRate",
        "upgrades.recovery",
      ],
    },
    precondition: (entry) =>
      entry.squad >= 1 &&
      entry.playfieldWidth >= 1 &&
      entry.playfieldWidth <= 1_000 &&
      entry.x >= 0 &&
      entry.x <= entry.playfieldWidth &&
      entry.velocity >= -500 &&
      entry.velocity <= 500 &&
      entry.playerRadius >= 0 &&
      entry.playerRadius <= 500 &&
      entry.blockerRadius >= 0 &&
      entry.blockerRadius <= 500 &&
      entry.playfieldWidth > entry.playerRadius * 2 &&
      entry.precedingSegments.length <= 2 &&
      Object.values(entry.upgrades).every(
        (level) => Number.isSafeInteger(level) && level >= 0 && level <= 100,
      ) &&
      [
        entry.squad,
        entry.x,
        entry.velocity,
        entry.playfieldWidth,
        entry.playerRadius,
        entry.blockerRadius,
      ].every(Number.isSafeInteger),
    segment: openSegment,
    witness: openWitness,
  },
] as const

export const fallbackFor = (
  entry: EntryState,
  rejectedSegment?: WaveSegment,
): Readonly<{
  patternId: string
  segment: WaveSegment
  witness: WaveWitness
}> => {
  const pattern = fallbackPatterns.find((candidate) => candidate.precondition(entry))
  if (pattern === undefined) throw new RangeError("entry state has no safe fallback")
  const matched = rejectedSegment === undefined ? undefined : /(\d+)$/.exec(rejectedSegment.id)
  const waveIndex = matched?.[1] === undefined ? 1 : Math.max(1, Number(matched[1]))
  return {
    patternId: pattern.id,
    segment: pattern.segment(entry, waveIndex),
    witness: pattern.witness(entry, waveIndex),
  }
}
