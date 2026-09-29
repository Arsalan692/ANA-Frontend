import type { ScreeningCall } from '../../types/sample'

// One square per field: filled when the field agrees with the sample-level call, hollow when not.
export function FieldAgreement({ fields, sampleCall }: { fields: ScreeningCall[]; sampleCall: ScreeningCall }) {
  const agreeing = fields.filter(call => call === sampleCall).length
  return <div className="field-agreement">
    <span className="field-agreement-label">Field agreement</span>
    <div className="field-agreement-row">
      <span className="agreement-squares" aria-hidden="true">{fields.map((call, index) => <span key={index} className={call === sampleCall ? 'agree' : 'disagree'} />)}</span>
      <span>{agreeing} of {fields.length} fields agree</span>
    </div>
  </div>
}
