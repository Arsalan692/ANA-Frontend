import { afterEach, describe, expect, it, vi } from 'vitest'
import { screenSample, ScreeningError } from './screening'

const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })]
const result = {
  model: { label: 'ResNet18', checkpoint: 'x.pt', sha256: 'abc', epoch: 20, resolution: 512, trainingData: 'AIDA' },
  analysedAt: '2026-09-30T10:00:00Z',
  fields: [{ name: 'a.png', call: 'positive', confidence: 0.9, probabilityPositive: 0.9 }, { name: 'b.png', call: 'negative', confidence: 0.8, probabilityPositive: 0.2 }],
  sample: { call: 'positive', needsReview: true, positiveFields: 1, totalFields: 2, rule: 'Majority' },
}
const respond = (status: number, body?: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(body === undefined ? '' : JSON.stringify(body), { status })))
const failure = (promise: Promise<unknown>) => promise.then(() => { throw new Error('expected a failure') }, (error: unknown) => error as ScreeningError)

afterEach(() => { vi.unstubAllGlobals() })

describe('screening service client', () => {
  it('posts every image in order and returns the service result', async () => {
    respond(200, result)
    await expect(screenSample(files)).resolves.toEqual(result)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/screen')
    expect((init?.body as FormData).getAll('images').map(file => (file as File).name)).toEqual(['a.png', 'b.png'])
  })

  it('explains rejected files', async () => {
    respond(422, { detail: { message: 'Some images could not be screened.', files: [{ name: 'b.png', error: 'this file is empty.' }] } })
    const error = await failure(screenSample(files))
    expect([error.kind, error.message, error.files]).toEqual(['rejected', 'Some images could not be screened.', [{ name: 'b.png', error: 'this file is empty.' }]])
  })

  it('reports a stopped service, whether the connection fails or the proxy answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect((await failure(screenSample(files))).kind).toBe('unreachable')
    respond(502)
    const error = await failure(screenSample(files))
    expect(error.kind).toBe('unreachable')
    expect(error.message).toContain('npm.cmd run api')
  })

  it('refuses a result that does not cover every image', async () => {
    respond(200, { ...result, fields: result.fields.slice(0, 1) })
    expect((await failure(screenSample(files))).kind).toBe('failed')
  })

  it('lets a cancelled request end quietly', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn(async () => { controller.abort(); throw new DOMException('aborted', 'AbortError') }))
    const error = await failure(screenSample(files, controller.signal))
    expect(error).not.toBeInstanceOf(ScreeningError)
  })
})
