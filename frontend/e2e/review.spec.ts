import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openSample(page: Page, id: string) {
  await page.goto(`/samples/${id}`)
  await expect(page.getByRole('heading', { name: 'Sample review' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
const panel = (page: Page) => page.getByRole('complementary', { name: 'Sample interpretation' })

test('positive sample shows the D review layout with labelled demo data', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await openSample(page, 's-0248')
  await expect(page.getByText('Demo data', { exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('S-0248')
  await expect(page.getByRole('link', { name: 'Workspace', exact: true }).first()).toHaveAttribute('aria-current', 'page')
  await expect(panel(page).getByRole('heading', { name: 'ANA positive' })).toBeVisible()
  await expect(panel(page).getByRole('meter', { name: 'Model confidence' })).toHaveAttribute('aria-valuetext', '94.2%')
  await expect(panel(page)).toContainText('4 of 4 fields agree')
  await expect(panel(page)).toContainText('Decision support, not a diagnosis.')
  await expect(page.getByRole('region', { name: 'Sample fields' }).getByRole('figure')).toHaveCount(4)
  await expect(page.getByText('Synthetic illustration').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('negative, disagreement and missing-confidence states render honestly', async ({ page }) => {
  await openSample(page, 's-0251')
  await expect(panel(page).getByRole('heading', { name: 'ANA negative' })).toBeVisible()
  await openSample(page, 's-0263')
  await expect(panel(page)).toContainText('2 of 4 fields agree')
  await expect(panel(page)).toContainText('Needs a closer look.')
  await expect(page.getByText('Needs closer review')).toBeVisible()
  await openSample(page, 's-0270')
  await expect(panel(page)).toContainText('Not provided for this result.')
  await expect(panel(page).getByRole('meter')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Sample fields' }).getByRole('figure')).toHaveCount(3)
})

test('field results dialog lists every field and returns focus', async ({ page }) => {
  await openSample(page, 's-0263')
  const trigger = page.getByRole('button', { name: 'View field results' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Field results' })
  await expect(dialog.getByRole('row')).toHaveCount(5)
  await expect(dialog).toContainText('Negative')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('completing a review persists across navigation within the session', async ({ page }) => {
  await openSample(page, 's-0248')
  await page.getByRole('button', { name: 'Complete review' }).click()
  await expect(page.getByRole('button', { name: 'Review completed' })).toBeDisabled()
  await expect(page.getByText(/^Reviewed \d/)).toBeVisible()
  await page.getByRole('link', { name: 'Workspace', exact: true }).first().click()
  await page.getByRole('link', { name: /S-0248/ }).click()
  await expect(page.getByRole('button', { name: 'Review completed' })).toBeVisible()
})

test('unknown samples show a not-found state', async ({ page }) => {
  await page.goto('/samples/s-9999')
  await expect(page.getByRole('heading', { name: 'No sample under this reference.' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to workspace' }).click()
  await expect(page.getByRole('heading', { name: 'Prepare a sample.' })).toBeVisible()
})

test('review layout stays within the viewport at every width', async ({ page }) => {
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await openSample(page, 's-0248')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/review-${width}.png`, fullPage: true })
  }
})
