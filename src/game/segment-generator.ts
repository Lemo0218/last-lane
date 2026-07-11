import type { EntryState, WaveSegment } from "./waves"
import { BOSS_HORIZON_MS, NORMAL_HORIZON_MS } from "./waves"

export const generateWaveCandidate = (entry: EntryState, index: number): WaveSegment => {
  const boss = (index + 1) % 5 === 0
  const horizonMs = boss ? BOSS_HORIZON_MS : NORMAL_HORIZON_MS
  const leftLane = index % 2 === 0
  const half = entry.playfieldWidth / 2
  const safeMinimum = leftLane ? half : 0
  const safeMaximum = leftLane ? entry.playfieldWidth : half
  return {
    id: `${boss ? "boss" : "wave"}-${index + 1}`,
    horizonMs,
    blockers: [
      {
        fromMs: 1_500,
        toMs: 1_500,
        minX: safeMinimum,
        maxX: safeMaximum,
        damage: boss ? 2 : 1,
      },
    ],
    gates: [
      {
        id: `gate-${index + 1}`,
        atMs: 4_200,
        x: leftLane ? entry.playfieldWidth * 0.25 : entry.playfieldWidth * 0.75,
        radius: 50,
        kind: index % 3 === 0 ? "troop" : index % 3 === 1 ? "damage" : "fire-rate",
        level: 1,
      },
    ],
  }
}
