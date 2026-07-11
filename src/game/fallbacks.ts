import { createProductionWaveState, stepProductionWave } from "./production-wave"
import type { EntryState, WaveSegment, WaveWitness, WitnessFrame } from "./waves"
import { BOSS_HORIZON_MS, NORMAL_HORIZON_MS, SOLVER_STEP_MS } from "./waves"

export type FallbackPattern = Readonly<{
  id: string
  bounds: Readonly<{
    squad: readonly [number, number]
    x: readonly [number, "playfieldWidth"]
    velocity: readonly [number, number]
    playfieldWidth: readonly [number, number]
    collisionRadii: readonly [number, number]
    precedingSegments: readonly [number, number]
    upgrades: Readonly<
      Record<"troop" | "damage" | "fireRate" | "recovery", readonly [number, number]>
    >
    integerOnly: readonly [
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
    ]
  }>
  precondition: (entry: EntryState) => boolean
  segment: (entry: EntryState, waveIndex?: number) => WaveSegment
  witness: (entry: EntryState, waveIndex?: number) => WaveWitness
}>

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

const productionWitness = (entry: EntryState, waveIndex = 1): WaveWitness => {
  const segment = fallbackSegment(entry, waveIndex)
  const move = entry.x <= entry.playfieldWidth / 2 ? (-1 as const) : (1 as const)
  const frames: WitnessFrame[] = []
  const productionInputs = []
  let production = createProductionWaveState(entry)
  for (let atMs = 10; atMs <= segment.horizonMs; atMs += 10) {
    const moveX = atMs <= 250 ? (0 as const) : move
    const input = { moveX, paused: false } as const
    production = stepProductionWave(entry, segment, production, input)
    productionInputs.push(input)
    if (atMs % SOLVER_STEP_MS === 0) {
      const simulation = production.simulation
      frames.push({
        atMs,
        move,
        x: simulation.playerX,
        velocity: simulation.playerVelocity,
        squad: simulation.squad,
      })
    }
  }
  const simulation = production.simulation
  return {
    frames,
    productionInputs,
    finalSquad: simulation.squad,
    finalX: simulation.playerX,
    finalVelocity: simulation.playerVelocity,
    collectedGateIds: [...production.collectedGateIds],
  }
}

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
