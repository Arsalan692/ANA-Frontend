import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'

// Presentation screenshots. Skipped in normal runs; generate with:
//   $env:CAPTURE='1'; npx.cmd playwright test screens
// Output goes to ../UI Concepts/ (desktop 1440 and mobile 390).

test.skip(!process.env.CAPTURE, 'Set CAPTURE=1 to regenerate presentation screenshots')

const out = (name: string) => path.resolve('..', 'UI Concepts', `${name}.png`)
const source = (name: string) => path.resolve(`assets-source/${name}.png`)

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(700)
}

for (const [label, width, height] of [['Desktop', 1440, 1000], ['Mobile', 390, 844]] as const) {
  test(`capture ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const shot = async (name: string, fullPage = true) => { await settle(page); await page.screenshot({ path: out(`Screen-${label}-${name}`), fullPage }) }

    await page.goto('/workspace')
    await shot('1-Workspace')
    await page.getByTestId('file-input').setInputFiles(['field-positive-01', 'field-positive-02', 'field-positive-03', 'field-positive-04'].map(source))
    await expect(page.getByAltText(/^Selected field/)).toHaveCount(4)
    await shot('2-Draft')
    await page.getByRole('button', { name: 'Analyse sample' }).last().click()
    await expect(page.getByText(/Field \d of 4/)).toBeVisible()
    await shot('3-Analysing', false)
    await expect(page).toHaveURL(/\/samples\/s-0301$/, { timeout: 10_000 })
    await shot('4-Review-Uploaded')

    for (const [id, name] of [['s-0248', '5-Review-Positive'], ['s-0251', '6-Review-Negative'], ['s-0263', '7-Review-Disagree']] as const) {
      await page.goto(`/samples/${id}`)
      await shot(name)
    }
    await page.getByRole('button', { name: 'Open Field 01 in the viewer' }).click()
    await shot('8-Viewer', false)
  })
}
