import type { SimulationInput } from "./types"

export type InputController = Readonly<{ current: () => SimulationInput; dispose: () => void }>

export const quantizeHorizontal = (x: number, origin: number, threshold = 12): -1 | 0 | 1 =>
  x - origin < -threshold ? -1 : x - origin > threshold ? 1 : 0

export const movementForKey = (key: string): -1 | 0 | 1 => {
  const normalized = key.toLowerCase()
  if (normalized === "arrowleft" || normalized === "a") return -1
  if (normalized === "arrowright" || normalized === "d") return 1
  return 0
}

export const createInputController = (element: HTMLElement): InputController => {
  let moveX: -1 | 0 | 1 = 0
  let origin = 0
  let pointerActive = false
  const reset = (): void => {
    moveX = 0
    pointerActive = false
    element.style.setProperty("--joystick-x", "0px")
    element.removeAttribute("data-active")
  }
  const down = (event: PointerEvent): void => {
    origin = event.clientX
    moveX = 0
    pointerActive = true
    element.setAttribute("data-active", "true")
    if (event.isTrusted) element.setPointerCapture?.(event.pointerId)
  }
  const move = (event: PointerEvent): void => {
    if (pointerActive) {
      moveX = quantizeHorizontal(event.clientX, origin)
      const displacement = Math.max(-42, Math.min(42, event.clientX - origin))
      element.style.setProperty("--joystick-x", `${displacement}px`)
    }
  }
  const up = (): void => reset()
  const keydown = (event: KeyboardEvent): void => {
    const movement = movementForKey(event.key)
    if (movement !== 0) {
      event.preventDefault()
      moveX = movement
    }
  }
  const keyup = (event: KeyboardEvent): void => {
    if (movementForKey(event.key) !== 0) moveX = 0
  }
  element.addEventListener("pointerdown", down)
  element.addEventListener("pointermove", move)
  element.addEventListener("pointerup", up)
  element.addEventListener("pointercancel", up)
  window.addEventListener("keydown", keydown)
  window.addEventListener("keyup", keyup)
  return {
    current: () => ({ moveX, paused: false }),
    dispose: () => {
      element.removeEventListener("pointerdown", down)
      element.removeEventListener("pointermove", move)
      element.removeEventListener("pointerup", up)
      element.removeEventListener("pointercancel", up)
      window.removeEventListener("keydown", keydown)
      window.removeEventListener("keyup", keyup)
      reset()
    },
  }
}
