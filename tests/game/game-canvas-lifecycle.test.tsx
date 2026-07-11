import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { GameAudio } from "../../src/game/audio"
import { GameCanvas } from "../../src/game/GameCanvas"

describe("GameCanvas lifecycle", () => {
  it("pauses hidden time, unlocks audio by gesture, and cleans up browser resources", async () => {
    // Given: a mounted game with deterministic browser and audio adapters
    let frameCallback: FrameRequestCallback = () => undefined
    const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback
      return 77
    })
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    vi.stubGlobal(
      "matchMedia",
      (media: string): MediaQueryList => ({
        matches: true,
        media,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => true,
      }),
    )
    let hidden = false
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden)
    const calls: string[] = []
    const audio: GameAudio = {
      unlock: async () => {
        calls.push("unlock")
      },
      setMuted: (muted) => {
        calls.push(`mute:${muted}`)
      },
      play: () => undefined,
      close: async () => {
        calls.push("close")
      },
    }
    const mounted = render(<GameCanvas audioFactory={() => audio} />)
    const canvas = screen.getByLabelText("라스트 레인 게임 화면")
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 200, 300))
    vi.stubGlobal("devicePixelRatio", 3)

    // When: time advances, the page backgrounds, and the joystick receives a gesture
    frameCallback(100)
    hidden = true
    document.dispatchEvent(new Event("visibilitychange"))
    frameCallback(20_000)
    hidden = false
    document.dispatchEvent(new Event("visibilitychange"))
    frameCallback(20_010)
    fireEvent.pointerDown(screen.getByRole("application", { name: "이동 조이스틱" }), {
      pointerId: 1,
      clientX: 100,
    })
    fireEvent.click(screen.getByRole("button", { name: "소리 끄기" }))
    mounted.unmount()
    await Promise.resolve()

    // Then: hidden time does not jump and all gesture/audio/frame resources are cleaned
    expect(screen.queryByText("200초")).not.toBeInTheDocument()
    expect(calls).toEqual(["unlock", "mute:true", "close"])
    expect(canvas).toHaveAttribute("width", "400")
    expect(canvas).toHaveAttribute("height", "600")
    expect(request).toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledWith(77)
  })
})
