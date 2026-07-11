import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 390, height: 844 } })

test("keeps touch controls responsive and frame work bounded at the mobile maximum", async ({
  page,
}) => {
  // Given: a 390x844 touch viewport running the production Canvas
  await page.goto("/?testMode=stress")
  await page.getByRole("button", { name: "확인" }).click()
  await page.getByRole("button", { name: "게임 시작" }).click()
  const game = page.locator(".game-shell")
  const joystick = page.getByRole("slider", { name: "이동 조이스틱" })
  const initialX = Number(await game.getAttribute("data-player-x"))

  // When: touch input moves the virtual joystick while frame telemetry fills
  await joystick.dispatchEvent("pointerdown", { pointerId: 21, pointerType: "touch", clientX: 195 })
  await joystick.dispatchEvent("pointermove", { pointerId: 21, pointerType: "touch", clientX: 270 })
  await expect
    .poll(async () => Number(await game.getAttribute("data-player-x")))
    .toBeGreaterThan(initialX)
  await joystick.dispatchEvent("pointerup", { pointerId: 21, pointerType: "touch", clientX: 270 })
  await expect
    .poll(async () => Number(await game.getAttribute("data-frame-samples")))
    .toBeGreaterThanOrEqual(120)

  // Then: measured browser work remains below budget and both pools are bounded
  expect(Number(await game.getAttribute("data-frame-p95-ms"))).toBeLessThan(16)
  expect(Number(await game.getAttribute("data-frame-interval-p95-ms"))).toBeLessThan(34)
  expect(Number(await game.getAttribute("data-long-frames"))).toBe(0)
  expect(Number(await game.getAttribute("data-max-entities"))).toBe(128)
  expect(Number(await game.getAttribute("data-max-effects"))).toBe(32)
  await expect(game).toHaveAttribute("data-functional-status", "running")
})

test("shows another soldier after collecting a troop gate", async ({ page }) => {
  // Given: a new squad moving toward the first troop gate
  await page.goto("/")
  await page.getByRole("button", { name: "확인" }).click()
  await page.getByRole("button", { name: "게임 시작" }).click()
  const game = page.locator(".game-shell")
  const joystick = page.getByRole("slider", { name: "이동 조이스틱" })
  const initialSoldiers = Number(await game.getAttribute("data-visible-soldiers"))

  // When: touch steering crosses the troop gate on the left
  await joystick.dispatchEvent("pointerdown", { pointerId: 31, pointerType: "touch", clientX: 195 })
  await joystick.dispatchEvent("pointermove", { pointerId: 31, pointerType: "touch", clientX: 100 })
  await expect
    .poll(async () => Number(await game.getAttribute("data-collected-gates")), {
      timeout: 8_000,
    })
    .toBeGreaterThan(0)
  await joystick.dispatchEvent("pointerup", { pointerId: 31, pointerType: "touch", clientX: 100 })

  // Then: telemetry reports one more individually rendered squad member
  await expect(game).toHaveAttribute("data-visible-soldiers", String(initialSoldiers + 1))
})
