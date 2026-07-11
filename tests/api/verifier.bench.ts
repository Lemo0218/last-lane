import { expect, it } from "vitest"
import { verifyReplay } from "../../src/server/verifier"

it("verifies the worst accepted duration below two seconds locally", () => {
  const started = performance.now()
  const result = verifyReplay(42, [{ tick: 60_000, move: "R" }], 1_500)
  expect(result.survivalTicks).toBeLessThanOrEqual(60_000)
  expect(performance.now() - started).toBeLessThan(2_000)
})
