import type { ReactNode } from 'react'

export function EmptyState({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children: ReactNode; actions?: ReactNode }) {
  return <section className="empty-state">
    <img className="empty-state-art" src="/assets/empty-slide.webp" alt="" />
    <div className="eyebrow">{eyebrow}</div>
    <h1>{title}</h1>
    <div className="empty-state-body">{children}</div>
    {actions && <div className="empty-state-actions">{actions}</div>}
  </section>
}
