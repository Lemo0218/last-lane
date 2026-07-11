export type RandomResult = Readonly<{ seed: number; value: number }>

export const nextRandom = (seed: number): RandomResult => {
  const nextSeed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
  return { seed: nextSeed, value: nextSeed % 1_000_000 }
}
