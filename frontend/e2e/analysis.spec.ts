import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'

const source = (name: string) => path.resolve(`assets-source/${name}.png`)
const panel = (page: Page) => page.getByRole('complementary', { name: 'Sample interpretation' })

async function prepare(page: Page, files: string[]) {
  await page.goto('/workspace')
  await page.getByTestId('file-input').setInputFiles(files.map(source))
  await expect(page.getByAltText(/^Selected field/)).toHaveCount(files.length)
}

test('analysing uploaded fields runs the simulated stages and opens a labelled result', async ({ page }) => {
  await prepare(page, ['field-positive-01', 'field-positive-02'])
  const analyse = page.getByRole('button', { name: 'Analyse sample' })
  await analyse.dblclick()
  await expect(page.getByRole('dialog', { name: 'Screening the sample.' })).toBeVisible()
  await expect(page).toHaveURL(/\/samples\/s-0301$/, { timeout: 10_000 })
  await expect(page.getByText('Simulated analysis', { exact: true })).toBeVisible()
  await expect(panel(page).getByRole('heading', { name: 'ANA positive' })).toBeVisible()
  await expect(panel(page)).toContainText('Not provided for this result.')
  await expect(page.getByRole('region', { name: 'Sample fields' }).getByRole('figure')).toHaveCount(2)
  await expect(page.getByRole('img', { name: 'Field 01' })).toBeVisible()
  // The double click must not have started a second job.
  await page.goto('/samples/s-0302')
  await expect(page.getByRole('heading', { name: 'No sample under this reference.' })).toBeVisible()
})

test('images move to the new sample, leaving a clean workspace, and unstained fields read negative', async ({ page }) => {
  await prepare(page, ['field-negative-01', 'field-negative-02'])
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(panel(page).getByRole('heading', { name: 'ANA negative' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('link', { name: 'New sample' }).click()
  await expect(page.getByRole('button', { name: 'Choose images' })).toBeVisible()
  await expect(page.getByRole('link', { name: /S-0301/ })).toBeVisible()
})

test('a simulated failure keeps the images and retry completes the analysis', async ({ page }) => {
  await prepare(page, ['field-weak-01', 'field-negative-01'])
  await page.getByLabel('Simulate a failed analysis (demo)').check()
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(page.getByRole('dialog', { name: 'The analysis did not finish.' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByAltText(/^Selected field/)).toHaveCount(2)
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(page.getByRole('dialog', { name: 'The analysis did not finish.' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(panel(page)).toContainText('Needs a closer look.', { timeout: 10_000 })
})

test('cancelling an analysis returns to the draft without creating a sample', async ({ page }) => {
  await prepare(page, ['field-positive-03'])
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page).toHaveURL(/\/workspace$/)
  await page.waitForTimeout(2500)
  await expect(page).toHaveURL(/\/workspace$/)
  await expect(page.getByAltText(/^Selected field/)).toHaveCount(1)
})

test('the viewer steps through fields by keyboard and returns focus to the last tile', async ({ page }) => {
  await page.goto('/samples/s-0263')
  await page.getByRole('button', { name: 'Open Field 01 in the viewer' }).click()
  const viewer = page.getByRole('dialog', { name: 'Field 01' })
  await expect(viewer).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Field 03' })).toContainText('Negative')
  await page.getByRole('button', { name: 'Previous field' }).click()
  await expect(page.getByRole('dialog', { name: 'Field 02' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Field 02 in the viewer' })).toBeFocused()
})

test('viewer and analysis dialog fit phone and desktop screens', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/samples/s-0248')
    await page.getByRole('button', { name: 'Open Field 01 in the viewer' }).click()
    await expect(page.getByRole('dialog', { name: 'Field 01' })).toBeVisible()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `test-results/viewer-${width}.png` })
    await page.keyboard.press('Escape')
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await prepare(page, ['field-positive-01', 'field-positive-02', 'field-positive-03'])
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(page.getByText(/Field \d of 3/)).toBeVisible()
  await page.screenshot({ path: 'test-results/analysis-1440.png' })
})
