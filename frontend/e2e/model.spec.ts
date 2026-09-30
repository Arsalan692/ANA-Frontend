import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// Runs the real ResNet18 model through the UI. Needs the screening service and the demo images:
//   npm.cmd run api                                                   (in another terminal)
//   ..\backend\.venv\Scripts\python.exe ..\backend\scripts\copy_demo_images.py
//   $env:MODEL_E2E='1'; npx.cmd playwright test model
// The three samples come from the reserved AIDA test split; expected calls are the model's own
// test-split predictions, which match the notebook's reported test results.

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

  await analyse(page, folder('1-positive-sample-39'))
  await expect(panel(page).getByRole('heading', { name: 'ANA positive' })).toBeVisible()
  await expect(panel(page)).toContainText('3 of 3 fields agree')
  await expect(page.getByText('Research model', { exact: true })).toBeVisible()
  await panel(page).getByText('Analysis details').click()
  await expect(panel(page)).toContainText('aida_binary_resnet18_512_best.pt · epoch 20')

  await analyse(page, folder('2-negative-sample-869'))
  await expect(panel(page).getByRole('heading', { name: 'ANA negative' })).toBeVisible()
  await expect(panel(page)).toContainText('3 of 3 fields agree')

  await analyse(page, folder('3-fields-disagree-sample-137'))
  await expect(panel(page).getByRole('heading', { name: 'ANA positive' })).toBeVisible()
  await expect(panel(page)).toContainText('2 of 3 fields agree')
  await expect(panel(page)).toContainText('Needs a closer look.')
  await page.screenshot({ path: 'test-results/model-disagree.png', fullPage: true })
  expect(problems).toEqual([])
})
