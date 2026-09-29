import * as Switch from '@radix-ui/react-switch'
import { Activity, ChevronRight } from 'lucide-react'
import { useMotionPreference } from '../../app/contexts'
import { HelpDialog } from '../ui/HelpDialog'

export function Topbar({ section }: { section: string }) {
  const { reduced, toggleReduced, systemReduced } = useMotionPreference()
  return <header className="topbar">
    <div className="breadcrumb"><span>ANA / LAB</span><ChevronRight size={12} /><span>{section}</span></div>
    <div className="topbar-actions">
      <span className="phase-badge"><span />Frontend preview</span>
      <div className="motion-control"><Activity size={14} aria-hidden="true" /><label htmlFor="motion-toggle">Reduce motion</label><Switch.Root id="motion-toggle" className="switch" checked={reduced} onCheckedChange={toggleReduced} disabled={systemReduced} aria-label={systemReduced ? 'Reduce motion, enabled by system preference' : 'Reduce motion'}><Switch.Thumb className="switch-thumb" /></Switch.Root></div>
      <HelpDialog compact />
    </div>
  </header>
}
