import type { ImageResult, Sample, SampleImage } from '../types/sample'

// Demonstration samples for the positive/negative screening UI. Every value here is illustrative:
// the images are generated artwork and the results are hand-written, not model output.

const DEMO_MODEL = 'Demo screening classifier'

function field(sampleId: string, index: number, file: string, result: ImageResult): SampleImage {
  return {
    id: `${sampleId}-f${index}`,
    field: index,
    name: `${file}.webp`,
    src: `/assets/${file}.webp`,
    width: 1536,
    height: 1024,
    synthetic: true,
    result,
  }
}

export const DEMO_SAMPLES: Sample[] = [
  {
    id: 's-0248',
    demoScenario: 'All fields positive',
    reference: 'S-0248',
    createdAt: '2026-09-28T09:12:00Z',
    images: [
      field('s-0248', 1, 'field-positive-01', { call: 'positive', confidence: 0.951 }),
      field('s-0248', 2, 'field-positive-02', { call: 'positive', confidence: 0.938 }),
      field('s-0248', 3, 'field-positive-03', { call: 'positive', confidence: 0.94 }),
      field('s-0248', 4, 'field-positive-04', { call: 'positive', confidence: 0.941 }),
    ],
    result: { call: 'positive', confidence: 0.942, needsReview: false },
    analysis: { analysedAt: '2026-09-28T09:14:00Z', modelLabel: DEMO_MODEL, simulated: true },
    review: { status: 'pending' },
    demo: true,
  },
  {
    id: 's-0251',
    demoScenario: 'All fields negative',
    reference: 'S-0251',
    createdAt: '2026-09-28T10:03:00Z',
    images: [
      field('s-0251', 1, 'field-negative-01', { call: 'negative', confidence: 0.97 }),
      field('s-0251', 2, 'field-negative-02', { call: 'negative', confidence: 0.962 }),
      field('s-0251', 3, 'field-negative-03', { call: 'negative', confidence: 0.955 }),
      field('s-0251', 4, 'field-negative-04', { call: 'negative', confidence: 0.968 }),
    ],
    result: { call: 'negative', confidence: 0.964, needsReview: false },
    analysis: { analysedAt: '2026-09-28T10:05:00Z', modelLabel: DEMO_MODEL, simulated: true },
    review: { status: 'pending' },
    demo: true,
  },
  {
    id: 's-0263',
    demoScenario: 'Fields disagree',
    reference: 'S-0263',
    createdAt: '2026-09-28T11:40:00Z',
    images: [
      field('s-0263', 1, 'field-weak-01', { call: 'positive', confidence: 0.71 }),
      field('s-0263', 2, 'field-weak-02', { call: 'positive', confidence: 0.64 }),
      field('s-0263', 3, 'field-negative-01', { call: 'negative', confidence: 0.83 }),
      field('s-0263', 4, 'field-negative-02', { call: 'negative', confidence: 0.77 }),
    ],
    result: { call: 'positive', confidence: 0.58, needsReview: true },
    analysis: { analysedAt: '2026-09-28T11:42:00Z', modelLabel: DEMO_MODEL, simulated: true },
    review: { status: 'pending' },
    demo: true,
  },
  {
    id: 's-0270',
    demoScenario: 'No confidence reported',
    reference: 'S-0270',
    createdAt: '2026-09-28T13:25:00Z',
    images: [
      field('s-0270', 1, 'field-positive-02', { call: 'positive' }),
      field('s-0270', 2, 'field-positive-03', { call: 'positive' }),
      field('s-0270', 3, 'field-positive-04', { call: 'positive' }),
    ],
    result: { call: 'positive', needsReview: false },
    analysis: { analysedAt: '2026-09-28T13:27:00Z', modelLabel: DEMO_MODEL, simulated: true },
    review: { status: 'pending' },
    demo: true,
  },
]
