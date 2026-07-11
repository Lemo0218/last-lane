import { expect, test } from "@playwright/test"

test("shows the Korean start screen in a mobile browser", async ({ page }) => {
  // Given: a player opens the deployed application
  // When: the start screen finishes loading
  await page.goto("/")

  // Then: the Korean game title and primary action are accessible
  await expect(page.getByRole("heading", { name: "라스트 레인 LAST LANE" })).toBeVisible()
  await expect(page.getByRole("button", { name: "게임 시작" })).toBeVisible()
})
