import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import { MODELS, mockService, stopService } from './serviceMock'

const source = (name: string) => path.resolve(`assets-source/${name}.png`)
const panel = (page: Page) => page.getByRole('complementary', { name: 'Sample interpretation' })

async function prepare(page: Page, files: string[]) {
  await mockService(page)
  await page.goto('/workspace')
  await page.getByTestId('file-input').setInputFiles(files.map(source))
  await expect(page.getByAltText(/^Selected field/)).toHaveCount(files.length)
}

test('analysing uploaded fields sends them to the screening service and opens a labelled result', async ({ page }) => {
  await prepare(page, ['field-positive-01', 'field-positive-02'])
  const analyse = page.getByRole('button', { name: 'Analyse sample' })
  await analyse.dblclick()
  await expect(page.getByRole('dialog', { name: 'Screening the sample.' })).toBeVisible()
  await expect(page).toHaveURL(/\/samples\/s-0301$/, { timeout: 10_000 })
  await expect(page.getByText('Research model', { exact: true })).toBeVisible()
  await expect(panel(page).getByRole('heading', { name: 'ANA positive' })).toBeVisible()
  // Per-field confidence comes from the model; there is no sample-level confidence to show.
  await expect(page.getByRole('region', { name: 'Sample fields' })).toContainText('95.0%')
  await expect(panel(page)).toContainText('Not reported for the whole sample.')
  await expect(panel(page)).toContainText('Not clinically validated.')
  await panel(page).getByText('Analysis details').click()
  await expect(panel(page)).toContainText('efficientnet-b0-aida-r1.pt · test00000000')
  await expect(panel(page)).toContainText('Majority of fields; a tie is reported as positive.')
  await expect(page.getByRole('region', { name: 'Sample fields' }).getByRole('figure')).toHaveCount(2)
  await expect(page.getByRole('img', { name: 'Field 01' })).toBeVisible()
  // The double click must not have started a second job.
  await page.goto('/samples/s-0302')
  await expect(page.getByRole('heading', { name: 'No sample under this reference.' })).toBeVisible()
})

test('images move to the new sample, leaving a clean workspace, and negative fields read negative', async ({ page }) => {
  await prepare(page, ['field-negative-01', 'field-negative-02'])
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(panel(page).getByRole('heading', { name: 'ANA negative' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('link', { name: 'New sample' }).click()
  await expect(page.getByRole('button', { name: 'Choose images' })).toBeVisible()
  await expect(page.getByRole('link', { name: /S-0301/ })).toBeVisible()
})

test('when the screening service is not running the images are kept and retry completes the analysis', async ({ page }) => {
  await prepare(page, ['field-weak-01', 'field-negative-01'])
  await stopService(page)
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  const failed = page.getByRole('dialog', { name: 'The analysis did not finish.' })
  await expect(failed).toContainText('npm.cmd run api', { timeout: 10_000 })
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByAltText(/^Selected field/)).toHaveCount(2)
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(failed).toBeVisible({ timeout: 10_000 })
  await mockService(page)
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(panel(page)).toContainText('Needs a closer look.', { timeout: 10_000 })
})

test('the chosen model screens the sample and is named on the result', async ({ page }) => {
  await prepare(page, ['field-positive-01', 'field-negative-01'])
  const picker = page.getByLabel('Screening model')
  // The service's default is selected, with its description.
  await expect(picker).toHaveValue('efficientnet-b0-aida-r1')
  await expect(page.getByText('Calibrated confidence. Looks at the centre square of each field.')).toBeVisible()
  await picker.selectOption({ label: 'ResNet18 · AIDA · 512 px' })
  await expect(page.getByText('Earlier baseline. Looks at the whole field (padded, not cropped).')).toBeVisible()
  // The choice survives leaving the workspace and coming back.
  await page.getByRole('link', { name: 'Research' }).first().click()
  await page.getByRole('link', { name: 'Workspace', exact: true }).first().click()
  await expect(picker).toHaveValue('resnet18-aida-512')
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(page).toHaveURL(/\/samples\/s-0301$/, { timeout: 10_000 })
  await panel(page).getByText('Analysis details').click()
  await expect(panel(page)).toContainText('ResNet18 · AIDA · 512 px')
  await expect(panel(page)).toContainText('resnet18-aida-512.pt · test00000000')
  // Back in the workspace, the session list says which model produced the sample.
  await page.getByRole('link', { name: 'New sample' }).click()
  await expect(page.getByRole('link', { name: /S-0301/ })).toContainText('ResNet18 · AIDA · 512 px')
})

test('a model without its weights file cannot be chosen, and a stopped service is explained', async ({ page }) => {
  await mockService(page, { models: [MODELS[0], { ...MODELS[1], available: false }] })
  await page.goto('/workspace')
  const picker = page.getByLabel('Screening model')
  await expect(picker.getByRole('option', { name: 'ResNet18 · AIDA · 512 px (files missing)' })).toBeDisabled()
  await expect(picker).toHaveValue('efficientnet-b0-aida-r1')

  await stopService(page)
  await page.reload()
  await expect(picker).toBeDisabled()
  await expect(page.getByText('The screening service is not running.')).toBeVisible()
  // Once the service is started, "Check again" finds the models.
  await mockService(page)
  await page.getByRole('button', { name: 'Check again' }).click()
  await expect(picker).toBeEnabled()
  await expect(picker).toHaveValue('efficientnet-b0-aida-r1')
})

test('files the service rejects are listed with their reasons', async ({ page }) => {
  await prepare(page, ['field-positive-01', 'field-negative-01'])
  await page.unroute('**/api/screen')
  await page.route('**/api/screen', route => route.fulfill({ status: 422, json: { detail: { message: 'Some images could not be screened.', files: [{ name: 'field-negative-01.png', error: 'this image could not be opened.' }] } } }))
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  const failed = page.getByRole('dialog', { name: 'The analysis did not finish.' })
  await expect(failed).toContainText('field-negative-01.png: this image could not be opened.', { timeout: 10_000 })
  await expect(failed).toContainText('Your images are still in the workspace.')
})

test('cancelling an analysis returns to the draft without creating a sample', async ({ page }) => {
  await prepare(page, ['field-positive-03'])
  await mockService(page, { delay: 1500 })
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
  await mockService(page, { delay: 1500 })
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(page.getByText('3 fields', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/analysis-1440.png' })
})
