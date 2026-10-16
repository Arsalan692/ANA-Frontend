import { callService, imagesForm, ServiceError } from './service'
import type { ModelInfo } from './service'

// Cell patterns: each image is ONE cropped cell and gets its own answer; cells are never combined.
// The families, the uncertainty cut-off and the limits come from the chosen model (GET /api/models).

export type CellResult = {
  name: string
  width: number
  height: number
  /** The image is much larger than a single cell, so it is probably not one cropped cell. */
  oversized: boolean
  family: string
  /** Probability of `family`, 0 to 1. Not clinical certainty. */
  confidence: number
  uncertain: boolean
  probabilities: Record<string, number>
  /** PNG data URL of the image exactly as the model is given it, when the model provides one (display only). */
  modelView: string | null
  modelsUsed?: number
}

export type CellsResponse = {
  model: ModelInfo
  analysedAt: string
  /** One entry per uploaded image, in upload order. */
  cells: CellResult[]
}

/** Classifies each cell on its own. Without `model`, the service uses its default cell model. */
export async function classifyCells(files: File[], { model, signal }: { model?: string; signal?: AbortSignal } = {}): Promise<CellsResponse> {
  const result = await callService('/api/cells', { method: 'POST', body: imagesForm(files, model), signal }) as CellsResponse | undefined
  if (result?.cells?.length !== files.length) throw new ServiceError('failed', 'The screening service returned an incomplete result.')
  return result
}
