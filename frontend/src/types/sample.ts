/** Binary ANA screening output. Pattern classification is added in a later phase. */
export type ScreeningCall = 'positive' | 'negative'

export type ImageResult = {
  call: ScreeningCall
  /** Model confidence in [0, 1], only when the model reports one. Not clinical certainty. */
  confidence?: number
}

export type SampleImage = {
  id: string
  /** 1-based field number within the sample. */
  field: number
  name: string
  src: string
  width: number
  height: number
  /** Generated illustration rather than real microscopy. */
  synthetic: boolean
  result?: ImageResult
}

/** Sample-level result exactly as supplied by the classifier; the UI never derives it. */
export type SampleResult = {
  call: ScreeningCall
  confidence?: number
  /** Set when fields disagree or the result otherwise needs a closer look. */
  needsReview: boolean
}

export type ReviewState = { status: 'pending' } | { status: 'reviewed'; reviewedAt: string }

export type AnalysisInfo = {
  analysedAt: string
  /** Display label for the classifier. Demo data never names a real model version. */
  modelLabel: string
  simulated: boolean
}

export type Sample = {
  id: string
  /** Non-identifying sample reference, e.g. S-0248. */
  reference: string
  createdAt: string
  images: SampleImage[]
  result?: SampleResult
  analysis?: AnalysisInfo
  review: ReviewState
  /** True for built-in demonstration samples. */
  demo: boolean
  /** Short description of what a demo sample illustrates, e.g. "Fields disagree". */
  demoScenario?: string
}
