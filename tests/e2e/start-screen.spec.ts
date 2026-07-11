import { expect, test } from "@playwright/test"

test("shows the Korean start screen in a mobile browser", async ({ page }) => {
  // Given: a player opens the deployed application
  // When: the start screen finishes loading
  await page.goto("/")

  // Then: the Korean game title and primary action are accessible
  await expect(page.getByRole("heading", { name: "라스트 레인 LAST LANE" })).toBeVisible()
  await expect(page.getByRole("button", { name: "게임 시작" })).toBeVisible()
})

test("plays with the touch joystick and pauses and resumes on mobile", async ({ page }) => {
  // Given: a player starts the Canvas game
  await page.goto("/")
  await page.getByRole("button", { name: "게임 시작" }).click()
  const joystick = page.getByRole("application", { name: "이동 조이스틱" })
  const bounds = await joystick.boundingBox()
  expect(bounds).not.toBeNull()
  if (bounds === null) return

  // When: the player drags the joystick right and releases it
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width - 8, bounds.y + bounds.height / 2)

  // Then: the knob visibly follows, returns neutral, and pause/resume remains operational
  await expect(joystick).toHaveAttribute("data-active", "true")
  await expect(joystick.locator(".joystick-knob")).not.toHaveCSS("transform", "none")
  await page.mouse.up()
  await expect(joystick).not.toHaveAttribute("data-active", "true")
  await expect(page.getByLabel("게임 현황")).toContainText("분대")
  await expect(page.getByLabel("라스트 레인 게임 화면")).toBeVisible()
  await page.getByRole("button", { name: "게임 일시정지" }).click()
  await expect(page.getByRole("dialog", { name: "일시정지" })).toBeVisible()
  await page.getByRole("button", { name: "계속하기" }).click()
  await expect(page.getByRole("dialog", { name: "일시정지" })).not.toBeVisible()
})

test("materializes boss combat and moves through touch pointer input", async ({ page }) => {
  // Given: deterministic boss mode starts on the fifth wave
  await page.goto("/?testMode=boss")
  await page.getByRole("button", { name: "게임 시작" }).click()
  const game = page.locator(".game-shell")
  const joystick = page.getByRole("application", { name: "이동 조이스틱" })
  const initialX = Number(await game.getAttribute("data-player-x"))

  // When: touch pointer events drag the virtual joystick left
  await joystick.dispatchEvent("pointerdown", { pointerId: 9, pointerType: "touch", clientX: 180 })
  await joystick.dispatchEvent("pointermove", { pointerId: 9, pointerType: "touch", clientX: 110 })

  // Then: player movement and real boss/projectile combat become observable
  await expect
    .poll(async () => Number(await game.getAttribute("data-player-x")))
    .toBeLessThan(initialX)
  await expect(game).toHaveAttribute("data-wave", "5")
  await expect
    .poll(
      async () =>
        `${await game.getAttribute("data-zombies")}:${await game.getAttribute("data-projectiles")}:${await game.getAttribute("data-boss")}`,
      { intervals: [10], timeout: 5_000 },
    )
    .toBe("1:1:true")
  await joystick.dispatchEvent("pointerup", { pointerId: 9, pointerType: "touch", clientX: 110 })
})
