import { expect, it } from "vitest"
import { verifyReplay } from "../../src/server/verifier"
import fixture from "../fixtures/golden-replay.json"

it("matches the static browser runtime golden replay", () => {
  expect(verifyReplay(fixture.seed, fixture.transcript, 2_000)).toEqual(fixture.expected)
})
