import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { Sample } from '../../types/sample'
import { ResultStatus } from '../../components/ui/ResultStatus'
import { formatConfidence, formatField } from './format'

export function FieldResultsDialog({ sample }: { sample: Sample }) {
  return <Dialog.Root>
    <Dialog.Trigger className="button button-secondary panel-button">View field results</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content field-results-dialog">
        <div className="eyebrow">SAMPLE {sample.reference}</div>
        <Dialog.Title className="dialog-title">Field results</Dialog.Title>
        <Dialog.Description className="dialog-description">Each field is screened on its own; the sample-level result is reported separately by the classifier.</Dialog.Description>
        <table className="field-results">
          <thead><tr><th scope="col">Field</th><th scope="col">Result</th><th scope="col" className="numeric">Confidence</th></tr></thead>
          <tbody>{sample.images.map(image => <tr key={image.id}>
            <th scope="row"><span className="field-results-name"><img src={image.src} alt="" />{formatField(image.field)}</span></th>
            <td>{image.result ? <ResultStatus call={image.result.call} /> : 'Not screened'}</td>
            <td className="numeric">{image.result?.confidence !== undefined ? formatConfidence(image.result.confidence) : 'Not provided'}</td>
          </tr>)}</tbody>
        </table>
        {sample.demo && <p className="dialog-footnote">Demo data: synthetic images and simulated results.</p>}
        <Dialog.Close className="icon-button dialog-close" aria-label="Close field results"><X size={20} /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
