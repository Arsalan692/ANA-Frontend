import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDraft, useSession } from '../../app/contexts'
import { measureStaining, simulateScreening, SIMULATOR_LABEL } from '../../demo/simulateAnalysis'
import type { Sample } from '../../types/sample'

export type AnalysisStage = 'preparing' | 'screening' | 'finalising'
export type AnalysisState =
  | { status: 'idle' }
  | { status: 'running'; stage: AnalysisStage; field: number; total: number }
  | { status: 'failed'; message: string }

class SimulatedFailure extends Error {}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const FIRST_REFERENCE = 301

/**
 * Runs the simulated screening job for the current draft. Each run gets a token; cancelling,
 * unmounting or starting again invalidates older runs so they can never attach a stale result.
 * The draft images are only handed to the new sample once the run succeeds, so a failure keeps them.
 */
export function useSimulatedAnalysis() {
  const { images, takeDraft } = useDraft()
  const { sessionSamples, addSample } = useSession()
  const navigate = useNavigate()
  const [state, setState] = useState<AnalysisState>({ status: 'idle' })
  const run = useRef(0)
  const running = useRef(false)
  useEffect(() => () => { run.current += 1 }, [])

  const start = async ({ simulateFailure = false } = {}) => {
    if (running.current || !images.length) return
    running.current = true
    const token = ++run.current
    const alive = () => token === run.current
    const snapshot = images
    const total = snapshot.length
    try {
      setState({ status: 'running', stage: 'preparing', field: 0, total })
      await wait(700)
      const stainings: number[] = []
      for (const [index, image] of snapshot.entries()) {
        if (!alive()) return
        setState({ status: 'running', stage: 'screening', field: index + 1, total })
        const [staining] = await Promise.all([measureStaining(image.file), wait(550)])
        if (simulateFailure && index === Math.min(1, total - 1)) throw new SimulatedFailure()
        stainings.push(staining)
      }
      if (!alive()) return
      setState({ status: 'running', stage: 'finalising', field: total, total })
      await wait(500)
      if (!alive()) return
      const { fields, sample: result } = simulateScreening(stainings)
      const taken = takeDraft()
      const number = FIRST_REFERENCE + sessionSamples.length
      const id = `s-${String(number).padStart(4, '0')}`
      const sample: Sample = {
        id,
        reference: id.toUpperCase(),
        createdAt: new Date().toISOString(),
        images: taken.map((image, index) => ({ id: image.id, field: index + 1, name: image.file.name, src: image.url, width: image.width, height: image.height, synthetic: false, result: fields[index] })),
        result,
        analysis: { analysedAt: new Date().toISOString(), modelLabel: SIMULATOR_LABEL, simulated: true },
        review: { status: 'pending' },
        demo: false,
      }
      addSample(sample)
      setState({ status: 'idle' })
      navigate(`/samples/${id}`)
    } catch (error) {
      if (!alive()) return
      setState({ status: 'failed', message: error instanceof SimulatedFailure
        ? `The simulated analysis stopped at field ${Math.min(2, total)} of ${total}. This failure was requested for the demo.`
        : 'One of the images could not be read for analysis.' })
    } finally {
      if (alive()) running.current = false
    }
  }

  const cancel = () => {
    run.current += 1
    running.current = false
    setState({ status: 'idle' })
  }

  return { state, start, cancel }
}
