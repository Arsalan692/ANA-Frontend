import type { Page } from '@playwright/test'

// Stands in for the screening service (backend/) in browser tests, which run without Python.
// Calls follow the file name (…negative… → negative, …weak… → a low-confidence positive, otherwise
// positive), combined with the service's majority rule. The real model is covered by model.spec.ts.
export async function mockScreening(page: Page, { delay = 0 }: { delay?: number } = {}) {
  await page.unroute('**/api/screen')
  await page.route('**/api/screen', async route => {
    const body = route.request().postDataBuffer()?.toString('latin1') ?? ''
    const names = [...body.matchAll(/filename="([^"]+)"/g)].map(match => match[1])
    const fields = names.map(name => {
      const call = name.includes('negative') ? 'negative' : 'positive'
      const confidence = name.includes('weak') ? 0.62 : call === 'negative' ? 0.97 : 0.95
      return { name, call, confidence, probabilityPositive: call === 'positive' ? confidence : 1 - confidence }
    })
    const positives = fields.filter(field => field.call === 'positive').length
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    await route.fulfill({ json: {
      model: { label: 'ResNet18 · AIDA binary · 512 px', checkpoint: 'aida_binary_resnet18_512_best.pt', sha256: 'test00000000', epoch: 20, resolution: 512, trainingData: 'AIDA public dataset (2,000 images)' },
      analysedAt: new Date().toISOString(),
      fields,
      sample: { call: positives * 2 >= fields.length ? 'positive' : 'negative', needsReview: positives > 0 && positives < fields.length,
        positiveFields: positives, totalFields: fields.length, rule: 'Majority of fields; a tie is reported as positive.' },
    } }).catch(() => { /* The page may have cancelled the request. */ })
  })
}

export async function stopScreening(page: Page) {
  await page.unroute('**/api/screen')
  await page.route('**/api/screen', route => route.abort('connectionrefused'))
}
