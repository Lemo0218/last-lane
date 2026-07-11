import { expect, test } from "@playwright/test"
import fixture from "../fixtures/golden-replay.json" with { type: "json" }

test("browser runtime reproduces the static golden replay", async ({ page }) => {
  await page.goto("/")
  const tutorial = page.getByRole("dialog", { name: "좌우로 길을 선택하세요" })
  await tutorial.getByRole("button", { name: "확인" }).click()
  await page.getByRole("button", { name: "게임 시작" }).click()
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("last-lane:e2e-golden")), {
      timeout: 15_000,
    })
    .not.toBeNull()
  const captured = await page.evaluate(() => sessionStorage.getItem("last-lane:e2e-golden"))
  expect(JSON.parse(captured ?? "null")).toEqual(fixture)
})
