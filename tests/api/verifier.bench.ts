import { expect, it } from "vitest"
import { verifyReplay } from "../../src/server/verifier"
import { generateTenMinuteWitness } from "../fixtures/autoplay"

const LOCAL_CEILING_MS = 2_000
const DEPLOYED_CEILING_MS = 8_000
const VERCEL_MAX_DURATION_MS = 10_000

it("accepts a generated ten-minute witness below deployment ceilings", () => {
  const transcript = generateTenMinuteWitness(0)
  expect(verifyReplay(0, transcript, DEPLOYED_CEILING_MS).survivalTicks).toBe(60_000)
  const samples = Array.from({ length: 3 }, () => {
    const started = performance.now()
    expect(verifyReplay(0, transcript, DEPLOYED_CEILING_MS).survivalTicks).toBe(60_000)
    return performance.now() - started
  })
  const ordered = [...samples].sort((left, right) => left - right)
  const median = ordered[1]
  const maximum = ordered[2]
  expect(median).toBeDefined()
  expect(maximum).toBeDefined()
  expect(median).toBeLessThan(LOCAL_CEILING_MS)
  expect(maximum).toBeLessThan(LOCAL_CEILING_MS)
  expect(DEPLOYED_CEILING_MS).toBeLessThan(VERCEL_MAX_DURATION_MS)
}, 30_000)

it("verifies the longest captured accepted witness below the local ceiling", () => {
  const started = performance.now()
  expect(
    verifyReplay(0, { entries: [{ tick: 0, move: "N" }], endTick: 1_352 }, 1_500).survivalTicks,
  ).toBe(1_352)
  expect(performance.now() - started).toBeLessThan(LOCAL_CEILING_MS)
})
