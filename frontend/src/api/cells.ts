import { callService, imagesForm, ServiceError } from './service'
import type { Detail, ModelInfo } from './service'

// Cell patterns: each image is ONE cropped cell and gets its own answer; cells are never combined.
// The families, the uncertainty cut-off and the limits come from the chosen model (GET /api/models).

/** A yes/no question a model answers about the cell, e.g. "Homogeneous (AC-1)?", at the model's own cut-offs. */
export type CellQuestion = {
  label: string
  /** The answer's wording either way, e.g. "Homogeneous" / "Not homogeneous". */
  yes: string
  no: string
  /** Calibrated probability of "yes". */
  probability: number
  cutoff: number
  answer: boolean
  /** A stricter cut-off with fewer false alarms, when the model has one. */
  strictCutoff: number | null
  strictAnswer: boolean | null
}

export type CellResult = {
  name: string
  width: number
  height: number
  /** The image is much larger than a single cell, so it is probably not one cropped cell. */
  oversized: boolean
  /** The named pattern; null for a model that only answers `question`. */
  family: string | null
  /** Probability of `family`, 0 to 1. Not clinical certainty. */
  confidence: number | null
  uncertain: boolean
  probabilities: Record<string, number>
  /** PNG data URL of the image exactly as the model is given it, when the model provides one (display only). */
  modelView: string | null
  modelsUsed?: number
  question?: CellQuestion | null
  /** Things to know about this cell's answer (e.g. an experimental conversion), shown on its card. */
  warnings?: { title: string; text: string }[]
  /** Small facts about this cell, e.g. how the image was prepared. */
  facts?: Detail[]
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
