import { forwardRef, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import type { SampleImage } from '../../types/sample'
import { ResultStatus } from '../../components/ui/ResultStatus'
import { FieldViewer } from '../viewer/FieldViewer'
import { formatConfidence, formatField } from './format'

const FieldTile = forwardRef<HTMLButtonElement, { image: SampleImage; onOpen: () => void }>(function FieldTile({ image, onOpen }, ref) {
  const label = formatField(image.field)
  return <figure className="field-tile">
    <button ref={ref} className="field-photo" onClick={onOpen} aria-label={`Open ${label} in the viewer`}>
      <img src={image.src} alt={`${label}${image.synthetic ? ', synthetic illustration' : ''}`} width={image.width} height={image.height} decoding="async" />
      {image.synthetic && <span className="synthetic-tag">Synthetic illustration</span>}
      <span className="field-expand" aria-hidden="true"><Maximize2 size={15} /></span>
    </button>
    <figcaption>
      <span className="field-name">{label}</span>
      {image.result ? <ResultStatus call={image.result.call} /> : <span className="field-pending">Not screened</span>}
      <span className="field-confidence">{image.result?.confidence !== undefined ? formatConfidence(image.result.confidence) : <><span aria-hidden="true">—</span><span className="sr-only">Confidence not provided</span></>}</span>
    </figcaption>
  </figure>
})

// Images keep their aspect ratio (object-fit: contain); microscopy is never cropped or filtered.
export function FieldGrid({ images }: { images: SampleImage[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const tiles = useRef<(HTMLButtonElement | null)[]>([])
  return <section className={`field-grid ${images.length === 1 ? 'single' : ''}`} aria-label="Sample fields">
    {images.map((image, index) => <FieldTile key={image.id} image={image} onOpen={() => setOpen(index)} ref={node => { tiles.current[index] = node }} />)}
    <FieldViewer images={images} index={open} onIndexChange={setOpen} onClosed={index => tiles.current[index]?.focus()} />
  </section>
}
