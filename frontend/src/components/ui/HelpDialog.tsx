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
        <Dialog.Title className="dialog-title">A considered approach<br />to pattern recognition.</Dialog.Title>
        <Dialog.Description className="dialog-description">ANA / LAB is the frontend for Automated Classification of ANA Immunofluorescence Patterns Using Deep Learning.</Dialog.Description>
        <div className="guide-section"><span className="number-label">01</span><div><h3>Prepare one sample at a time</h3><p>Select the microscopy fields belonging to one sample. JPEG and PNG images are supported, up to 12 files and 20 MB per file.</p></div></div>
        <div className="guide-section"><span className="number-label">02</span><div><h3>Your files stay with you</h3><p>This first-phase build only previews files in your browser. Nothing is uploaded. Refreshing or closing the page clears your draft.</p></div></div>
        <div className="guide-section"><span className="number-label">03</span><div><h3>Analysis comes next</h3><p>The review interface arrives in Phase 2; simulated analysis follows in Phase 3. This build does not produce predictions.</p></div></div>
        <div className="dialog-footnote"><ArrowUpRight size={15} /><span>Pattern classification supports interpretation. It does not diagnose disease.</span></div>
        <Dialog.Close className="icon-button dialog-close" aria-label="Close workspace guide"><X size={20} /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
