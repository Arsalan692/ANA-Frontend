import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// Runs the real models (weights in ../models/) through the UI. Needs the screening service and the demo images:
//   npm.cmd run api                                                   (in another terminal)
//   ..\backend\.venv\Scripts\python.exe ..\backend\scripts\copy_demo_images.py
//   $env:MODEL_E2E='1'; npx.cmd playwright test model
// The three samples come from fold 1, the checkpoint's held-out test fold; expected calls are the
// model's own fold-1 predictions, which match the training project's reported round-1 results.

test.skip(!process.env.MODEL_E2E, 'Set MODEL_E2E=1 with the screening service running')

const folder = (name: string) => {
  const dir = path.resolve('..', 'demo-images', name)
  return fs.readdirSync(dir).sort().map(file => path.join(dir, file))
}
const panel = (page: Page) => page.getByRole('complementary', { name: 'Sample interpretation' })

async function analyse(page: Page, files: string[]) {
  await page.goto('/workspace')
  await page.getByTestId('file-input').setInputFiles(files)
  await expect(page.getByAltText(/^Selected field/)).toHaveCount(files.length)
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(page).toHaveURL(/\/samples\/s-03\d\d$/, { timeout: 30_000 })
}

test('the real model screens held-out AIDA samples through the UI', async ({ page }) => {
  const problems: string[] = []
  page.on('pageerror', error => problems.push(error.message))
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()) })

  await analyse(page, folder('1-positive-sample-40'))
  await expect(panel(page).getByRole('heading', { name: 'ANA positive' })).toBeVisible()
  await expect(panel(page)).toContainText('3 of 3 fields agree')
  await expect(page.getByText('Research model', { exact: true })).toBeVisible()
  await panel(page).getByText('Analysis details').click()
  await expect(panel(page)).toContainText('best.pt · fd8f72281230')

  await analyse(page, folder('2-negative-sample-866'))
  await expect(panel(page).getByRole('heading', { name: 'ANA negative' })).toBeVisible()
  await expect(panel(page)).toContainText('3 of 3 fields agree')

  await analyse(page, folder('3-fields-disagree-sample-137'))
  await expect(panel(page).getByRole('heading', { name: 'ANA positive' })).toBeVisible()
  await expect(panel(page)).toContainText('2 of 3 fields agree')
  await expect(panel(page)).toContainText('Needs a closer look.')
  await page.screenshot({ path: 'test-results/model-disagree.png', fullPage: true })
  expect(problems).toEqual([])
})

test('switching model in the workspace runs the other real model with its own pipeline', async ({ page }) => {
  await page.goto('/workspace')
  const picker = page.getByLabel('Screening model')
  await expect(picker).toHaveValue('efficientnet-b0-aida-r1')
  await picker.selectOption('resnet18-aida-512')
  const files = folder('3-fields-disagree-sample-137')
  await page.getByTestId('file-input').setInputFiles(files)
  await expect(page.getByAltText(/^Selected field/)).toHaveCount(files.length)
  await page.getByRole('button', { name: 'Analyse sample' }).click()
  await expect(page).toHaveURL(/\/samples\/s-0301$/, { timeout: 30_000 })
  // Sample 137 is also in this model's own test split; these are its test-split values (30 Sep 2026).
  const fields = page.getByRole('region', { name: 'Sample fields' })
  await expect(fields).toContainText('66.5%')
  await expect(fields).toContainText('95.5%')
  await expect(fields).toContainText('74.1%')
  await panel(page).getByText('Analysis details').click()
  await expect(panel(page)).toContainText('ResNet18 · AIDA · 512 px')
  await expect(panel(page)).toContainText('aida_binary_resnet18_512_best.pt')
  await expect(panel(page)).toContainText('Whole field padded with black')
  await page.screenshot({ path: 'test-results/model-resnet.png', fullPage: true })
})

test('the real pattern model classifies single cells and flags the one it is unsure about', async ({ page }) => {
  const problems: string[] = []
  page.on('pageerror', error => problems.push(error.message))
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()) })
  await page.goto('/cells')
  await expect(page.getByRole('complementary', { name: 'About the pattern model' })).toContainText('Upload one cropped cell per image')
  await page.getByTestId('cell-input').setInputFiles(folder('cells'))
  const cards = page.getByRole('list', { name: 'Cells' }).getByRole('listitem')
  await expect(cards).toHaveCount(4)
  await page.getByRole('button', { name: 'Classify cells' }).first().click()
  await expect(page.getByText('4 of 4 classified · 1 uncertain')).toBeVisible({ timeout: 60_000 })
  // Dataset labels are in the file names. These cells are NOT held out for the five-model average.
  for (const family of ['Homogeneous', 'Nucleolar', 'Speckled']) {
    const card = cards.filter({ hasText: `${family.toLowerCase()}-` }).filter({ hasNotText: 'uncertain-' })
    await expect(card.getByRole('heading', { name: family })).toBeVisible()
    await expect(card.getByText('Uncertain.')).toHaveCount(0)
  }
  // A true Nucleolar cell that the model calls Homogeneous at about 60%: the warning must be shown.
  const unsure = cards.filter({ hasText: 'uncertain-true-nucleolar' })
  await expect(unsure.getByRole('heading', { name: 'Homogeneous' })).toBeVisible()
  await expect(unsure).toContainText('Uncertain. The model\'s confidence is below 70%')
  await page.getByRole('complementary', { name: 'About the pattern model' }).getByText('Model details').click()
  await expect(page.getByRole('complementary', { name: 'About the pattern model' })).toContainText('ResNet18, one per cross-validation round')
  await page.screenshot({ path: 'test-results/model-cells.png', fullPage: true })
  expect(problems).toEqual([])
})

test('the real 6-class model gives the training script numbers for the green example photos', async ({ page }) => {
  await page.goto('/cells')
  const about = page.getByRole('complementary', { name: 'About the pattern model' })
  await about.getByLabel('Pattern model').selectOption({ label: 'ResNet18 ensemble · 6 patterns' })
  await page.getByTestId('cell-input').setInputFiles(folder('cell-photos'))
  const cards = page.getByRole('list', { name: 'Cells' }).getByRole('listitem')
  await about.getByRole('button', { name: 'Classify cells' }).click()
  await expect(page.getByText('2 of 2 classified', { exact: true })).toBeVisible({ timeout: 60_000 })
  // outputs/phase9/examples_predictions.csv: Homogeneous 0.5611 (named Homogeneous); 0.3448, named Speckled 0.5806.
  const homogeneous = cards.filter({ hasText: 'green_homogeneous' })
  await expect(homogeneous.getByRole('heading', { name: 'Homogeneous' })).toBeVisible()
  await expect(homogeneous).toContainText('56.1% model confidence')
  const speckled = cards.filter({ hasText: 'green_speckled' })
  await expect(speckled.getByRole('heading', { name: 'Speckled' })).toBeVisible()
  await expect(speckled).toContainText('58.1% model confidence')
  await expect(speckled.getByRole('meter', { name: 'Homogeneous probability' })).toHaveAttribute('aria-valuetext', '34.5%')
  for (const card of [homogeneous, speckled]) {
    await card.getByText('Details').click()
    await expect(card).toContainText('Experimental.')
  }
  await page.screenshot({ path: 'test-results/model-homogeneous.png', fullPage: true })
})
