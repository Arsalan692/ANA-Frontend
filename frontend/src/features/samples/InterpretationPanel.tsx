import { ArrowRight, Check, ChevronDown, CircleAlert } from 'lucide-react'
import type { Sample, SampleResult } from '../../types/sample'
import { ConfidenceBar } from '../../components/ui/ConfidenceBar'
import { FieldAgreement } from '../../components/ui/FieldAgreement'
import { FieldResultsDialog } from './FieldResultsDialog'
import { useCompleteReview } from './useSamples'
import { formatDateTime } from './format'

const REFERENCE_TEXT = {
  positive: 'Nuclear fluorescence was detected in the screened fields.',
  negative: 'No specific nuclear fluorescence was detected in the screened fields.',
}

function ReviewAction({ sample }: { sample: Sample }) {
  const completeReview = useCompleteReview()
  if (sample.review.status === 'reviewed') return <>
    <button className="button button-primary panel-button" disabled><span>Review completed</span><Check size={17} /></button>
    <p className="review-confirmation" role="status"><Check size={14} />Reviewed {formatDateTime(sample.review.reviewedAt)}</p>
  </>
  return <button className="button button-primary panel-button" onClick={() => completeReview(sample.id)}><span>Complete review</span><ArrowRight size={17} className="button-arrow" /></button>
}

function ScreeningSummary({ sample, result }: { sample: Sample; result: SampleResult }) {
  const fieldCalls = sample.images.flatMap(image => image.result ? [image.result.call] : [])
  const differing = fieldCalls.filter(call => call !== result.call).length
  return <>
    <div className="panel-result">
      <div className="eyebrow">SAMPLE SCREENING</div>
      <h2 className={`panel-call panel-call-${result.call}`}>ANA {result.call}</h2>
      <p className="panel-subline">{sample.analysis?.simulated ? 'Simulated result' : 'Classifier result'} · {sample.reference}</p>
    </div>
    <div className="panel-section screening-reference">
      <h3>Screening reference</h3>
      <div className="screening-reference-body">
        <figure><img src={`/assets/screen-${result.call}.webp`} alt="" /><figcaption>Schematic illustration</figcaption></figure>
        <p>{REFERENCE_TEXT[result.call]}</p>
      </div>
    </div>
    <div className="panel-section"><ConfidenceBar value={result.confidence} /></div>
    <div className="panel-section">
      <FieldAgreement fields={fieldCalls} sampleCall={result.call} />
      {result.needsReview && <div className="review-flag"><CircleAlert size={16} aria-hidden="true" /><p><strong>Needs a closer look.</strong> {differing > 0 ? `${differing} of ${fieldCalls.length} fields differ from the sample-level result. ` : ''}Check each field before completing the review.</p></div>}
      <p className="panel-note">Model output for clinician review.</p>
    </div>
  </>
}

export function InterpretationPanel({ sample }: { sample: Sample }) {
  const { result, analysis } = sample
  return <aside className="interpretation-panel" aria-label="Sample interpretation">
    {result ? <ScreeningSummary sample={sample} result={result} /> : <div className="panel-result"><div className="eyebrow">SAMPLE SCREENING</div><h2 className="panel-call">Not screened yet</h2><p className="panel-subline">This sample has no screening result.</p></div>}
    <div className="panel-actions">
      {result && <ReviewAction sample={sample} />}
      <FieldResultsDialog sample={sample} />
    </div>
    <details className="analysis-details">
      <summary><span><strong>Analysis details</strong><small>{analysis ? `${analysis.modelLabel}${analysis.simulated ? ' · Simulated' : ''}` : 'Not analysed'}</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
      <dl>
        {analysis && <><div><dt>Classifier</dt><dd>{analysis.modelLabel}</dd></div>
        <div><dt>Mode</dt><dd>{!analysis.simulated ? 'Model output' : sample.demo ? 'Simulated (demo data)' : 'Simulated from image brightness, not a model'}</dd></div>
        <div><dt>Analysed</dt><dd>{formatDateTime(analysis.analysedAt)}</dd></div></>}
        <div><dt>Fields screened</dt><dd>{sample.images.length}</dd></div>
        <div><dt>Output</dt><dd>ANA positive or negative. Staining pattern classification comes in a later version.</dd></div>
      </dl>
    </details>
    <p className="panel-disclaimer">Decision support, not a diagnosis.</p>
  </aside>
}
