import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'motion/react'
import { BookOpen, ChevronRight, Clock3, Grid2X2, Menu, X } from 'lucide-react'
import { useMotionPreference } from '../../app/contexts'
import { NucleusMark } from '../ui/Brand'
import { HelpDialog } from '../ui/HelpDialog'
import { MotionSwitch } from '../ui/MotionSwitch'

// A sample under review belongs to the workspace flow (breadcrumb: Workspace / S-0248).
const isSampleReview = (pathname: string) => /^\/samples\/[^/]+/.test(pathname)
const isActive = (to: string, pathname: string) => to === '/workspace' ? pathname === to || isSampleReview(pathname) : pathname === to

function pageTitle(pathname: string) {
  if (pathname === '/research') return 'Research'
  if (pathname === '/samples') return 'Sample history'
  if (isSampleReview(pathname)) return 'Sample review'
  return 'Workspace'
}

const links = [
  { to: '/workspace', label: 'Workspace', icon: Grid2X2 },
  { to: '/samples', label: 'Sample history', icon: Clock3 },
  { to: '/research', label: 'Research', icon: BookOpen },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { reduced } = useMotionPreference()
  const { pathname } = useLocation()
  return <>
    <NavLink className="brand" to="/workspace" onClick={onNavigate} aria-label="ANA LAB workspace">
      <NucleusMark className="brand-mark" /><span>ANA <span className="brand-slash">/</span> LAB</span><small>THE PATTERN WORKSPACE</small>
    </NavLink>
    <nav className="navigation" aria-label="Main navigation">
      {links.map(({ to, label, icon: Icon }) => {
        const active = isActive(to, pathname)
        return <Link key={to} to={to} onClick={onNavigate} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
          {active && <motion.span className="active-marker" layoutId={onNavigate ? 'mobile-nav' : 'desktop-nav'} transition={{ duration: reduced ? 0 : 0.24 }} />}<Icon size={18} strokeWidth={1.6} /><span>{label}</span>{active && <ChevronRight size={13} className="nav-chevron" />}
        </Link>
      })}
    </nav>
    <div className="sidebar-art" aria-hidden="true"><img src="/assets/cell-etching.webp" alt="" /><span>Patterns into perspective.</span></div>
    <div className="sidebar-bottom"><HelpDialog /><MotionSwitch /><div className="local-status"><span className="status-dot" /><span>Local workspace</span><span className="version-label">v0.1</span></div></div>
  </>
}

export function Sidebar() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { document.title = `ANA / LAB — ${pageTitle(pathname)}` }, [pathname])
  return <>
    <aside className="desktop-sidebar"><SidebarContent /></aside>
    <div className="mobile-bar"><NavLink to="/workspace" className="mobile-brand"><NucleusMark />ANA / LAB</NavLink>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className="icon-button" aria-label="Open navigation"><Menu size={22} /></Dialog.Trigger>
        <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="mobile-drawer">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title><Dialog.Description className="sr-only">Navigate the ANA workspace.</Dialog.Description>
          <SidebarContent onNavigate={() => setOpen(false)} /><Dialog.Close className="icon-button drawer-close" aria-label="Close navigation"><X size={20} /></Dialog.Close>
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    </div>
  </>
}
