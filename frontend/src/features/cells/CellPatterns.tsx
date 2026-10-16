import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { ArrowDownToLine, ArrowRight, ChevronDown, CircleAlert, Eye, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { useCells, useModels } from '../../app/contexts'
import type { CellItem } from '../../app/contexts'
import type { ModelOption } from '../../api/service'
import { Badge } from '../../components/ui/Badge'
import { ModelPicker } from '../../components/ui/ModelPicker'
import { PageHeader } from '../../components/layout/PageHeader'
import { formatConfidence } from '../samples/format'
import { CELL_LIMIT } from '../../lib/images'

// Cell-level pattern classification: every image is ONE cropped cell and gets its own answer.
// Families, limits and the uncertainty cut-off come from the chosen model (its recipe, via the service);
// nothing here is combined into a sample-level result.

function Probabilities({ cell }: { cell: Required<CellItem> }) {
  const names = Object.keys(cell.result.probabilities)  // In the model's own class order.
  return <dl className="cell-probabilities" aria-label="Probability of each pattern family">
    {names.map(name => {
      const value = cell.result.probabilities[name] ?? 0
      return <div key={name} className={name === cell.result.family ? 'chosen' : undefined}>
        <dt>{name}</dt>
        <dd>
          <span className="cell-probability-track" role="meter" aria-label={`${name} probability`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 1000) / 10} aria-valuetext={formatConfidence(value)}>
            <span style={{ transform: `scaleX(${value})` }} />
          </span>
          <span className="cell-probability-value">{formatConfidence(value)}</span>
        </dd>
      </div>
    })}
  </dl>
}

