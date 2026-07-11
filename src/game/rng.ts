export type RandomResult = Readonly<{ seed: number; value: number }>

export const nextRandom = (seed: number): RandomResult => {
  requireNatural("seed", seed)
  if (seed > 0xffff_ffff) throw new RangeError("seed must fit in uint32")
  const nextSeed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
  return { seed: nextSeed, value: nextSeed % 1_000_000 }
}

import { requireNatural } from "./validation"
