import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRight, Check, CircleAlert, LoaderCircle, RotateCcw } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import type { AnalysisStage, AnalysisState } from './useSimulatedAnalysis'

const STAGES: { key: AnalysisStage; label: string }[] = [
  { key: 'preparing', label: 'Preparing the images' },
  { key: 'screening', label: 'Screening each field' },
  { key: 'finalising', label: 'Bringing the fields together' },
]

function StageList({ state }: { state: Extract<AnalysisState, { status: 'running' }> }) {
  const current = STAGES.findIndex(stage => stage.key === state.stage)
  return <ol className="analysis-stages">{STAGES.map((stage, index) => {
    const status = index < current ? 'done' : index === current ? 'current' : 'pending'
    return <li key={stage.key} className={`analysis-stage ${status}`}>
      <span className="analysis-stage-marker" aria-hidden="true">{status === 'done' ? <Check size={14} /> : status === 'current' ? <LoaderCircle size={14} className="spin" /> : index + 1}</span>
      <span>{stage.label}{stage.key === 'screening' && status === 'current' && <small>Field {state.field} of {state.total}</small>}</span>
      <span className="sr-only">{status === 'done' ? 'complete' : status === 'current' ? 'in progress' : 'waiting'}</span>
    </li>
  })}</ol>
}

export function AnalysisDialog({ state, onCancel, onRetry }: { state: AnalysisState; onCancel: () => void; onRetry: () => void }) {
  const open = state.status !== 'idle'
  return <Dialog.Root open={open} onOpenChange={next => { if (!next) onCancel() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content analysis-dialog" onInteractOutside={event => event.preventDefault()}>
        <img className="analysis-art" src="/assets/analysis-field.webp" alt="" />
        <Badge dot>Simulated analysis</Badge>
        {state.status === 'running' && <>
          <Dialog.Title className="dialog-title">Screening the sample.</Dialog.Title>
          <Dialog.Description className="dialog-description">Results in this build are simulated from image brightness. They are not a model prediction.</Dialog.Description>
          <StageList state={state} />
          <p className="sr-only" role="status" aria-live="polite">{state.stage === 'screening' ? `Screening field ${state.field} of ${state.total}` : STAGES.find(stage => stage.key === state.stage)?.label}</p>
          <div className="confirm-actions"><button className="button button-secondary" onClick={onCancel}>Cancel</button></div>
        </>}
        {state.status === 'failed' && <>
          <Dialog.Title className="dialog-title">The analysis did not finish.</Dialog.Title>
          <Dialog.Description className="dialog-description">{state.message} Your images are still in the workspace.</Dialog.Description>
          <div className="analysis-failure" role="alert"><CircleAlert size={16} aria-hidden="true" />No result was produced, so nothing has been saved.</div>
          <div className="confirm-actions"><button className="button button-secondary" onClick={onCancel}>Close</button><button className="button button-primary" onClick={onRetry}><RotateCcw size={15} />Retry<ArrowRight size={16} /></button></div>
        </>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
