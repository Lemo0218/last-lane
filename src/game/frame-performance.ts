export type FramePerformanceSnapshot = Readonly<{
  p95WorkMs: number
  p95IntervalMs: number
  longFrames: number
  maxEntities: number
  maxEffects: number
}>

export const createFramePerformance = () => {
  const samples: number[] = []
  const intervals: number[] = []
  let maxEntities = 0
  let maxEffects = 0
  return {
    record: (workMs: number, entities: number, effects: number, intervalMs = 0): void => {
      samples.push(workMs)
      if (samples.length > 240) samples.shift()
      if (intervalMs > 0) intervals.push(intervalMs)
      if (intervals.length > 240) intervals.shift()
      maxEntities = Math.max(maxEntities, entities)
      maxEffects = Math.max(maxEffects, effects)
    },
    snapshot: (): FramePerformanceSnapshot => {
      const ordered = [...samples].sort((left, right) => left - right)
      const rank = Math.max(0, Math.ceil(ordered.length * 0.95) - 1)
      const orderedIntervals = [...intervals].sort((left, right) => left - right)
      const intervalRank = Math.max(0, Math.ceil(orderedIntervals.length * 0.95) - 1)
      return {
        p95WorkMs: ordered[rank] ?? 0,
        p95IntervalMs: orderedIntervals[intervalRank] ?? 0,
        longFrames: intervals.filter((interval) => interval > 50).length,
        maxEntities,
        maxEffects,
      }
    },
  }
}
