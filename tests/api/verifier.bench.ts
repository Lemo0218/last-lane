import { expect, it } from "vitest"
import { verifyReplay } from "../../src/server/verifier"

const LOCAL_CEILING_MS = 2_000
const DEPLOYED_CEILING_MS = 8_000
const VERCEL_MAX_DURATION_MS = 10_000

it("processes a full ten-minute live-run rejection below deployment ceilings", () => {
  const entries: Array<{ tick: number; move: "L" | "R" }> = []
  let tick = 0
  let wave = 0
  while (tick < 60_000) {
    entries.push({ tick, move: (wave + 1) % 2 === 0 ? "L" : "R" })
    tick += (wave + 1) % 5 === 0 ? 1_200 : 800
    wave += 1
  }
  const started = performance.now()
  expect(() => verifyReplay(1, { entries, endTick: 60_000 }, DEPLOYED_CEILING_MS)).toThrow(
    "outcome",
  )
  const elapsed = performance.now() - started
  expect(elapsed).toBeLessThan(LOCAL_CEILING_MS)
  expect(elapsed).toBeLessThan(DEPLOYED_CEILING_MS)
  expect(DEPLOYED_CEILING_MS).toBeLessThan(VERCEL_MAX_DURATION_MS)
})

it("verifies the longest captured accepted witness below the local ceiling", () => {
  const started = performance.now()
  expect(
    verifyReplay(0, { entries: [{ tick: 0, move: "N" }], endTick: 1_352 }, 1_500).survivalTicks,
  ).toBe(1_352)
  expect(performance.now() - started).toBeLessThan(LOCAL_CEILING_MS)
})
