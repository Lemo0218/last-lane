import { expect, test } from "@playwright/test"

test("submits a ranked result and shows the refreshed top board", async ({ page }) => {
  // Given: real client handlers backed by deterministic HTTP fixtures
  await page.route("**/api/run-ticket", async (route) =>
    route.fulfill({
      json: {
        token: "e2e-ticket",
        deadlineMs: Date.now() + 60_000,
        seed: 17,
        ruleset: "last-lane-v1",
      },
    }),
  )
  await page.route("**/api/submit-score", async (route) =>
    route.fulfill({ json: { accepted: true, rank: 1 } }),
  )
  await page.route("**/api/leaderboard", async (route) =>
    route.fulfill({ json: { entries: [{ rank: 1, nickname: "모바일러너", score: 4200 }] } }),
  )
  await page.goto("/")
  await page.getByRole("button", { name: "확인" }).click()
  await page.getByRole("button", { name: "게임 시작" }).click()
  await expect(page.getByRole("heading", { name: "생존 기록" })).toBeVisible({ timeout: 15_000 })

  // When: the player submits the browser-produced transcript
  await page.getByLabel("닉네임").fill("모바일러너")
  await page.getByRole("button", { name: "랭킹 등록" }).click()

  // Then: accepted rank and authoritative top-board data are displayed
  await expect(page.getByText("1위")).toBeVisible()
  await page.getByRole("button", { name: "리더보드 보기" }).click()
  await expect(page.getByText("모바일러너")).toBeVisible()
  await expect(page.getByText("4,200")).toBeVisible()
})
