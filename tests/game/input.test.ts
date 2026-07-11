import { describe, expect, it } from "vitest"

import { createInputController, movementForKey, quantizeHorizontal } from "../../src/game/input"

describe("game input", () => {
  it("quantizes pointer drag into left neutral and right lanes", () => {
    // Given: a centered pointer origin
    // When: the pointer crosses the drag thresholds
    // Then: movement is constrained to the simulation input domain
    expect([-30, -8, 0, 8, 30].map((x) => quantizeHorizontal(x, 0))).toEqual([-1, 0, 0, 0, 1])
  })

  it("maps Korean-friendly keyboard controls", () => {
    // Given: arrow and A/D keys
    // When: a key is interpreted
    // Then: only horizontal controls produce movement
    expect(["ArrowLeft", "a", "ArrowRight", "D", "Space"].map(movementForKey)).toEqual([
      -1, -1, 1, 1, 0,
    ])
  })

  it("drives the visible joystick with pointer drag and resets on release", () => {
    // Given: a joystick element holding pointer capture
    const element = document.createElement("div")
    let captured = false
    element.setPointerCapture = () => {
      captured = true
    }
    element.hasPointerCapture = () => captured
    const controller = createInputController(element)
    const pointer = (type: string, clientX: number): void => {
      const event = new Event(type, { bubbles: true })
      Object.defineProperties(event, { pointerId: { value: 1 }, clientX: { value: clientX } })
      element.dispatchEvent(event)
    }

    // When: the thumb moves right and is released
    pointer("pointerdown", 100)
    pointer("pointermove", 150)

    // Then: the knob and input reflect right movement before returning neutral
    expect(controller.current().moveX).toBe(1)
    expect(element.getAttribute("data-active")).toBe("true")
    expect(element.style.getPropertyValue("--joystick-x")).toBe("42px")
    pointer("pointerup", 150)
    expect(controller.current().moveX).toBe(0)
    expect(element.hasAttribute("data-active")).toBe(false)
    controller.dispose()
  })

  it("supports mouse QA through pointer events and keyboard fallback", () => {
    // Given: an attached controller
    const element = document.createElement("div")
    const controller = createInputController(element)

    // When: desktop keyboard controls are pressed and released
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))

    // Then: movement follows the fallback and cleans up
    expect(controller.current().moveX).toBe(-1)
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft" }))
    expect(controller.current().moveX).toBe(0)
    controller.dispose()
  })
})
