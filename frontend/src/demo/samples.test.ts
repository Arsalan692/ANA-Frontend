import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEMO_SAMPLES } from './samples'

const inUnitRange = (value: number | undefined) => value === undefined || (value >= 0 && value <= 1)

describe('demo samples', () => {
  it('have unique ids and references', () => {
    expect(new Set(DEMO_SAMPLES.map(sample => sample.id)).size).toBe(DEMO_SAMPLES.length)
    expect(new Set(DEMO_SAMPLES.map(sample => sample.reference)).size).toBe(DEMO_SAMPLES.length)
  })

  it('are clearly demo data with synthetic images and simulated analysis', () => {
    for (const sample of DEMO_SAMPLES) {
      expect(sample.demo).toBe(true)
      expect(sample.analysis?.simulated).toBe(true)
      expect(sample.images.every(image => image.synthetic)).toBe(true)
    }
  })

  it('number fields in order and point at bundled assets', () => {
    for (const sample of DEMO_SAMPLES) {
      expect(sample.images.map(image => image.field)).toEqual(sample.images.map((_, index) => index + 1))
      for (const image of sample.images) expect(existsSync(path.join('public', image.src)), image.src).toBe(true)
    }
  })

  it('keep confidences within 0–1', () => {
    for (const sample of DEMO_SAMPLES) {
      expect(inUnitRange(sample.result?.confidence)).toBe(true)
      expect(sample.images.every(image => inUnitRange(image.result?.confidence))).toBe(true)
    }
  })

  it('cover positive, negative, disagreement and missing-confidence states', () => {
    const results = DEMO_SAMPLES.map(sample => sample.result!)
    expect(results.some(result => result.call === 'positive' && !result.needsReview)).toBe(true)
    expect(results.some(result => result.call === 'negative')).toBe(true)
    expect(DEMO_SAMPLES.some(sample => sample.result?.needsReview && new Set(sample.images.map(image => image.result?.call)).size > 1)).toBe(true)
    expect(results.some(result => result.confidence === undefined)).toBe(true)
  })
})
