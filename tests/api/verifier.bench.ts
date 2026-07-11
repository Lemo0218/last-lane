import { expect, it } from "vitest"
import { verifyReplay } from "../../src/server/verifier"
import { generateTenMinuteWitness } from "../fixtures/autoplay"

const LOCAL_CEILING_MS = 2_000
const DEPLOYED_CEILING_MS = 8_000
const VERCEL_MAX_DURATION_MS = 10_000

it("accepts a generated ten-minute witness below deployment ceilings", () => {
  const transcript = generateTenMinuteWitness(0)
  const started = performance.now()
  expect(verifyReplay(0, transcript, DEPLOYED_CEILING_MS).survivalTicks).toBe(60_000)
  const elapsed = performance.now() - started
  expect(elapsed).toBeLessThan(LOCAL_CEILING_MS)
  expect(elapsed).toBeLessThan(DEPLOYED_CEILING_MS)
  expect(DEPLOYED_CEILING_MS).toBeLessThan(VERCEL_MAX_DURATION_MS)
}, 15_000)

it("verifies the longest captured accepted witness below the local ceiling", () => {
  const started = performance.now()
  expect(
    verifyReplay(0, { entries: [{ tick: 0, move: "N" }], endTick: 1_352 }, 1_500).survivalTicks,
  ).toBe(1_352)
  expect(performance.now() - started).toBeLessThan(LOCAL_CEILING_MS)
})
