import { useMemo } from 'react'
import { useSession } from '../../app/contexts'
import { DEMO_SAMPLES } from '../../demo/samples'
import type { Sample } from '../../types/sample'

// Screens read samples only through these hooks, so demo data can later be replaced by real
// classifier output without changing components. Session samples (analysed in this browser
// session) come first; review state comes from the session store.

function withReview(sample: Sample, reviewedAt: Record<string, string>): Sample {
  const at = reviewedAt[sample.id]
  return at ? { ...sample, review: { status: 'reviewed', reviewedAt: at } } : sample
}

export function useSamples(): Sample[] {
  const { sessionSamples, reviewedAt } = useSession()
  return useMemo(() => [...sessionSamples, ...DEMO_SAMPLES].map(sample => withReview(sample, reviewedAt)), [sessionSamples, reviewedAt])
}

export function useSample(id: string | undefined): Sample | undefined {
  const { sessionSamples, reviewedAt } = useSession()
  return useMemo(() => {
    const sample = [...sessionSamples, ...DEMO_SAMPLES].find(candidate => candidate.id === id)
    return sample && withReview(sample, reviewedAt)
  }, [id, sessionSamples, reviewedAt])
}

export function useCompleteReview() {
  return useSession().completeReview
}
