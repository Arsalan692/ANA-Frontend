import { motion } from 'motion/react'
import { easing, timings } from '../../motion/presets'
import { formatConfidence } from '../../features/samples/format'

// The bar grows on mount; MotionConfig in MotionProvider skips the transform when motion is reduced.
export function ConfidenceBar({ value, label = 'Model confidence', missing = 'Not provided for this result.' }: { value?: number; label?: string; missing?: string }) {
  if (value === undefined) return <div className="confidence">
    <span className="confidence-label">{label}</span>
    <p className="confidence-missing">{missing}</p>
  </div>
  return <div className="confidence">
    <span className="confidence-label">{label}</span>
    <strong className="confidence-value">{formatConfidence(value)}</strong>
    <div className="confidence-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 1000) / 10} aria-valuetext={formatConfidence(value)}>
      <motion.span className="confidence-fill" initial={{ scaleX: 0 }} animate={{ scaleX: value }} transition={{ duration: timings.page * 2, ease: easing }} />
    </div>
  </div>
}
