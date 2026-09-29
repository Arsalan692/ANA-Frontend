import type { ReactNode } from 'react'

export function Badge({ children, dot = false, className = '' }: { children: ReactNode; dot?: boolean; className?: string }) {
  return <span className={`badge ${className}`}>{dot && <span className="badge-dot" aria-hidden="true" />}{children}</span>
}
