import * as Dialog from '@radix-ui/react-dialog'
import { ArrowUpRight, CircleHelp, X } from 'lucide-react'

export function HelpDialog({ compact = false }: { compact?: boolean }) {
  return <Dialog.Root>
    <Dialog.Trigger className={compact ? 'icon-button' : 'help-button'} aria-label="About this workspace">
      <CircleHelp size={17} />{!compact && <span>Workspace guide</span>}
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content">
        <div className="eyebrow">A NOTE ON THIS WORKSPACE</div>
        <Dialog.Title className="dialog-title">A considered approach<br />to ANA screening.</Dialog.Title>
        <Dialog.Description className="dialog-description">ANA / LAB is the frontend for Automated Classification of ANA Immunofluorescence Patterns Using Deep Learning. This version screens each sample as ANA positive or ANA negative.</Dialog.Description>
        <div className="guide-section"><span className="number-label">01</span><div><h3>Prepare one sample at a time</h3><p>Select the microscopy fields belonging to one sample. JPEG and PNG images are supported, up to 12 files and 20 MB per file.</p></div></div>
        <div className="guide-section"><span className="number-label">02</span><div><h3>Your files stay with you</h3><p>This build only previews files in your browser. Nothing is uploaded. Refreshing or closing the page clears your draft.</p></div></div>
        <div className="guide-section"><span className="number-label">03</span><div><h3>Positive or negative, field by field</h3><p>Each field is screened as positive or negative, then reported as one sample-level result with its confidence and field agreement. Staining pattern classification comes in a later version.</p></div></div>
        <div className="dialog-footnote"><ArrowUpRight size={15} /><span>Screening results support interpretation. They do not diagnose disease.</span></div>
        <Dialog.Close className="icon-button dialog-close" aria-label="Close workspace guide"><X size={20} /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
