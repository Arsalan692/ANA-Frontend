import { createContext, useContext } from 'react'
import type { DraftImage } from '../features/workspace/types'

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
  dismissErrors: () => void
}
export const DraftContext = createContext<DraftContextValue | null>(null)
export function useDraft() {
  const value = useContext(DraftContext)
  if (!value) throw new Error('Draft provider is missing')
  return value
}
