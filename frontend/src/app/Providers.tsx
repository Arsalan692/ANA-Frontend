import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { CellsContext, DraftContext, ModelsContext, MotionContext, SessionContext } from './contexts'
import type { CellItem, CellsContextValue, ModelsContextValue } from './contexts'
import { classifyCells } from '../api/cells'
import { listModels, ServiceError } from '../api/service'
import type { ModelOption, Task } from '../api/service'
import type { Sample } from '../types/sample'
import type { DraftImage } from '../features/workspace/types'
import { fileKey, inspectImage } from '../lib/images'

const reducedQuery = '(prefers-reduced-motion: reduce)'
const getSystemReduced = () => window.matchMedia(reducedQuery).matches
function subscribeSystemReduced(onChange: () => void) {
  const media = window.matchMedia(reducedQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const systemReduced = useSyncExternalStore(subscribeSystemReduced, getSystemReduced)
  const [manuallyReduced, setManuallyReduced] = useState(() => {
    try { return localStorage.getItem('ana-reduced-motion') === 'true' } catch { return false }
  })
  const reduced = systemReduced || manuallyReduced
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
  }, [reduced])
  const toggleReduced = () => setManuallyReduced(previous => {
    const next = !previous
    try { localStorage.setItem('ana-reduced-motion', String(next)) } catch { /* Optional preference storage. */ }
    return next
  })
  useEffect(() => {
    const updateVisibility = () => { document.documentElement.dataset.visibility = document.hidden ? 'hidden' : 'visible' }
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])
  return <MotionContext.Provider value={{ reduced, manuallyReduced, systemReduced, toggleReduced }}>
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
  </MotionContext.Provider>
}

export function DraftProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<DraftImage[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const imagesRef = useRef<DraftImage[]>([])
  const generation = useRef(0)
  const locked = useRef(false)
  useEffect(() => () => {
    generation.current += 1
    imagesRef.current.forEach(image => URL.revokeObjectURL(image.url))
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length || locked.current) return
    locked.current = true
    setBusy(true)
    const run = generation.current
    const issues: string[] = []
    try {
      for (const file of files) {
        if (run !== generation.current) return
        const checked = await inspectImage(file, imagesRef.current.map(image => image.key))
        if (run !== generation.current) return // Cleared while decoding: drop the result.
        if (typeof checked === 'string') { issues.push(`${file.name}: ${checked}`); continue }
        imagesRef.current = [...imagesRef.current, { id: crypto.randomUUID(), key: fileKey(file), file, url: URL.createObjectURL(file), ...checked }]
        setImages(imagesRef.current)
      }
      if (run === generation.current) setErrors(issues)
    } finally {
      if (run === generation.current) { locked.current = false; setBusy(false) }
    }
  }, [])

  const removeImage = (id: string) => {
    const removed = imagesRef.current.find(image => image.id === id)
    if (removed) URL.revokeObjectURL(removed.url)
    imagesRef.current = imagesRef.current.filter(image => image.id !== id)
    setImages(imagesRef.current)
  }
  const clearDraft = () => {
    generation.current += 1
    imagesRef.current.forEach(image => URL.revokeObjectURL(image.url))
    imagesRef.current = []
    setImages([])
    setErrors([])
    locked.current = false
    setBusy(false)
  }
  const takeDraft = () => {
    const taken = imagesRef.current
    generation.current += 1
    imagesRef.current = []
    setImages([])
    setErrors([])
    locked.current = false
    setBusy(false)
    return taken
  }
  return <DraftContext.Provider value={{ images, errors, busy, addFiles, removeImage, clearDraft, takeDraft, dismissErrors: () => setErrors([]) }}>
    {children}
  </DraftContext.Provider>
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionSamples, setSessionSamples] = useState<Sample[]>([])
  const [reviewedAt, setReviewedAt] = useState<Record<string, string>>({})
  const samplesRef = useRef<Sample[]>([])
  useEffect(() => () => {
    samplesRef.current.forEach(sample => sample.images.forEach(image => { if (image.src.startsWith('blob:')) URL.revokeObjectURL(image.src) }))
  }, [])
  const addSample = useCallback((sample: Sample) => {
    samplesRef.current = [sample, ...samplesRef.current]
    setSessionSamples(samplesRef.current)
  }, [])
  const completeReview = useCallback((sampleId: string) => {
    setReviewedAt(previous => previous[sampleId] ? previous : { ...previous, [sampleId]: new Date().toISOString() })
  }, [])
  return <SessionContext.Provider value={{ sessionSamples, addSample, reviewedAt, completeReview }}>{children}</SessionContext.Provider>
}

