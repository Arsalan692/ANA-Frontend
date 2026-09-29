import type { ImageResult, SampleResult, ScreeningCall } from '../types/sample'

// SIMULATION ONLY. This stands in for the screening classifier until a model is connected.
// It measures how much of an image is bright green (fluorescent) and applies fixed thresholds.
// It is not a trained model; every result it produces is labelled "Simulated" in the UI.

export const SIMULATOR_LABEL = 'Brightness simulation (not a model)'

/** Fraction of stained pixels at or above which a field is simulated as positive. */
const POSITIVE_FROM = 0.004
/** Below this staining fraction a positive field is treated as weak and flagged for review. */
const STRONG_FROM = 0.05

/** Fraction of pixels that are clearly green and reasonably bright. */
export function stainedFraction(pixels: Uint8ClampedArray): number {
  let stained = 0
  const count = pixels.length / 4
  for (let index = 0; index < pixels.length; index += 4) {
    const [red, green, blue] = [pixels[index], pixels[index + 1], pixels[index + 2]]
    if (green > 40 && green > 1.5 * Math.max(red, blue, 1)) stained += 1
  }
  return count ? stained / count : 0
}

export async function measureStaining(source: Blob): Promise<number> {
  const bitmap = await createImageBitmap(source, { resizeWidth: 192, resizeQuality: 'medium' })
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    context.drawImage(bitmap, 0, 0)
    return stainedFraction(context.getImageData(0, 0, bitmap.width, bitmap.height).data)
  } finally {
    bitmap.close()
  }
}

export function simulateScreening(stainings: number[]): { fields: ImageResult[]; sample: SampleResult } {
  const calls: ScreeningCall[] = stainings.map(value => value >= POSITIVE_FROM ? 'positive' : 'negative')
  const positives = calls.filter(call => call === 'positive').length
  // Ties lean positive: in screening, a missed positive is the costlier error.
  const call: ScreeningCall = positives * 2 >= calls.length && positives > 0 ? 'positive' : 'negative'
  const disagree = positives > 0 && positives < calls.length
  const weak = stainings.some(value => value >= POSITIVE_FROM && value < STRONG_FROM)
  return { fields: calls.map(fieldCall => ({ call: fieldCall })), sample: { call, needsReview: disagree || weak } }
}
