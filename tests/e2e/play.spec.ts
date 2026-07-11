import { expect, type Page, test } from "@playwright/test"

const startRun = async (page: Page): Promise<void> => {
  await page.goto("/")
  await page.getByRole("button", { name: "확인" }).click()
  await page.getByRole("button", { name: "게임 시작" }).click()
  await expect(page.getByLabel("라스트 레인 게임 화면")).toBeVisible()
}

test("completes tutorial, runs offline, and reaches a persisted result", async ({
  context,
  page,
}) => {
  // Given: a first-time player whose network goes offline after the shell loads
  await page.goto("/")
  await context.setOffline(true)

  // When: the player completes the tutorial and runs until production game-over
  await page.getByRole("button", { name: "확인" }).click()
  await page.getByRole("button", { name: "게임 시작" }).click()

  // Then: a real result and local personal best are shown without ranking submission
  await expect(page.getByRole("heading", { name: "생존 기록" })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("오프라인 · 랭킹 미반영")).toBeVisible()
  await expect(page.getByText(/개인 최고/)).toBeVisible()
  await expect(page.getByRole("button", { name: "랭킹 등록" })).toBeDisabled()
})

test("pauses across backgrounding and resumes without simulation catch-up", async ({
  context,
  page,
}) => {
  // Given: an active touch-controlled run
  await startRun(page)
  const game = page.locator(".game-shell")
  await page.getByRole("button", { name: "게임 일시정지" }).click()
  const pausedX = await game.getAttribute("data-player-x")

  // When: the paused page is backgrounded and brought forward
  const foreground = await context.newPage()
  await foreground.goto("/")
  await page.bringToFront()
  await page.getByRole("button", { name: "계속하기" }).click()

  // Then: no hidden-time catch-up occurs and the resumed game remains interactive
  expect(await game.getAttribute("data-player-x")).toBe(pausedX)
  await expect(page.getByRole("dialog", { name: "일시정지" })).not.toBeVisible()
  await expect(page.getByLabel("라스트 레인 게임 화면")).toBeVisible()
})
