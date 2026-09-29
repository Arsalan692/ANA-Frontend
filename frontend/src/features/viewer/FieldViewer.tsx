import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { SampleImage } from '../../types/sample'
import { ResultStatus } from '../../components/ui/ResultStatus'
import { formatConfidence, formatField } from '../samples/format'
import { timings } from '../../motion/presets'

type Props = {
  images: SampleImage[]
  index: number | null
  onIndexChange: (index: number | null) => void
  /** Called as the viewer closes, with the field last shown, so focus can return to its tile. */
  onClosed: (index: number) => void
}

// Dark full-screen viewer for one field at a time. Pixels are shown as-is (object-fit: contain,
// no filters); only an opacity crossfade runs between fields. Zoom and pan come in a later phase.
export function FieldViewer({ images, index, onIndexChange, onClosed }: Props) {
  const image = index === null ? undefined : images[index]
  const lastShown = useRef(0)
  useEffect(() => { if (index !== null) lastShown.current = index }, [index])
  const count = images.length
  const go = (step: number) => { if (index !== null) onIndexChange((index + step + count) % count) }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1) }
  }
  return <Dialog.Root open={image !== undefined} onOpenChange={open => { if (!open) onIndexChange(null) }}>
    <Dialog.Portal>
      <Dialog.Overlay className="viewer-overlay" />
      <Dialog.Content className="viewer" onKeyDown={onKeyDown} onCloseAutoFocus={event => { event.preventDefault(); onClosed(lastShown.current) }} aria-describedby={undefined}>
        {image && <>
          <header className="viewer-header">
            <div className="viewer-title">
              <Dialog.Title className="viewer-field">{formatField(image.field)}</Dialog.Title>
              {image.result && <ResultStatus call={image.result.call} />}
              {image.result?.confidence !== undefined && <span className="viewer-confidence">{formatConfidence(image.result.confidence)}</span>}
            </div>
            <span className="viewer-count" aria-live="polite">{image.field} of {count}</span>
            <Dialog.Close className="viewer-button" aria-label="Close viewer"><X size={20} /></Dialog.Close>
          </header>
          <div className="viewer-stage">
            {count > 1 && <button className="viewer-button viewer-nav prev" onClick={() => go(-1)} aria-label="Previous field"><ChevronLeft size={24} /></button>}
            <AnimatePresence initial={false}>
              <motion.img key={image.id} src={image.src} alt={`${formatField(image.field)}${image.synthetic ? ', synthetic illustration' : ''}`} className="viewer-image"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: timings.feedback }} />
            </AnimatePresence>
            {count > 1 && <button className="viewer-button viewer-nav next" onClick={() => go(1)} aria-label="Next field"><ChevronRight size={24} /></button>}
          </div>
          <footer className="viewer-footer">
            <span className="viewer-filename" title={image.name}>{image.name}</span>
            {image.synthetic && <span className="viewer-tag">Synthetic illustration</span>}
            <span className="viewer-hint" aria-hidden="true">← → to move · Esc to close</span>
          </footer>
        </>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
