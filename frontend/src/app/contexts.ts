import { createContext, useContext } from 'react'
import type { DraftImage } from '../features/workspace/types'
import type { Sample } from '../types/sample'
import type { FileProblem, ModelOption, Task } from '../api/service'
import type { CellResult } from '../api/cells'

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

/** Every model the service offers, and the one chosen per task for the next analysis (session only). */
export type ModelsContextValue = {
  status: 'loading' | 'ready' | 'unavailable'
  models: ModelOption[]
  chosen: Partial<Record<Task, string>>
  choose: (task: Task, id: string) => void
  reload: () => void
}
export const ModelsContext = createContext<ModelsContextValue | null>(null)

/** The models for one task, and the chosen one (or the service's default for that task). */
export function useModels(task: Task) {
  const value = useContext(ModelsContext)
  if (!value) throw new Error('Models provider is missing')
  const models = value.models.filter(model => model.task === task)
  const usable = models.filter(model => model.available)
  const selected = usable.find(model => model.id === value.chosen[task]) ?? usable.find(model => model.default) ?? usable[0]
  return { status: value.status, models, selected, select: (id: string) => value.choose(task, id), reload: value.reload }
}

/** One uploaded image of a single cropped cell, with its pattern result once classified. */
export type CellItem = {
  id: string; key: string; file: File; url: string; width: number; height: number
  result?: CellResult
  /** The model that classified this cell and its uncertainty cut-off (cells may be classified by different models). */
  model?: { label: string; minConfidence?: number }
}

/** Session-only state of the Cell patterns page, kept above the router so it survives navigation. */
export type CellsContextValue = {
  cells: CellItem[]
  errors: string[]
  /** Checking newly added files. */
  busy: boolean
  classifying: boolean
  /** Why the last classification did not finish; the cell images are kept. */
  failure: { message: string; files: FileProblem[] } | undefined
  addFiles: (files: File[]) => Promise<void>
  removeCell: (id: string) => void
  clearCells: () => void
  /** Sends every cell that has no result yet to the given model (or the service's default). */
  classify: (model?: ModelOption) => Promise<void>
  dismissErrors: () => void
}
export const CellsContext = createContext<CellsContextValue | null>(null)
export function useCells() {
  const value = useContext(CellsContext)
  if (!value) throw new Error('Cells provider is missing')
  return value
}
