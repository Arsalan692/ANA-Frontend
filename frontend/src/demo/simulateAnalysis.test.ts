import { describe, expect, it } from 'vitest'
import { simulateScreening, stainedFraction } from './simulateAnalysis'

const pixels = (...rgb: [number, number, number][]) => new Uint8ClampedArray(rgb.flatMap(([r, g, b]) => [r, g, b, 255]))

describe('screening simulation', () => {
  it('counts only clearly green, bright pixels as stained', () => {
    expect(stainedFraction(pixels([10, 200, 20], [0, 0, 0], [200, 200, 200], [5, 30, 5]))).toBe(0.25)
  })

  it('reports strong positive fields without a review flag and never invents confidence', () => {
    const { fields, sample } = simulateScreening([0.28, 0.26, 0.3, 0.27])
    expect(fields.every(field => field.call === 'positive' && field.confidence === undefined)).toBe(true)
    expect(sample).toEqual({ call: 'positive', needsReview: false })
  })

  it('reports unstained fields as negative', () => {
    expect(simulateScreening([0, 0, 0.001]).sample).toEqual({ call: 'negative', needsReview: false })
  })

  it('flags disagreement and weak staining for review, leaning positive on ties', () => {
    expect(simulateScreening([0.28, 0.27, 0, 0]).sample).toEqual({ call: 'positive', needsReview: true })
    expect(simulateScreening([0.01, 0.02]).sample).toEqual({ call: 'positive', needsReview: true })
    expect(simulateScreening([0.28, 0, 0]).sample).toEqual({ call: 'negative', needsReview: true })
  })
})
