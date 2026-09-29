import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DraftProvider, MotionProvider } from './Providers'
import { useMotionPreference } from './contexts'
import { Sidebar } from '../components/layout/Sidebar'
import { Topbar } from '../components/layout/Topbar'
import { Workspace } from '../features/workspace/Workspace'
import { FuturePage } from '../features/FuturePage'
import { pageMotion } from '../motion/presets'

function Shell() {
  const location = useLocation()
  const { reduced } = useMotionPreference()
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      main.current?.focus({ preventScroll: true })
      previousPath.current = location.pathname
    }
  }, [location.pathname])
  const section = location.pathname === '/samples' ? 'Sample history' : location.pathname === '/research' ? 'Research' : 'Workspace'
  return <><a className="skip-link" href="#main">Skip to content</a><Sidebar /><div className="app-content"><Topbar section={section} /><main ref={main} id="main" tabIndex={-1}><AnimatePresence mode="wait" initial={false}><motion.div key={location.pathname} {...pageMotion(reduced)} className="route-content"><Routes location={location}><Route path="/" element={<Navigate to="/workspace" replace />} /><Route path="/workspace" element={<Workspace />} /><Route path="/samples" element={<FuturePage kind="history" />} /><Route path="/research" element={<FuturePage kind="research" />} /><Route path="*" element={<FuturePage kind="missing" />} /></Routes></motion.div></AnimatePresence></main></div></>
}

export function App() {
  return <MotionProvider><DraftProvider><Shell /></DraftProvider></MotionProvider>
}
