import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownToLine, ArrowRight, Check, ChevronRight, CircleAlert, FileImage, ImagePlus, Layers2, LoaderCircle, LockKeyhole, Plus, ScanLine, Trash2, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useDraft, useMotionPreference } from '../../app/contexts'
import { formatBytes } from './filePolicy'
import { NucleusMark } from '../../components/ui/Brand'

function ClearDraft() {
  const { clearDraft, images } = useDraft()
  return <Dialog.Root><Dialog.Trigger className="text-button"><Trash2 size={14} />Clear sample</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content confirm-dialog">
    <Dialog.Title className="dialog-title">Clear this sample?</Dialog.Title><Dialog.Description className="dialog-description">Remove {images.length} selected {images.length === 1 ? 'image' : 'images'} from the workspace. Your original files will not be changed.</Dialog.Description>
    <div className="confirm-actions"><Dialog.Close className="button button-secondary">Keep sample</Dialog.Close><Dialog.Close className="button button-primary" onClick={clearDraft}>Clear sample<ArrowRight size={16} /></Dialog.Close></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
}

export function Workspace() {
  const { images, errors, busy, addFiles, removeImage, dismissErrors } = useDraft()
  const { reduced } = useMotionPreference()
  const input = useRef<HTMLInputElement>(null)
  const chooseButton = useRef<HTMLButtonElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const hasImages = images.length > 0
  useEffect(() => {
    const node = surface.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => { node.dataset.visible = String(entry.isIntersecting) })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const onDrop = (event: DragEvent) => {
    event.preventDefault(); dragDepth.current = 0; setDragging(false)
    void addFiles(Array.from(event.dataTransfer.files))
  }
  return <>
    <section className="page-intro"><div><div className="eyebrow"><span className="tiny-rule" />THE ANALYSIS WORKSPACE</div><h1>Prepare a sample<span className="accent-period">.</span></h1><p>A thoughtful first step towards a clearer interpretation.</p></div><div className="intro-index"><span>01</span><small>PREPARATION</small></div></section>
    <div className="workspace-layout">
      <section className="preparation-panel" aria-label="Sample preparation">
        <div className="section-heading"><div><span className="section-number">01 /</span><h2>Sample images</h2></div><span className="count-label">{hasImages ? `${String(images.length).padStart(2, '0')} / 12 FIELDS` : 'ONE SAMPLE AT A TIME'}</span></div>
        <input ref={input} id="sample-files" data-testid="file-input" type="file" accept="image/jpeg,image/png" multiple className="sr-only" tabIndex={-1} onChange={event => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
        <div ref={surface} className={`upload-surface ${dragging ? 'dragging' : ''} ${hasImages ? 'has-images' : ''}`} onDragEnter={event => { event.preventDefault(); if (!event.dataTransfer.types.includes('Files')) return; dragDepth.current += 1; setDragging(true) }} onDragOver={event => event.preventDefault()} onDragLeave={event => { event.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) setDragging(false) }} onDrop={onDrop} aria-busy={busy}>
          {!hasImages ? <div className="upload-empty">
            <div className="upload-art" aria-hidden="true"><img src="/assets/cell-etching.png" alt="" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><span className="art-coordinate">HEp-2 / FIELD STUDY</span></div>
            <div className="upload-copy"><span className="upload-symbol"><ArrowDownToLine size={22} strokeWidth={1.3} /></span><h3>Bring your fields<br /><em>into focus.</em></h3><p>Drop microscopy images here,<br className="desktop-break" /> or choose them from your device.</p><button ref={chooseButton} className="button button-primary" onClick={() => input.current?.click()} disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Plus size={17} />}Choose images<ArrowRight size={16} className="button-arrow" /></button><span className="upload-formats">JPEG or PNG <span>·</span> up to 20 MB each</span></div>
            <div className="upload-bottom"><span className="mini-cross">+</span><span>Several fields. One sample. A complete picture.</span><span className="mini-cross">+</span></div>
          </div> : <div className="selected-images">
            <div className="draft-toolbar"><span><span className="status-dot" />Sample draft</span><ClearDraft /></div>
            <motion.div className="image-grid" layout={!reduced}>
              <AnimatePresence initial={false}>{images.map((image, index) => <motion.figure layout={!reduced} key={image.id} initial={{ opacity: 0, scale: reduced ? 1 : 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.08 : 0.2 }} className="image-tile">
                <div className="image-tile-photo"><img src={image.url} alt={`Selected field ${index + 1}: ${image.file.name}`} /><span className="field-index">FIELD {String(index + 1).padStart(2, '0')}</span><button className="remove-image" aria-label={`Remove ${image.file.name}`} onClick={() => { removeImage(image.id); requestAnimationFrame(() => chooseButton.current?.focus()) }}><X size={15} /></button></div>
                <figcaption><span title={image.file.name}>{image.file.name}</span><small>{image.width} × {image.height} <span>·</span> {formatBytes(image.file.size)}</small></figcaption>
              </motion.figure>)}</AnimatePresence>
            </motion.div>
            <button ref={chooseButton} className="add-more" onClick={() => input.current?.click()} disabled={busy || images.length >= 12}>{busy ? <LoaderCircle className="spin" size={17} /> : <ImagePlus size={17} />} {images.length >= 12 ? '12-image limit reached' : 'Add more images'}<span>{images.length} of 12</span></button>
          </div>}
          {dragging && <div className="drop-overlay"><ArrowDownToLine size={34} /><span>Release to add your images</span></div>}
        </div>
        <div className="privacy-line"><LockKeyhole size={14} /><span>Files stay in this browser. Nothing is uploaded.</span><span className="session-label">SESSION ONLY</span></div>
        <div className="sr-only" role="status" aria-live="polite">{busy ? 'Checking selected images.' : `${images.length} images selected.`}</div>
        {errors.length > 0 && <div className="file-errors" role="alert"><div><CircleAlert size={17} /><strong>Some files need attention</strong><button className="icon-button" onClick={dismissErrors} aria-label="Dismiss file errors"><X size={15} /></button></div><ul>{errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>}
        <div className="sample-guidance"><div className="eyebrow">A WELL-PREPARED SAMPLE</div><div className="guidance-items"><div><Layers2 size={18} strokeWidth={1.3} /><div><h3>Keep the fields together</h3><p>Choose images belonging to the same patient sample.</p></div></div><div><ScanLine size={18} strokeWidth={1.3} /><div><h3>Preserve the original view</h3><p>Use the original microscopy exports, without added filters.</p></div></div></div></div>
      </section>
      <aside className="workflow-panel" aria-label="Sample workflow">
        <div className="eyebrow">FROM FIELD TO FINDING</div><h2>A clear path<br /><em>through the sample.</em></h2><p className="workflow-lead">Each step brings the images closer to one considered result.</p>
        <ol className="workflow-steps"><li className="current"><span className="step-marker">{hasImages ? <Check size={15} /> : '01'}</span><div><h3>Prepare the images <span>NOW</span></h3><p>Select the fields from one sample.</p></div></li><li><span className="step-marker">02</span><div><h3>Analyse the patterns</h3><p>Image-level classification, brought together at sample level.</p></div></li><li><span className="step-marker">03</span><div><h3>Review the interpretation</h3><p>Inspect the evidence behind the predicted pattern.</p></div></li></ol>
        <div className="sample-summary"><div><span>Selected fields</span><strong>{String(images.length).padStart(2, '0')}</strong></div><div><span>Sample status</span><span className="sample-state">{busy ? 'Checking files' : hasImages ? 'Draft prepared' : 'Awaiting images'}</span></div></div>
        <button className="button button-analysis" disabled aria-describedby="analysis-availability"><span>Analyse sample</span><ArrowRight size={17} /></button><p id="analysis-availability" className="availability-note">Analysis will be available in Phase 3.<br />This preview prepares images only.</p>
        <div className="principle"><NucleusMark /><p>One sample.<br /><em>A more complete perspective.</em></p></div>
      </aside>
    </div>
    <footer className="page-footer"><span><FileImage size={13} /> HEp-2 indirect immunofluorescence</span><span>Decision support, not a diagnosis.<ChevronRight size={12} /></span></footer>
  </>
}
