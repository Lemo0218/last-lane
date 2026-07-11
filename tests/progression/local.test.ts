import { beforeEach, describe, expect, it } from "vitest"

import { createLocalProgress } from "../../src/storage/local"

describe("local progress", () => {
  beforeEach(() => localStorage.clear())

  it("persists tutorial completion after the first run", () => {
    // Given
    const progress = createLocalProgress(localStorage)
    // When
    progress.completeTutorial()
    // Then
    expect(createLocalProgress(localStorage).hasCompletedTutorial()).toBe(true)
  })

  it("keeps the highest personal best", () => {
    // Given
    const progress = createLocalProgress(localStorage)
    progress.recordBest(1200)
    // When
    progress.recordBest(900)
    // Then
    expect(progress.best()).toBe(1200)
  })
})
