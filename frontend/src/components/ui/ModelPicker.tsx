import { RotateCcw } from 'lucide-react'
import { useModels } from '../../app/contexts'
import type { Task } from '../../api/service'

const LABELS: Record<Task, string> = { screening: 'Screening model', cells: 'Pattern model' }

// Chooses which trained model handles the next analysis for one task. The list, names and descriptions
// come from the screening service; a model whose files are missing is shown but cannot be chosen.
export function ModelPicker({ task, disabled = false }: { task: Task; disabled?: boolean }) {
  const { status, models, selected, select, reload } = useModels(task)
  const id = `${task}-model`
  return <div className="model-picker">
    <label htmlFor={id}>{LABELS[task]}</label>
    {status === 'ready' && selected ? <>
      <select id={id} value={selected.id} onChange={event => select(event.target.value)} disabled={disabled} aria-describedby={`${id}-summary`}>
        {models.map(model => <option key={model.id} value={model.id} disabled={!model.available}>{model.label}{model.available ? '' : ' (files missing)'}</option>)}
      </select>
      <p id={`${id}-summary`} className="model-picker-note">{selected.summary}</p>
    </> : <>
      <select id={id} disabled aria-describedby={`${id}-summary`}><option>{status === 'loading' ? 'Looking for models…' : 'No model available'}</option></select>
      <p id={`${id}-summary`} className="model-picker-note" role={status === 'loading' ? undefined : 'status'}>
        {status === 'loading' ? 'Asking the screening service.' : status === 'unavailable'
          ? <>The screening service is not running. Start it with “npm.cmd run api”. <button className="text-button" onClick={reload}><RotateCcw size={12} />Check again</button></>
          : 'No model of this kind is installed. Add its files to the models folder and restart the service.'}
      </p>
    </>}
  </div>
}
