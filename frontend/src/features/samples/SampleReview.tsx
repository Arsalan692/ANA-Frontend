import { ArrowLeft, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import type { Sample } from '../../types/sample'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { MetaRow } from '../../components/ui/MetaRow'
import { PageHeader } from '../../components/layout/PageHeader'
import { FieldGrid } from './FieldGrid'
import { InterpretationPanel } from './InterpretationPanel'
import { useSample } from './useSamples'
import { describeFieldCount } from './format'

function reviewStatus(sample: Sample) {
  if (sample.review.status === 'reviewed') return { label: 'Reviewed', tone: 'reviewed' }
  if (!sample.result) return { label: 'Awaiting screening', tone: 'pending' }
  if (sample.result.needsReview) return { label: 'Needs closer review', tone: 'attention' }
  return { label: 'Ready for review', tone: 'ready' }
}

export function SampleReview() {
  const { sampleId } = useParams()
  const sample = useSample(sampleId)
  if (!sample) return <>
    <PageHeader crumbs={[{ label: 'Workspace', to: '/workspace' }, { label: 'Sample not found' }]} />
    <EmptyState eyebrow="SAMPLE NOT FOUND" title="No sample under this reference." actions={<Link to="/workspace" className="button button-primary"><ArrowLeft size={16} />Back to workspace</Link>}>
      <p>There is no sample called “{sampleId}” in this workspace. Samples exist only for the current session.</p>
    </EmptyState>
  </>
  const status = reviewStatus(sample)
  const count = sample.images.length
  return <div className="review-layout">
    <div className="review-main">
      <PageHeader crumbs={[{ label: 'Workspace', to: '/workspace' }, { label: sample.reference }]} badge={sample.demo ? <Badge dot>Demo data</Badge> : sample.analysis?.simulated ? <Badge dot>Simulated analysis</Badge> : sample.analysis ? <Badge dot>Research model</Badge> : undefined} />
      <section className="review-intro">
        <h1>Sample review</h1>
        <p>{describeFieldCount(count)}. One sample-level screening result.</p>
      </section>
      <div className="review-toolbar">
        <MetaRow>
          <strong>{sample.reference}</strong>
          <span>{count} {count === 1 ? 'image' : 'images'}</span>
          <span className={`review-state review-state-${status.tone}`}><span className="review-state-dot" aria-hidden="true" />{status.label}</span>
        </MetaRow>
        <Link to="/workspace" className="button button-outline"><Plus size={17} />New sample</Link>
      </div>
      <FieldGrid images={sample.images} />
    </div>
    <InterpretationPanel sample={sample} />
  </div>
}
