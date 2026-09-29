import * as Switch from '@radix-ui/react-switch'
import { Activity } from 'lucide-react'
import { useId } from 'react'
import { useMotionPreference } from '../../app/contexts'

export function MotionSwitch() {
  const { reduced, toggleReduced, systemReduced } = useMotionPreference()
  const id = useId()
  return <div className="motion-control">
    <Activity size={16} aria-hidden="true" />
    <label htmlFor={id}>Reduce motion</label>
    <Switch.Root id={id} className="switch" checked={reduced} onCheckedChange={toggleReduced} disabled={systemReduced} aria-label={systemReduced ? 'Reduce motion, enabled by system preference' : 'Reduce motion'}><Switch.Thumb className="switch-thumb" /></Switch.Root>
  </div>
}