function CellCard({ cell, index, onRemove }: { cell: CellItem; index: number; onRemove: () => void }) {
  const { result } = cell
  const cutOff = cell.model?.minConfidence !== undefined ? formatConfidence(cell.model.minConfidence).replace('.0%', '%') : undefined
  // Raw cell crops are often too dark to see. Once classified, the card shows the model's own input
  // (the training code's brightness-stretched canvas, made by the service), never a display filter.
  const [original, setOriginal] = useState(false)
  const modelView = result && !original
  return <li className={`cell-card ${result?.uncertain ? 'uncertain' : ''}`}>
    <figure className="cell-thumb">
      {/* Enlarged without smoothing, so the pixels on screen are the real pixels. */}
      <img src={modelView && result.modelView ? result.modelView : cell.url} alt={`Cell ${index + 1}: ${cell.file.name}${modelView && result.modelView ? ', as the model sees it' : ''}`} />
      <figcaption title={cell.file.name}><span>{cell.file.name}</span><small>{cell.width} × {cell.height} px</small>
        {result?.modelView && <button className="text-button cell-view" onClick={() => setOriginal(previous => !previous)} aria-pressed={original}><Eye size={12} />{original ? 'Original · show model’s view' : 'Model’s view · show original'}</button>}
      </figcaption>
    </figure>
    <div className="cell-result">
      {result ? <>
        <div className="eyebrow">PATTERN FAMILY</div>
        <h3 className="cell-family">{result.family}</h3>
        <p className="cell-confidence"><strong>{formatConfidence(result.confidence)}</strong> model confidence</p>
        <Probabilities cell={cell as Required<CellItem>} />
        {result.uncertain && <div className="review-flag" role="note"><CircleAlert size={16} aria-hidden="true" /><p><strong>Uncertain.</strong> The model's confidence is below {cutOff ?? 'its cut-off'}, so this answer should not be relied on. Have the cell checked by a person.</p></div>}
        {result.oversized && <div className="review-flag" role="note"><CircleAlert size={16} aria-hidden="true" /><p><strong>Is this one cell?</strong> At {result.width} × {result.height} px this image is much larger than a single cropped cell. If it shows a whole field or several cells, the answer means nothing.</p></div>}
        {cell.model && <p className="cell-model">{cell.model.label}</p>}
      </> : <p className="cell-pending">Not classified yet.</p>}
    </div>
    <button className="icon-button cell-remove" onClick={onRemove} aria-label={`Remove ${cell.file.name}`}><X size={16} /></button>
  </li>
}

/** The chosen model's limits and facts. Its picker (above) explains when the service or the model is missing. */
function ModelNotes({ model }: { model: ModelOption | undefined }) {
  if (!model) return null
  return <>
    {model.limits?.length ? <ul className="cells-limits">{model.limits.map(limit => <li key={limit}>{limit}</li>)}</ul> : null}
    <details className="analysis-details">
      <summary><span><strong>Model details</strong><small>{model.label}</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
      <dl>{model.details.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
    </details>
  </>
}

export function CellPatterns() {
  const { cells, errors, busy, classifying, failure, addFiles, removeCell, clearCells, classify, dismissErrors } = useCells()
  const { status, selected: model } = useModels('cells')
  const input = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const pending = cells.filter(cell => !cell.result).length
  const classified = cells.length - pending
  const uncertain = cells.filter(cell => cell.result?.uncertain).length
  const full = cells.length >= CELL_LIMIT
  // Without the service's answer, Classify still tries, so the user gets a clear reason it failed.
  const ready = status !== 'ready' || model !== undefined
  const onDrop = (event: DragEvent) => {
    event.preventDefault(); dragDepth.current = 0; setDragging(false)
    void addFiles(Array.from(event.dataTransfer.files))
  }
  return <>
    <PageHeader crumbs={[{ label: 'Cell patterns' }]} badge={<Badge dot>Research model</Badge>} />
    <section className="page-intro"><div><div className="eyebrow"><span className="tiny-rule" />CELL-LEVEL CLASSIFICATION</div><h1>Name the pattern<span className="accent-period">.</span></h1><p>One cropped cell at a time, placed in one of three pattern families.</p></div><div className="intro-index"><span>02</span><small>PATTERNS</small></div></section>
    <div className="workspace-layout">
      <section className="preparation-panel" aria-label="Cell images">
        <div className="section-heading"><div><span className="section-number">01 /</span><h2>Cell images</h2></div><span className="count-label">{cells.length ? `${String(cells.length).padStart(2, '0')} / ${CELL_LIMIT} CELLS` : 'ONE CELL PER IMAGE'}</span></div>
        <input ref={input} id="cell-files" data-testid="cell-input" type="file" accept="image/jpeg,image/png,image/bmp" multiple className="sr-only" tabIndex={-1} onChange={event => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
        <div className={`cell-drop ${dragging ? 'dragging' : ''}`} aria-busy={busy}
          onDragEnter={event => { event.preventDefault(); if (!event.dataTransfer.types.includes('Files')) return; dragDepth.current += 1; setDragging(true) }}
          onDragOver={event => event.preventDefault()} onDragLeave={event => { event.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) setDragging(false) }} onDrop={onDrop}>
          <span className="upload-symbol"><ArrowDownToLine size={20} strokeWidth={1.3} /></span>
          <div><h3>{dragging ? 'Release to add the cells' : 'Drop cropped cell images here'}</h3><p>Each image must show a single cell. JPEG, PNG or BMP.</p></div>
          <button className="button button-secondary" onClick={() => input.current?.click()} disabled={busy || full}>{busy ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}{full ? `${CELL_LIMIT}-cell limit reached` : cells.length ? 'Add more cells' : 'Choose cell images'}</button>
        </div>
        <div className="sr-only" role="status" aria-live="polite">{busy ? 'Checking selected images.' : classifying ? 'Classifying cells.' : `${cells.length} cell images, ${classified} classified.`}</div>
        {errors.length > 0 && <div className="file-errors" role="alert"><div><CircleAlert size={17} /><strong>Some files need attention</strong><button className="icon-button" onClick={dismissErrors} aria-label="Dismiss file errors"><X size={15} /></button></div><ul>{errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>}
        {failure && <div className="file-errors" role="alert"><div><CircleAlert size={17} /><strong>The cells were not classified</strong></div><ul><li>{failure.message} Your cell images are still here.</li>{failure.files.map(file => <li key={file.name}>{file.name}: {file.error}</li>)}</ul></div>}
        {cells.length > 0 ? <>
          <div className="cell-toolbar"><span>{classified ? `${classified} of ${cells.length} classified${uncertain ? ` · ${uncertain} uncertain` : ''}` : `${cells.length} ${cells.length === 1 ? 'cell' : 'cells'} waiting`}</span><button className="text-button" onClick={clearCells}><Trash2 size={14} />Clear all</button></div>
          <ul className="cell-list" aria-label="Cells">{cells.map((cell, index) => <CellCard key={cell.id} cell={cell} index={index} onRemove={() => removeCell(cell.id)} />)}</ul>
        </> : <p className="cell-empty">No cells yet. Results appear here, one card per cell, each with the family, the model's confidence and the probability of all three families.</p>}
      </section>
      <aside className="cells-aside" aria-label="About the pattern model">
        <div className="eyebrow">BEFORE YOU TRUST A RESULT</div>
        <h2>What this model<br /><em>can and cannot say.</em></h2>
        <ModelPicker task="cells" disabled={classifying} />
        <ModelNotes model={model} />
        <div className="sample-summary"><div><span>Cell images</span><strong>{String(cells.length).padStart(2, '0')}</strong></div><div><span>Waiting to be classified</span><span className="sample-state">{String(pending).padStart(2, '0')}</span></div></div>
        <button className="button button-analysis" disabled={!pending || busy || classifying || !ready} onClick={() => void classify(model)} aria-describedby="cells-availability"><span>{classifying ? 'Classifying…' : 'Classify cells'}</span>{classifying ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}</button>
        <p id="cells-availability" className="availability-note">{pending ? <>Each cell is classified on its own.<br />For research and demonstration, not for diagnosis.</> : cells.length ? 'Every cell here has been classified.' : 'Add at least one cell image.'}</p>
      </aside>
    </div>
    {pending > 0 && <section className="mobile-analyse" aria-label="Classify these cells">
      <span><strong>{String(pending).padStart(2, '0')}</strong> {pending === 1 ? 'cell' : 'cells'} waiting<small>{model?.label ?? 'Research model'}</small></span>
      <button className="button button-primary" disabled={busy || classifying || !ready} onClick={() => void classify(model)}>{classifying ? 'Classifying…' : 'Classify cells'}<ArrowRight size={16} /></button>
    </section>}
    <footer className="page-footer"><span>HEp-2 indirect immunofluorescence · single cells</span><span>Decision support, not a diagnosis.</span></footer>
  </>
}
