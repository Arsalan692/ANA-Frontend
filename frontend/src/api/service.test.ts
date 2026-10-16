import { afterEach, describe, expect, it, vi } from 'vitest'
import { callService, imagesForm, listModels, ServiceError } from './service'

const respond = (status: number, body?: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(body === undefined ? '' : JSON.stringify(body), { status })))
const failure = (promise: Promise<unknown>) => promise.then(() => { throw new Error('expected a failure') }, (error: unknown) => error as ServiceError)

afterEach(() => { vi.unstubAllGlobals() })

describe('screening service client', () => {
  it('lists every model for both tasks, and reports a stopped service', async () => {
    const models = [
      { id: 'effnet', task: 'screening', label: 'EfficientNet-B0', summary: 'Calibrated.', available: true, default: true, details: [] },
      { id: 'cells', task: 'cells', label: 'ResNet18 ensemble', summary: 'Five models.', available: true, default: true, details: [], classes: ['A', 'B'], minConfidence: 0.7, limits: ['One cell.'] },
    ]
    respond(200, { defaults: { screening: 'effnet', cells: 'cells' }, models })
    await expect(listModels()).resolves.toEqual(models)
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/models')
    respond(502)
    expect((await failure(listModels())).kind).toBe('unreachable')
    respond(200, { unexpected: true })
    expect((await failure(listModels())).kind).toBe('unreachable')
  })

  it('sends the images in order, and the model only when one is chosen', () => {
    const files = [new File(['a'], 'a.png'), new File(['b'], 'b.png')]
    expect(imagesForm(files).getAll('images').map(file => (file as File).name)).toEqual(['a.png', 'b.png'])
    expect(imagesForm(files).has('model')).toBe(false) // No choice: the service uses its default.
    expect(imagesForm(files, 'resnet').get('model')).toBe('resnet')
  })

  it('turns every kind of failure into a clear error', async () => {
    respond(422, { detail: { message: 'Some images could not be read.', files: [{ name: 'b.png', error: 'this file is empty.' }] } })
    const rejected = await failure(callService('/api/screen'))
    expect([rejected.kind, rejected.message, rejected.files]).toEqual(['rejected', 'Some images could not be read.', [{ name: 'b.png', error: 'this file is empty.' }]])
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect((await failure(callService('/api/screen'))).kind).toBe('unreachable')
    respond(502)
    const proxy = await failure(callService('/api/screen'))
    expect([proxy.kind, proxy.message.includes('npm.cmd run api')]).toEqual(['unreachable', true])
    respond(404, { detail: 'Not Found' })
    expect((await failure(callService('/api/screen'))).kind).toBe('failed')
  })

  it('lets a cancelled request end quietly', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn(async () => { controller.abort(); throw new DOMException('aborted', 'AbortError') }))
    expect(await failure(callService('/api/screen', { signal: controller.signal }))).not.toBeInstanceOf(ServiceError)
  })
})
