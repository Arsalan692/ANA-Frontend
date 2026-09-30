import type { ScreeningCall } from '../types/sample'

// Client for the local screening service in backend/ (FastAPI + the ResNet18 checkpoint).
// In development and preview, Vite proxies /api to http://127.0.0.1:8000.

export type ScreeningResponse = {
  model: { label: string; checkpoint: string; sha256: string; epoch: number; resolution: number; trainingData: string }
  analysedAt: string
  /** One entry per uploaded image, in upload order. `confidence` is the probability of `call`. */
  fields: { name: string; call: ScreeningCall; confidence: number; probabilityPositive: number }[]
  /** Sample-level result from the service's aggregation rule; the UI never derives it. */
  sample: { call: ScreeningCall; needsReview: boolean; positiveFields: number; totalFields: number; rule: string }
}

export type FileProblem = { name: string; error: string }

export class ScreeningError extends Error {
  readonly kind: 'unreachable' | 'rejected' | 'failed'
  readonly files: FileProblem[]
  constructor(kind: ScreeningError['kind'], message: string, files: FileProblem[] = []) {
    super(message)
    this.kind = kind
    this.files = files
  }
}

const UNREACHABLE = 'The screening service on this computer is not responding. Start it with “npm.cmd run api” in frontend/, then retry.'

export async function screenSample(files: File[], signal?: AbortSignal): Promise<ScreeningResponse> {
  const body = new FormData()
  files.forEach(file => body.append('images', file, file.name))
  let response: Response
  try {
    response = await fetch('/api/screen', { method: 'POST', body, signal })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ScreeningError('unreachable', UNREACHABLE)
  }
  const payload: unknown = await response.json().catch(() => undefined)
  if (response.ok) {
    const result = payload as ScreeningResponse | undefined
    if (result?.fields?.length !== files.length || !result.sample) throw new ScreeningError('failed', 'The screening service returned an incomplete result.')
    return result
  }
  const detail = (payload as { detail?: { message?: string; files?: FileProblem[] } } | undefined)?.detail
  if (detail?.message) throw new ScreeningError('rejected', detail.message, detail.files ?? [])
  // Without a service answer, the dev proxy itself replied: the service is not running.
  if (response.status >= 500) throw new ScreeningError('unreachable', UNREACHABLE)
  throw new ScreeningError('failed', `The screening service returned an error (${response.status}).`)
}
