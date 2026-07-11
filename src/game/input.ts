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
  let activePointerId: number | undefined
  const pressed = new Set<string>()
  const updateKeyboard = (): void => {
    const left = pressed.has("arrowleft") || pressed.has("a")
    const right = pressed.has("arrowright") || pressed.has("d")
    moveX = left === right ? 0 : left ? -1 : 1
  }
  const updateAria = (): void => {
    element.setAttribute("aria-valuenow", String(moveX))
    element.setAttribute("aria-valuetext", moveX === -1 ? "왼쪽" : moveX === 1 ? "오른쪽" : "중립")
  }
  const reset = (): void => {
    moveX = 0
    activePointerId = undefined
    pressed.clear()
    element.style.setProperty("--joystick-x", "0px")
    element.removeAttribute("data-active")
    updateAria()
  }
  const down = (event: PointerEvent): void => {
    if (activePointerId !== undefined) return
    origin = event.clientX
    moveX = 0
    activePointerId = event.pointerId
    element.setAttribute("data-active", "true")
    if (event.isTrusted) element.setPointerCapture?.(event.pointerId)
  }
  const move = (event: PointerEvent): void => {
    if (event.pointerId === activePointerId) {
      moveX = quantizeHorizontal(event.clientX, origin)
      const displacement = Math.max(-42, Math.min(42, event.clientX - origin))
      element.style.setProperty("--joystick-x", `${displacement}px`)
      updateAria()
    }
  }
  const up = (event: PointerEvent): void => {
    if (event.pointerId === activePointerId) reset()
  }
  const keydown = (event: KeyboardEvent): void => {
    const movement = movementForKey(event.key)
    if (movement !== 0) {
      event.preventDefault()
      pressed.add(event.key.toLowerCase())
      updateKeyboard()
      updateAria()
    }
  }
  const keyup = (event: KeyboardEvent): void => {
    if (movementForKey(event.key) !== 0) {
      pressed.delete(event.key.toLowerCase())
      updateKeyboard()
      updateAria()
    }
  }
  element.addEventListener("pointerdown", down)
  element.addEventListener("pointermove", move)
  element.addEventListener("pointerup", up)
  element.addEventListener("pointercancel", up)
  window.addEventListener("keydown", keydown)
  window.addEventListener("keyup", keyup)
  window.addEventListener("blur", reset)
  updateAria()
  return {
    current: () => ({ moveX, paused: false }),
    dispose: () => {
      element.removeEventListener("pointerdown", down)
      element.removeEventListener("pointermove", move)
      element.removeEventListener("pointerup", up)
      element.removeEventListener("pointercancel", up)
      window.removeEventListener("keydown", keydown)
      window.removeEventListener("keyup", keyup)
      window.removeEventListener("blur", reset)
      reset()
    },
  }
}
