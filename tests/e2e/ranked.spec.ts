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

test("queues a transient 503 and publishes it after the online retry event", async ({ page }) => {
  // Given: a ranked run whose first submission is temporarily unavailable
  let submissions = 0
  await page.route("**/api/run-ticket", async (route) =>
    route.fulfill({
      json: {
        token: "queued-ticket",
        deadlineMs: Date.now() + 60_000,
        seed: 17,
        ruleset: "last-lane-v1",
      },
    }),
  )
  await page.route("**/api/submit-score", async (route) => {
    submissions += 1
    if (submissions === 1) await route.fulfill({ status: 503, json: { error: "temporary" } })
    else await route.fulfill({ json: { accepted: true, rank: 2 } })
  })
  await page.route("**/api/leaderboard", async (route) =>
    route.fulfill({ json: { entries: [{ rank: 2, nickname: "재시도", score: 3200 }] } }),
  )
  await page.goto("/")
  await page.getByRole("button", { name: "확인" }).click()
  await page.getByRole("button", { name: "게임 시작" }).click()
  await expect(page.getByRole("heading", { name: "생존 기록" })).toBeVisible({ timeout: 15_000 })

  // When: submission is queued and the browser reports connectivity restored
  await page.getByLabel("닉네임").fill("재시도")
  await page.getByRole("button", { name: "랭킹 등록" }).click()
  await expect(page.getByRole("button", { name: "전송 대기 중" })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event("online")))

  // Then: the real queue retries once, clears storage, and refreshes accepted rank
  await expect(page.getByText("2위")).toBeVisible()
  expect(submissions).toBe(2)
  expect(await page.evaluate(() => localStorage.getItem("last-lane:ranking-retry-v1"))).toBe("[]")
})

test("expires a finished ticket without submission or queue persistence", async ({ page }) => {
  // Given: a ticket whose short deadline elapses during a real production run
  let submissions = 0
  await page.route("**/api/run-ticket", async (route) =>
    route.fulfill({
      json: {
        token: "expired-ticket",
        deadlineMs: Date.now() + 500,
        seed: 17,
        ruleset: "last-lane-v1",
      },
    }),
  )
  await page.route("**/api/submit-score", async (route) => {
    submissions += 1
    await route.fulfill({ json: { accepted: true, rank: 1 } })
  })
  await page.goto("/")
  await page.getByRole("button", { name: "확인" }).click()
  await page.getByRole("button", { name: "게임 시작" }).click()
  await expect(page.getByRole("heading", { name: "생존 기록" })).toBeVisible({ timeout: 15_000 })

  // When: the player attempts to submit the expired run
  await page.getByLabel("닉네임").fill("만료")
  await page.getByRole("button", { name: "랭킹 등록" }).click()

  // Then: expiry is terminal and no network submission or retry item exists
  await expect(page.getByRole("button", { name: "등록 만료" })).toBeVisible()
  await expect(
    page.getByText("랭킹 등록 시간이 만료되었습니다. 새 게임을 시작해 주세요"),
  ).toBeVisible()
  expect(submissions).toBe(0)
  expect(await page.evaluate(() => localStorage.getItem("last-lane:ranking-retry-v1"))).toBeNull()
})
