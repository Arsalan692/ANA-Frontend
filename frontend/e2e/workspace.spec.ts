import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'

const artwork = path.resolve('public/assets/cell-etching.png')
async function openWorkspace(page: Page) {
  await page.goto('/workspace')
  await expect(page.getByRole('heading', { name: 'Prepare a sample.' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test('workspace loads without runtime errors and supports sample preparation across routes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await openWorkspace(page)
  await expect(page.getByRole('button', { name: 'Analyse sample' })).toBeDisabled()
  await page.getByTestId('file-input').setInputFiles(artwork)
  await expect(page.getByAltText('Selected field 1: cell-etching.png')).toBeVisible()
  await page.getByRole('link', { name: 'Sample history' }).click()
  await expect(page.getByRole('heading', { name: 'A record of every review.' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to workspace' }).click()
  await expect(page.getByAltText('Selected field 1: cell-etching.png')).toBeVisible()
  await page.getByRole('button', { name: 'Clear sample', exact: true }).click()
  await page.getByRole('button', { name: 'Keep sample' }).click()
  await expect(page.getByAltText('Selected field 1: cell-etching.png')).toBeVisible()
  await page.getByRole('button', { name: 'Clear sample', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Clear sample' }).click()
  await expect(page.getByRole('button', { name: 'Choose images' })).toBeVisible()
  expect(errors).toEqual([])
})

test('mixed selections retain valid images and explain corrupt, unsupported, and duplicate files', async ({ page }) => {
  await openWorkspace(page)
  await page.getByTestId('file-input').setInputFiles([
    { name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('text') },
  ])
  await expect(page.getByRole('alert')).toContainText('could not be opened')
  await expect(page.getByRole('alert')).toContainText('JPEG or PNG')
  await page.getByTestId('file-input').setInputFiles(artwork)
  await expect(page.getByAltText('Selected field 1: cell-etching.png')).toBeVisible()
  await page.getByTestId('file-input').setInputFiles(artwork)
  await expect(page.getByRole('alert')).toContainText('already in your sample')
  await page.getByRole('button', { name: 'Remove cell-etching.png' }).click()
  await expect(page.getByRole('button', { name: 'Choose images' })).toBeVisible()
})

test('help supports keyboard closing and motion preference persists', async ({ page }) => {
  await openWorkspace(page)
  const help = page.getByRole('button', { name: 'About this workspace' }).first()
  await help.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(help).toBeFocused()
  await page.getByRole('switch').click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
  await page.reload()
  await expect(page.getByRole('switch')).toBeChecked()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('switch')).toBeDisabled()
})

test('desktop and mobile layouts stay within viewport and mobile navigation works', async ({ page }) => {
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await openWorkspace(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/workspace-${width}.png`, fullPage: true })
  }
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('dialog', { name: 'Navigation', exact: true }).getByRole('link', { name: 'Research' }).click()
  await expect(page.getByRole('heading', { name: 'Where evidence takes shape.' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).not.toBeVisible()
})
