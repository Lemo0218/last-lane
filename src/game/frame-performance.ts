export type FramePerformanceSnapshot = Readonly<{
  p95WorkMs: number
  maxEntities: number
  maxEffects: number
}>

export const createFramePerformance = () => {
  const samples: number[] = []
  let maxEntities = 0
  let maxEffects = 0
  return {
    record: (workMs: number, entities: number, effects: number): void => {
      samples.push(workMs)
      if (samples.length > 240) samples.shift()
      maxEntities = Math.max(maxEntities, entities)
      maxEffects = Math.max(maxEffects, effects)
    },
    snapshot: (): FramePerformanceSnapshot => {
      const ordered = [...samples].sort((left, right) => left - right)
      const rank = Math.max(0, Math.ceil(ordered.length * 0.95) - 1)
      return {
        p95WorkMs: ordered[rank] ?? 0,
        maxEntities,
        maxEffects,
      }
    },
  }
}
