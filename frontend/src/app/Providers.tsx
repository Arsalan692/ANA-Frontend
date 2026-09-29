import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { DraftContext, MotionContext, SessionContext } from './contexts'
import type { Sample } from '../types/sample'
import type { DraftImage } from '../features/workspace/types'
import { fileKey, validateFile, validateDimensions } from '../features/workspace/filePolicy'

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
        const invalid = validateFile(file, imagesRef.current.map(image => image.key))
        if (invalid) { issues.push(`${file.name}: ${invalid}`); continue }
        let url: string | undefined
        try {
          const bitmap = await createImageBitmap(file)
          const { width, height } = bitmap
          bitmap.close()
          const dimensionError = validateDimensions(width, height)
          if (dimensionError) { issues.push(`${file.name}: ${dimensionError}`); continue }
          if (run !== generation.current) return
          url = URL.createObjectURL(file)
          const image = { id: crypto.randomUUID(), key: fileKey(file), file, url, width, height }
          imagesRef.current = [...imagesRef.current, image]
          setImages(imagesRef.current)
        } catch {
          if (url) URL.revokeObjectURL(url)
          issues.push(`${file.name}: this image could not be opened. Choose a valid JPEG or PNG.`)
        }
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
