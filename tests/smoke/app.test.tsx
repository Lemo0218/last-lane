import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

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

  it("exposes the mobile gameplay HUD joystick pause and sound controls", () => {
    // Given: the player starts a run
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }))

    // When: gameplay is visible and the pause control is activated
    fireEvent.click(screen.getByRole("button", { name: "게임 일시정지" }))

    // Then: every HUD field, canvas, joystick, dialog and 44px control is accessible
    expect(screen.getByLabelText("라스트 레인 게임 화면")).toBeInTheDocument()
    expect(screen.getByRole("slider", { name: "이동 조이스틱" })).toBeInTheDocument()
    for (const label of ["점수", "시간", "분대", "콤보", "위협"])
      expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "일시정지" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "소리 끄기" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "계속하기" })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole("dialog", { name: "일시정지" }), { key: "Escape" })
    expect(screen.queryByRole("dialog", { name: "일시정지" })).not.toBeInTheDocument()
  })
})