/** Asks the service once which models exist (for both tasks); the choice per task is kept for the session. */
export function ModelsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: ModelsContextValue['status']; models: ModelOption[] }>({ status: 'loading', models: [] })
  const [chosen, setChosen] = useState<Partial<Record<Task, string>>>({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    listModels(controller.signal)
      .then(models => setState({ status: 'ready', models }))
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'unavailable', models: [] }) })
    return () => controller.abort()
  }, [attempt])
  const reload = useCallback(() => setAttempt(previous => previous + 1), [])
  // If the service was not running, look again when the user comes back to the page after starting it.
  useEffect(() => {
    if (state.status !== 'unavailable') return
    window.addEventListener('focus', reload)
    return () => window.removeEventListener('focus', reload)
  }, [state.status, reload])
  const choose = useCallback((task: Task, id: string) => setChosen(previous => ({ ...previous, [task]: id })), [])
  return <ModelsContext.Provider value={{ ...state, chosen, choose, reload }}>{children}</ModelsContext.Provider>
}

export function CellsProvider({ children }: { children: ReactNode }) {
  const [cells, setCells] = useState<CellItem[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [failure, setFailure] = useState<CellsContextValue['failure']>()
  const cellsRef = useRef<CellItem[]>([])
  const adding = useRef(false)
  const run = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const commit = (next: CellItem[]) => { cellsRef.current = next; setCells(next) }
  useEffect(() => () => {
    run.current += 1
    controller.current?.abort()
    cellsRef.current.forEach(cell => URL.revokeObjectURL(cell.url))
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length || adding.current) return
    adding.current = true
    setBusy(true)
    const issues: string[] = []
    try {
      for (const file of files) {
        const checked = await inspectImage(file, cellsRef.current.map(cell => cell.key), 'cells')
        if (typeof checked === 'string') { issues.push(`${file.name}: ${checked}`); continue }
        commit([...cellsRef.current, { id: crypto.randomUUID(), key: fileKey(file), file, url: URL.createObjectURL(file), ...checked }])
      }
      setErrors(issues)
    } finally {
      adding.current = false
      setBusy(false)
    }
  }, [])

  const removeCell = (id: string) => {
    const removed = cellsRef.current.find(cell => cell.id === id)
    if (removed) URL.revokeObjectURL(removed.url)
    commit(cellsRef.current.filter(cell => cell.id !== id))
  }
  const clearCells = () => {
    run.current += 1
    controller.current?.abort()
    cellsRef.current.forEach(cell => URL.revokeObjectURL(cell.url))
    commit([])
    setErrors([])
    setFailure(undefined)
    setClassifying(false)
  }
  const classify = async (model?: ModelOption) => {
    const pending = cellsRef.current.filter(cell => !cell.result)
    if (!pending.length || classifying) return
    const token = ++run.current
    const abort = new AbortController()
    controller.current = abort
    setClassifying(true)
    setFailure(undefined)
    try {
      const response = await classifyCells(pending.map(cell => cell.file), { model: model?.id, signal: abort.signal })
      if (token !== run.current) return
      // Results come back in upload order; a cell removed meanwhile is simply no longer in the list.
      const results = new Map(pending.map((cell, index) => [cell.id, response.cells[index]]))
      commit(cellsRef.current.map(cell => results.has(cell.id) ? { ...cell, result: results.get(cell.id), model: { label: response.model.label, uncertainRule: model?.uncertainRule } } : cell))
    } catch (error) {
      if (token !== run.current) return
      setFailure(error instanceof ServiceError ? { message: error.message, files: error.files } : { message: 'The cells could not be classified.', files: [] })
    } finally {
      if (token === run.current) setClassifying(false)
    }
  }
  return <CellsContext.Provider value={{ cells, errors, busy, classifying, failure, addFiles, removeCell, clearCells, classify, dismissErrors: () => setErrors([]) }}>
    {children}
  </CellsContext.Provider>
}
