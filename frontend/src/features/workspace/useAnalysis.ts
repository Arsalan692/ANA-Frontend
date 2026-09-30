import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDraft, useSession } from '../../app/contexts'
import { screenSample, ScreeningError } from '../../api/screening'
import type { FileProblem } from '../../api/screening'
import type { Sample } from '../../types/sample'

export type AnalysisStage = 'preparing' | 'screening' | 'finalising'
export type AnalysisState =
  | { status: 'idle' }
  | { status: 'running'; stage: AnalysisStage; total: number }
  | { status: 'failed'; message: string; files: FileProblem[] }

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const FIRST_REFERENCE = 301
/** Short pauses so each stage can be read; the model itself answers in well under a second. */
const STAGE_PAUSE = 350

/**
 * Sends the current draft to the screening service. Each run gets a token and an AbortController;
 * cancelling, unmounting or starting again invalidates older runs so they can never attach a stale
 * result. The draft images are only handed to the new sample once the run succeeds, so a failure keeps them.
 */
export function useAnalysis() {
  const { images, takeDraft } = useDraft()
  const { sessionSamples, addSample } = useSession()
  const navigate = useNavigate()
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })
  const run = useRef(0)
  const running = useRef(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { run.current += 1; controller.current?.abort() }, [])

  const start = async () => {
    if (running.current || !images.length) return
    running.current = true
    const token = ++run.current
    const alive = () => token === run.current
    const abort = new AbortController()
    controller.current = abort
    const snapshot = images
    const total = snapshot.length
    try {
      setState({ status: 'running', stage: 'preparing', total })
      await wait(STAGE_PAUSE)
      if (!alive()) return
      setState({ status: 'running', stage: 'screening', total })
      const [response] = await Promise.all([screenSample(snapshot.map(image => image.file), abort.signal), wait(STAGE_PAUSE)])
      if (!alive()) return
      setState({ status: 'running', stage: 'finalising', total })
      await wait(STAGE_PAUSE)
      if (!alive()) return
      const taken = takeDraft()
      const number = FIRST_REFERENCE + sessionSamples.length
      const id = `s-${String(number).padStart(4, '0')}`
      const { model, sample: result } = response
      const sample: Sample = {
        id,
        reference: id.toUpperCase(),
        createdAt: new Date().toISOString(),
        images: taken.map((image, index) => ({ id: image.id, field: index + 1, name: image.file.name, src: image.url, width: image.width, height: image.height, synthetic: false,
          result: { call: response.fields[index].call, confidence: response.fields[index].confidence } })),
        // The model scores single images, so there is no sample-level confidence to show.
        result: { call: result.call, needsReview: result.needsReview },
        analysis: { analysedAt: response.analysedAt, modelLabel: model.label, simulated: false, details: [
          { label: 'Checkpoint', value: `${model.checkpoint} · epoch ${model.epoch} · ${model.sha256}` },
          { label: 'Training data', value: model.trainingData },
          { label: 'Input', value: `Each field padded to ${model.resolution} × ${model.resolution} px, as in training` },
          { label: 'Sample rule', value: result.rule },
        ] },
        review: { status: 'pending' },
        demo: false,
      }
      addSample(sample)
      setState({ status: 'idle' })
      navigate(`/samples/${id}`)
    } catch (error) {
      if (!alive()) return
      setState(error instanceof ScreeningError
        ? { status: 'failed', message: error.message, files: error.files }
        : { status: 'failed', message: 'The analysis could not be completed.', files: [] })
    } finally {
      if (alive()) running.current = false
    }
  }

  const cancel = () => {
    run.current += 1
    controller.current?.abort()
    running.current = false
    setState({ status: 'idle' })
  }

  return { state, start, cancel }
}
