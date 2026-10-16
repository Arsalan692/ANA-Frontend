import { afterEach, describe, expect, it, vi } from 'vitest'
import { screenSample } from './screening'
import type { ServiceError } from './service'

const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })]
const result = {
  model: { id: 'effnet', task: 'screening', label: 'EfficientNet-B0', checkpoint: 'best.pt', sha256: 'abc', details: [{ label: 'Checkpoint', value: 'best.pt · abc' }] },
  analysedAt: '2026-09-30T10:00:00Z',
  fields: [{ name: 'a.png', call: 'positive', confidence: 0.9, probabilityPositive: 0.9 }, { name: 'b.png', call: 'negative', confidence: 0.8, probabilityPositive: 0.2 }],
  sample: { call: 'positive', needsReview: true, positiveFields: 1, totalFields: 2, rule: 'Majority' },
}
const respond = (status: number, body?: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(body === undefined ? '' : JSON.stringify(body), { status })))

afterEach(() => { vi.unstubAllGlobals() })

describe('sample screening client', () => {
  it('posts the sample to /api/screen with the chosen model and returns the result', async () => {
    respond(200, result)
    await expect(screenSample(files, { model: 'effnet' })).resolves.toEqual(result)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/screen')
    expect((init?.body as FormData).get('model')).toBe('effnet')
  })

  it('refuses a result that does not cover every field', async () => {
    respond(200, { ...result, fields: result.fields.slice(0, 1) })
    const error = await screenSample(files).catch((caught: unknown) => caught as ServiceError)
    expect(error).toMatchObject({ kind: 'failed' })
  })
})
