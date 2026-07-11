import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 390, height: 844 } })
test.skip(process.env["STRESS_E2E"] !== "true", "development-only stress harness")

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
  expect(Number(await game.getAttribute("data-max-entities"))).toBe(128)
  expect(Number(await game.getAttribute("data-max-effects"))).toBe(32)
  await expect(game).toHaveAttribute("data-functional-status", "running")
})
