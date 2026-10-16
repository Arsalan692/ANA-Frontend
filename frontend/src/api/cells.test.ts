import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyCells } from './cells'
import type { ServiceError } from './service'

const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })]
const cell = (name: string) => ({ name, width: 73, height: 65, oversized: false, family: 'Speckled', confidence: 0.9, uncertain: false,
  probabilities: { Homogeneous: 0.06, Speckled: 0.9, Nucleolar: 0.04 }, modelsUsed: 5, modelView: 'data:image/png;base64,AA==' })
const model = { id: 'cells', task: 'cells', label: 'ResNet18 ensemble', checkpoint: '5 weights files', sha256: 'abc', details: [] }
const respond = (status: number, body?: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(body === undefined ? '' : JSON.stringify(body), { status })))
const failure = (promise: Promise<unknown>) => promise.then(() => { throw new Error('expected a failure') }, (error: unknown) => error as ServiceError)

afterEach(() => { vi.unstubAllGlobals() })

describe('cell pattern client', () => {
  it('posts every cell image in order to /api/cells with the chosen model, and returns one result per cell', async () => {
    const result = { model, analysedAt: '2026-10-09T10:00:00Z', cells: [cell('a.png'), cell('b.png')] }
    respond(200, result)
    await expect(classifyCells(files, { model: 'cells' })).resolves.toEqual(result)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/cells')
    expect((init?.body as FormData).getAll('images').map(file => (file as File).name)).toEqual(['a.png', 'b.png'])
    expect((init?.body as FormData).get('model')).toBe('cells')
  })

  it('refuses a result that does not cover every cell, and passes on the service\'s reasons', async () => {
    respond(200, { model, cells: [cell('a.png')] })
    expect((await failure(classifyCells(files))).kind).toBe('failed')
    respond(422, { detail: { message: 'Some images could not be read.', files: [{ name: 'b.png', error: 'this file is empty.' }] } })
    const error = await failure(classifyCells(files))
    expect([error.kind, error.files]).toEqual(['rejected', [{ name: 'b.png', error: 'this file is empty.' }]])
  })
})
