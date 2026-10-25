// Shared client for the local screening service (backend/). In development and preview, Vite proxies
// /api to http://127.0.0.1:8000. Task-specific calls live in screening.ts and cells.ts.

export type Task = 'screening' | 'cells'
export type Detail = { label: string; value: string }

/** A model the service can run, as listed by GET /api/models. Everything here comes from its recipe. */
export type ModelOption = {
  id: string
  task: Task
  label: string
  summary: string
  /** False when the model's files are not in models/<id>/ on this computer. */
  available: boolean
  default: boolean
  details: Detail[]
  /** Cell models only: the families they can name (none if the model only answers a yes/no question),
   *  the uncertainty cut-off, when an answer is uncertain (completes "Uncertain: …") and the limits to show. */
  classes?: string[]
  minConfidence?: number | null
  uncertainRule?: string
  limits?: string[]
}

/** The model that produced a result: its identity, the exact files (hash) and the facts to show. */
export type ModelInfo = { id: string; task: Task; label: string; checkpoint: string; sha256: string; details: Detail[] }

export type FileProblem = { name: string; error: string }

export class ServiceError extends Error {
  readonly kind: 'unreachable' | 'rejected' | 'failed'
  readonly files: FileProblem[]
  constructor(kind: ServiceError['kind'], message: string, files: FileProblem[] = []) {
    super(message)
    this.kind = kind
    this.files = files
  }
}

const UNREACHABLE = 'The screening service on this computer is not responding. Start it with “npm.cmd run api” in frontend/, then retry.'

/**
 * One request to the service. Returns the JSON body of a successful answer; every failure becomes a
 * ServiceError with a message for the user. A cancelled request rethrows the abort as it is.
 */
export async function callService(path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new ServiceError('unreachable', UNREACHABLE)
  }
  const payload: unknown = await response.json().catch(() => undefined)
  if (response.ok) return payload
  const detail = (payload as { detail?: { message?: string; files?: FileProblem[] } } | undefined)?.detail
  if (detail?.message) throw new ServiceError('rejected', detail.message, detail.files ?? [])
  // Without a service answer, the dev proxy itself replied: the service is not running.
  if (response.status >= 500) throw new ServiceError('unreachable', UNREACHABLE)
  throw new ServiceError('failed', `The screening service returned an error (${response.status}).`)
}

/** The images, in order, plus the chosen model (without one the service uses the task's default). */
export function imagesForm(files: File[], model?: string) {
  const body = new FormData()
  files.forEach(file => body.append('images', file, file.name))
  if (model) body.append('model', model)
  return body
}

/** Every model the service offers, for both tasks, in the service's order. */
export async function listModels(signal?: AbortSignal): Promise<ModelOption[]> {
  const payload = await callService('/api/models', { signal }).catch(error => {
    // The list is only ever asked for, never refused: any failure means the service cannot be used.
    throw error instanceof ServiceError ? new ServiceError('unreachable', UNREACHABLE) : error
  }) as { models?: ModelOption[] } | undefined
  if (!Array.isArray(payload?.models)) throw new ServiceError('unreachable', UNREACHABLE)
  return payload.models
}
