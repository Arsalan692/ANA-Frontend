import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'

const source = (name: string) => path.resolve(`assets-source/${name}.png`)

// Collects runtime errors and console errors; Motion's reduced-motion notice is a warning, not an error.
function watchConsole(page: Page) {
  const problems: string[] = []
  page.on('pageerror', error => problems.push(error.message))
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()) })
  return problems
}

test('Friday demo journey: demo samples, upload, analyse, inspect, review — without console errors', async ({ page }) => {
  const problems = watchConsole(page)
  await page.goto('/workspace')

  // Walk each demo sample from the workspace shortcuts.
  for (const [reference, result] of [['S-0248', 'ANA positive'], ['S-0251', 'ANA negative'], ['S-0263', 'ANA positive'], ['S-0270', 'ANA positive']]) {
    await page.getByRole('link', { name: new RegExp(reference) }).click()
    await expect(page.getByRole('heading', { name: result })).toBeVisible()
    await page.getByRole('link', { name: 'Workspace', exact: true }).first().click()
  }

  // Upload a mixed sample, analyse it, and review the flagged result.
  await page.getByTestId('file-input').setInputFiles(['field-positive-01', 'field-positive-02', 'field-weak-01', 'field-negative-01'].map(source))
  await expect(page.getByAltText(/^Selected field/)).toHaveCount(4)
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(page).toHaveURL(/\/samples\/s-0301$/, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'ANA positive' })).toBeVisible()
  await expect(page.getByText('3 of 4 fields agree')).toBeVisible()
  await expect(page.getByText('Needs a closer look.')).toBeVisible()

  // Inspect fields in the viewer, check the table, then complete the review.
  await page.getByRole('button', { name: 'Open Field 04 in the viewer' }).click()
  await expect(page.getByRole('dialog', { name: 'Field 04' })).toContainText('Negative')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'View field results' }).click()
  await expect(page.getByRole('dialog', { name: 'Field results' }).getByRole('row')).toHaveCount(5)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Complete review' }).click()
  await expect(page.getByText('Reviewed', { exact: true })).toBeVisible()

  // Start the next sample.
  await page.getByRole('link', { name: 'New sample' }).click()
  await expect(page.getByRole('button', { name: 'Choose images' })).toBeVisible()
  await expect(page.getByRole('link', { name: /S-0301/ })).toBeVisible()
  expect(problems).toEqual([])
})

test('on a phone, the pinned bar analyses the sample without scrolling to the panel', async ({ page }) => {
  const problems = watchConsole(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/workspace')
  await expect(page.getByRole('region', { name: 'Analyse this sample' })).toHaveCount(0)
  await page.getByTestId('file-input').setInputFiles([source('field-negative-01')])
  const bar = page.getByRole('region', { name: 'Analyse this sample' })
  await expect(bar).toBeInViewport()
  await expect(bar).toContainText('01 field ready')
  await bar.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(page.getByRole('heading', { name: 'ANA negative' })).toBeVisible({ timeout: 10_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(problems).toEqual([])
})
