import type { Page } from '@playwright/test'

// Stands in for the screening service (backend/) in browser tests, which run without Python. It offers
// two screening models and one cell model, as the real service does. The real models are covered by
// model.spec.ts.
//
// Screening: calls follow the file name (…negative… → negative, …weak… → a low-confidence positive,
// otherwise positive), combined with the service's majority rule.
// Cells: the family follows the file name (…speckled…, …nucleolar…, otherwise Homogeneous); "uncertain"
// gives 60% and the uncertain flag; "field" marks the image as far larger than one cell.

const FAMILIES = ['Homogeneous', 'Speckled', 'Nucleolar']
const detail = (value: string) => [{ label: 'Training', value }]

export const MODELS = [
  { id: 'efficientnet-b0-aida-r1', task: 'screening', label: 'EfficientNet-B0 · AIDA · 512 px', summary: 'Calibrated confidence. Looks at the centre square of each field.', available: true, default: true, details: detail('AIDA, round 1') },
  { id: 'resnet18-aida-512', task: 'screening', label: 'ResNet18 · AIDA · 512 px', summary: 'Earlier baseline. Looks at the whole field (padded, not cropped).', available: true, default: false, details: detail('AIDA, fixed split') },
  { id: 'cells-resnet18-adjusted', task: 'cells', label: 'ResNet18 ensemble · 3 pattern families', summary: 'Five models averaged, calibrated.', available: true, default: true,
    details: [{ label: 'Models', value: 'ResNet18, one per cross-validation round; their probabilities are averaged' }],
    classes: FAMILIES, minConfidence: 0.7,
    limits: ['Upload one cropped cell per image, not a whole microscope field.', 'The model knows only Homogeneous, Speckled and Nucleolar. Any other pattern, or a negative cell, still gets one of these names.',
      'Cells should be roughly 60 to 100 pixels across.', 'For research and demonstration only, not for diagnosis.'] },
]
type MockModel = typeof MODELS[number]

/** A valid 8 × 8 grey PNG, used as an uploaded "cell" and as the mock's model view. */
export const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAAAAADhZOFXAAAAEElEQVR42mPUYIAAJgaKGAANoAA4MHQe+QAAAABJRU5ErkJggg=='
export const cellFile = (name: string) => ({ name, mimeType: 'image/png', buffer: Buffer.from(TINY_PNG, 'base64') })

const PATHS = ['**/api/models', '**/api/screen', '**/api/cells']  // Exact: wider patterns would also catch src/api/ modules.

function readForm(body: string, task: string, models: MockModel[]) {
  const names = [...body.matchAll(/filename="([^"]+)"/g)].map(match => match[1])
  const chosen = body.match(/name="model"\r\n\r\n([^\r]+)/)?.[1]
  const forTask = models.filter(model => model.task === task)
  const model = forTask.find(candidate => candidate.id === chosen) ?? forTask.find(candidate => candidate.default) ?? forTask[0]
  return { names, model: { id: model.id, task, label: model.label, checkpoint: `${model.id}.pt`, sha256: 'test00000000', details: [{ label: 'Checkpoint', value: `${model.id}.pt · test00000000` }, ...model.details] } }
}

export async function mockService(page: Page, { delay = 0, models = MODELS }: { delay?: number; models?: MockModel[] } = {}) {
  for (const path of PATHS) await page.unroute(path)
  const wait = () => delay ? new Promise(resolve => setTimeout(resolve, delay)) : Promise.resolve()
  const defaults = Object.fromEntries(['screening', 'cells'].map(task => [task, models.find(model => model.task === task && model.default)?.id ?? null]))
  await page.route('**/api/models', route => route.fulfill({ json: { defaults, models } }))
  await page.route('**/api/screen', async route => {
    const { names, model } = readForm(route.request().postDataBuffer()?.toString('latin1') ?? '', 'screening', models)
    const fields = names.map(name => {
      const call = name.includes('negative') ? 'negative' : 'positive'
      const confidence = name.includes('weak') ? 0.62 : call === 'negative' ? 0.97 : 0.95
      return { name, call, confidence, probabilityPositive: call === 'positive' ? confidence : 1 - confidence }
    })
    const positives = fields.filter(field => field.call === 'positive').length
    await wait()
    await route.fulfill({ json: { model, analysedAt: new Date().toISOString(), fields,
      sample: { call: positives * 2 >= fields.length ? 'positive' : 'negative', needsReview: positives > 0 && positives < fields.length,
        positiveFields: positives, totalFields: fields.length, rule: 'Majority of fields; a tie is reported as positive.' } } }).catch(() => { /* Cancelled by the page. */ })
  })
  await page.route('**/api/cells', async route => {
    const { names, model } = readForm(route.request().postDataBuffer()?.toString('latin1') ?? '', 'cells', models)
    const cells = names.map(name => {
      const family = FAMILIES.find(candidate => name.includes(candidate.toLowerCase())) ?? 'Homogeneous'
      const confidence = name.includes('uncertain') ? 0.6 : 0.955
      const others = FAMILIES.filter(candidate => candidate !== family)
      const probabilities = Object.fromEntries(FAMILIES.map(candidate => [candidate, candidate === family ? confidence : candidate === others[0] ? (1 - confidence) * 0.75 : (1 - confidence) * 0.25]))
      const big = name.includes('field')
      return { name, width: big ? 2448 : 73, height: big ? 2048 : 65, oversized: big, family, confidence, uncertain: confidence < 0.7, probabilities, modelsUsed: 5, modelView: `data:image/png;base64,${TINY_PNG}` }
    })
    await wait()
    await route.fulfill({ json: { model, analysedAt: new Date().toISOString(), cells } }).catch(() => { /* Cancelled by the page. */ })
  })
}

/** The service is not running: every request to it fails to connect. */
export async function stopService(page: Page) {
  for (const path of PATHS) {
    await page.unroute(path)
    await page.route(path, route => route.abort('connectionrefused'))
  }
}
