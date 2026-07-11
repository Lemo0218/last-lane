import { expect, it } from "vitest"
import type { Transcript } from "../../src/game/transcript"
import { verifyReplay } from "../../src/server/verifier"

it("produces a stable authoritative result for the golden transcript", () => {
  const transcript: Transcript = [
    { tick: 20, move: "R" },
    { tick: 80, move: "L" },
    { tick: 120, move: "N" },
  ]
  expect(verifyReplay(0x1234_5678, transcript, 2_000)).toMatchInlineSnapshot(`
    {
      "breakdown": {
        "basicKills": 0,
        "bosses": 0,
        "closeCalls": 0,
        "distance": 5,
        "elites": 0,
        "subtotal": 5,
        "survivalMultiplierPermille": 1000,
        "total": 5,
      },
      "score": 5,
      "survivalTicks": 120,
    }
  `)
})
