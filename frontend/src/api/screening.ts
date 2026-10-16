import type { ScreeningCall } from '../types/sample'
import { callService, imagesForm, ServiceError } from './service'
import type { ModelInfo } from './service'

// Sample screening: a sample's fields -> one positive/negative call per field plus one for the sample.

export type ScreeningResponse = {
  model: ModelInfo
  analysedAt: string
  /** One entry per uploaded image, in upload order. `confidence` is the probability of `call`. */
  fields: { name: string; call: ScreeningCall; confidence: number; probabilityPositive: number }[]
  /** Sample-level result from the service's aggregation rule; the UI never derives it. */
  sample: { call: ScreeningCall; needsReview: boolean; positiveFields: number; totalFields: number; rule: string }
}

/** Screens one sample. Without `model`, the service uses its default screening model. */
export async function screenSample(files: File[], { model, signal }: { model?: string; signal?: AbortSignal } = {}): Promise<ScreeningResponse> {
  const result = await callService('/api/screen', { method: 'POST', body: imagesForm(files, model), signal }) as ScreeningResponse | undefined
  if (result?.fields?.length !== files.length || !result.sample) throw new ServiceError('failed', 'The screening service returned an incomplete result.')
  return result
}
