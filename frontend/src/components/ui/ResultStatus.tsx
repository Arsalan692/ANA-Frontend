import type { ScreeningCall } from '../../types/sample'
import { callLabel } from '../../features/samples/format'

// Positive and negative are distinguished by wording and a filled/hollow marker, never by
// "good/bad" colour.
export function ResultStatus({ call, size = 'compact' }: { call: ScreeningCall; size?: 'compact' | 'large' }) {
  return <span className={`result-status result-${call} result-${size}`}>
    <span className="result-marker" aria-hidden="true" />
    {size === 'large' ? `ANA ${call}` : callLabel(call)}
  </span>
}
