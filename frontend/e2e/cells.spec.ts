import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { cellFile, MODELS, mockService, stopService } from './serviceMock'

const cards = (page: Page) => page.getByRole('list', { name: 'Cells' }).getByRole('listitem')

async function open(page: Page) {
  await mockService(page)
  await page.goto('/cells')
  await expect(page.getByRole('heading', { name: 'Name the pattern.' })).toBeVisible()
}

test('cells are classified one by one, with family, confidence, all probabilities and an uncertain warning', async ({ page }) => {
  const problems: string[] = []
  page.on('pageerror', error => problems.push(error.message))
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()) })
  await open(page)
  // The limits come from the service and are visible before anything is uploaded.
  const about = page.getByRole('complementary', { name: 'About the pattern model' })
  await expect(about).toContainText('Upload one cropped cell per image, not a whole microscope field.')
  await expect(about).toContainText('Any other pattern, or a negative cell, still gets one of these names.')
  await expect(about).toContainText('not for diagnosis')
  const classify = about.getByRole('button', { name: 'Classify cells' })
  await expect(classify).toBeDisabled()

  await page.getByTestId('cell-input').setInputFiles([cellFile('speckled-1.png'), cellFile('nucleolar-2.png'), cellFile('uncertain-3.png')])
  await expect(cards(page)).toHaveCount(3)
  await expect(cards(page).first()).toContainText('Not classified yet.')
  await classify.click()
  await expect(page.getByText('3 of 3 classified · 1 uncertain')).toBeVisible()

  const speckled = cards(page).nth(0)
  await expect(speckled.getByRole('heading', { name: 'Speckled' })).toBeVisible()
  await expect(speckled).toContainText('95.5% model confidence')
  for (const family of ['Homogeneous', 'Speckled', 'Nucleolar']) await expect(speckled.getByRole('meter', { name: `${family} probability` })).toBeVisible()
  await expect(speckled.getByRole('meter', { name: 'Speckled probability' })).toHaveAttribute('aria-valuetext', '95.5%')
  await expect(speckled.getByText('Uncertain.')).toHaveCount(0)
  await expect(cards(page).nth(1).getByRole('heading', { name: 'Nucleolar' })).toBeVisible()

  const uncertain = cards(page).nth(2)
  await expect(uncertain).toContainText('60.0% model confidence')
  await expect(uncertain).toContainText('Uncertain. The model\'s confidence is below 70%')

  // The thumbnail shows the model's own view once classified, and can be switched back to the upload.
  await expect(speckled.getByRole('img')).toHaveAccessibleName(/as the model sees it/)
  await speckled.getByRole('button', { name: /show original/ }).click()
  await expect(speckled.getByRole('img')).toHaveAccessibleName('Cell 1: speckled-1.png')

  // Results survive leaving the page; only new cells are sent next time.
  await page.getByRole('link', { name: 'Workspace', exact: true }).first().click()
  await page.getByRole('link', { name: 'Cell patterns' }).first().click()
  await expect(page.getByText('3 of 3 classified · 1 uncertain')).toBeVisible()
  await expect(classify).toBeDisabled()
  await page.getByTestId('cell-input').setInputFiles([cellFile('homogeneous-4.png')])
  await expect(page.getByText('3 of 4 classified · 1 uncertain')).toBeVisible()
  const sent = page.waitForRequest('**/api/cells')
  await classify.click()
  expect(((await sent).postDataBuffer()?.toString('latin1') ?? '').match(/filename="/g)).toHaveLength(1)
  await expect(page.getByText('4 of 4 classified · 1 uncertain')).toBeVisible()

  await cards(page).nth(2).getByRole('button', { name: 'Remove uncertain-3.png' }).click()
  await expect(page.getByText('3 of 3 classified', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(page.getByText('No cells yet.')).toBeVisible()
  expect(problems).toEqual([])
})

test('an image far larger than a cell is questioned, and bad or repeated files are explained', async ({ page }) => {
  await open(page)
  await page.getByTestId('cell-input').setInputFiles([cellFile('whole-field.png'), { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('text') }, { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') }])
  await expect(page.getByRole('alert')).toContainText('notes.txt: use a JPEG, PNG or BMP image.')
  await expect(page.getByRole('alert')).toContainText('broken.png: this image could not be opened.')
  await expect(cards(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'Classify cells' }).first().click()
  await expect(cards(page).first()).toContainText('Is this one cell? At 2448 × 2048 px this image is much larger than a single cropped cell.')
})

test('a stopped service keeps the cells and says how to start it; a missing model disables classifying', async ({ page }) => {
  await open(page)
  await page.getByTestId('cell-input').setInputFiles([cellFile('speckled-1.png')])
  await stopService(page)
  await page.getByRole('button', { name: 'Classify cells' }).first().click()
  await expect(page.getByRole('alert')).toContainText('npm.cmd run api')
  await expect(page.getByRole('alert')).toContainText('Your cell images are still here.')
  await expect(cards(page)).toHaveCount(1)
  await mockService(page)
  await page.getByRole('button', { name: 'Classify cells' }).first().click()
  await expect(cards(page).first().getByRole('heading', { name: 'Speckled' })).toBeVisible()

  await mockService(page, { models: MODELS.map(model => model.task === 'cells' ? { ...model, available: false } : model) })
  await page.reload()
  await expect(page.getByText('No model of this kind is installed.')).toBeVisible()
  await page.getByTestId('cell-input').setInputFiles([cellFile('speckled-1.png')])
  await expect(page.getByRole('complementary', { name: 'About the pattern model' }).getByRole('button', { name: 'Classify cells' })).toBeDisabled()
})

test('the cells page fits every width, and a phone gets a pinned classify bar', async ({ page }) => {
  for (const width of [1440, 1280, 900, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await open(page)
    await page.getByTestId('cell-input').setInputFiles([cellFile('speckled-1.png'), cellFile('uncertain-2.png')])
    await expect(cards(page)).toHaveCount(2)
    if (width === 390) {
      const bar = page.getByRole('region', { name: 'Classify these cells' })
      await expect(bar).toBeInViewport()
      await bar.getByRole('button', { name: 'Classify cells' }).click()
    } else await page.getByRole('button', { name: 'Classify cells' }).first().click()
    await expect(page.getByText('2 of 2 classified · 1 uncertain')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no sideways scroll at ${width}`).toBe(true)
    await page.screenshot({ path: `test-results/cells-${width}.png`, fullPage: true })
  }
})
