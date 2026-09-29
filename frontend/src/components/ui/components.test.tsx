import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Badge } from './Badge'
import { ConfidenceBar } from './ConfidenceBar'
import { FieldAgreement } from './FieldAgreement'
import { MetaRow } from './MetaRow'
import { ResultStatus } from './ResultStatus'
import { formatConfidence, formatField } from '../../features/samples/format'

const html = renderToStaticMarkup

describe('result building blocks', () => {
  it('formats confidence and field numbers', () => {
    expect(formatConfidence(0.942)).toBe('94.2%')
    expect(formatConfidence(1)).toBe('100.0%')
    expect(formatField(3)).toBe('Field 03')
  })

  it('writes the screening result in words for both calls', () => {
    expect(html(<ResultStatus call="positive" size="large" />)).toContain('ANA positive')
    expect(html(<ResultStatus call="negative" size="large" />)).toContain('ANA negative')
    expect(html(<ResultStatus call="negative" />)).toContain('Negative')
  })

  it('shows confidence as an accessible meter, or says when it is missing', () => {
    const bar = html(<ConfidenceBar value={0.942} />)
    expect(bar).toContain('94.2%')
    expect(bar).toContain('role="meter"')
    expect(bar).toContain('aria-valuenow="94.2"')
    const missing = html(<ConfidenceBar />)
    expect(missing).toContain('Not provided')
    expect(missing).not.toContain('role="meter"')
  })

  it('counts fields that agree with the sample-level call', () => {
    expect(html(<FieldAgreement fields={['positive', 'positive', 'positive', 'positive']} sampleCall="positive" />)).toContain('4 of 4 fields agree')
    const split = html(<FieldAgreement fields={['positive', 'positive', 'negative', 'negative']} sampleCall="positive" />)
    expect(split).toContain('2 of 4 fields agree')
    expect(split.match(/class="disagree"/g)).toHaveLength(2)
  })

  it('renders badges and metadata items', () => {
    expect(html(<Badge dot>Demo data</Badge>)).toContain('badge-dot')
    expect(html(<MetaRow><strong>S-0248</strong><span>4 images</span></MetaRow>).match(/meta-item/g)).toHaveLength(2)
  })
})
