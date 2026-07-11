import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { App } from "../../src/App"
import { Tutorial } from "../../src/ui/Tutorial"

describe("Tutorial accessibility", () => {
  it("makes the background inert while the modal is open", () => {
    // Given / When: a first-time player opens the app
    localStorage.clear()
    const { container } = render(<App />)

    // Then: the start surface cannot receive interaction behind the modal
    expect(screen.getByRole("dialog", { name: "좌우로 길을 선택하세요" })).toBeInTheDocument()
    expect(container.querySelector("[inert]")).toContainElement(
      screen.getByRole("button", { name: "게임 시작", hidden: true }),
    )
  })

  it("traps focus and restores the previously focused control on close", () => {
    // Given: focus is on a control before the tutorial mounts
    const previous = document.createElement("button")
    document.body.append(previous)
    previous.focus()
    const complete = vi.fn()
    const mounted = render(<Tutorial onComplete={complete} />)
    const confirm = screen.getByRole("button", { name: "확인" })

    // When: focus attempts to leave and the dialog closes
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" })
    expect(confirm).toHaveFocus()
    mounted.unmount()

    // Then: focus returns to the control active before the modal opened
    expect(previous).toHaveFocus()
    previous.remove()
  })
})
