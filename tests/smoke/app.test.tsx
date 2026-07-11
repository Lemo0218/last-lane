import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { App } from "../../src/App"

describe("App", () => {
  it("shows the title and accessible play button on the start screen", () => {
    // Given: the application is ready to render its initial screen
    // When: the player opens Last Lane
    render(<App />)

    // Then: the game identity and primary action are available
    expect(screen.getByRole("heading", { name: "라스트 레인 LAST LANE" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "게임 시작" })).toBeInTheDocument()
  })
})
