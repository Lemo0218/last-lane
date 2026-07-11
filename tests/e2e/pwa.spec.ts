import { expect, test } from "@playwright/test"

test("manifest exposes standalone install metadata and cached shell reloads offline", async ({
  context,
  page,
}) => {
  await page.goto("/")
  const manifest = await page.locator('link[rel="manifest"]').getAttribute("href")
  expect(manifest).toBe("/manifest.webmanifest")
  const response = await page.request.get("/manifest.webmanifest")
  const metadata: unknown = await response.json()
  expect(metadata).toMatchObject({ display: "standalone" })
  await page.waitForFunction(() => navigator.serviceWorker?.ready)
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole("heading", { name: "라스트 레인 LAST LANE" })).toBeVisible()
  await expect(page.getByText("오프라인 · 랭킹 미반영")).toBeVisible()
})
