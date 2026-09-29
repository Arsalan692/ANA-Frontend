import { createContext, useContext } from 'react'
import type { DraftImage } from '../features/workspace/types'
import type { Sample } from '../types/sample'

export type MotionPreference = {
  reduced: boolean
  manuallyReduced: boolean
  systemReduced: boolean
  toggleReduced: () => void
}
export const MotionContext = createContext<MotionPreference | null>(null)
export function useMotionPreference() {
  const value = useContext(MotionContext)
  if (!value) throw new Error('Motion provider is missing')
  return value
}

export type DraftContextValue = {
  images: DraftImage[]
  errors: string[]
  busy: boolean
  addFiles: (files: File[]) => Promise<void>
  removeImage: (id: string) => void
  clearDraft: () => void
  /** Hands the draft images to a new owner and empties the draft without revoking their URLs. */
  takeDraft: () => DraftImage[]
  dismissErrors: () => void
}
export const DraftContext = createContext<DraftContextValue | null>(null)
export function useDraft() {
  const value = useContext(DraftContext)
  if (!value) throw new Error('Draft provider is missing')
  return value
}

/** Session-only store: samples analysed in this session plus review completions (ISO timestamps). */
export type SessionContextValue = {
  sessionSamples: Sample[]
  addSample: (sample: Sample) => void
  reviewedAt: Record<string, string>
  completeReview: (sampleId: string) => void
}
export const SessionContext = createContext<SessionContextValue | null>(null)
export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('Session provider is missing')
  return value
}
