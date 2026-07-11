import { describe, expect, it } from "vitest"

import { createTranscriptRecorder } from "../../src/game/transcript"

describe("transcript recorder", () => {
  it("records only quantized movement changes on fixed ticks", () => {
    // Given
    const recorder = createTranscriptRecorder()
    // When
    recorder.record(0, 0)
    recorder.record(1, -1)
    recorder.record(2, -1)
    recorder.record(3, 0)
    recorder.record(4, 1)
    // Then
    expect(recorder.snapshot()).toEqual([
      { tick: 1, move: "L" },
      { tick: 3, move: "N" },
      { tick: 4, move: "R" },
    ])
  })
})
