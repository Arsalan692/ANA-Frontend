import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type Crumb = { label: string; to?: string }

/** Breadcrumb row at the top of each page, with an optional badge on the right (as in concept D). */
export function PageHeader({ crumbs, badge }: { crumbs: Crumb[]; badge?: ReactNode }) {
  return <div className="page-header">
    <nav className="breadcrumb" aria-label="Breadcrumb"><ol>{crumbs.map((crumb, index) => <li key={crumb.label}>
      {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>}
    </li>)}</ol></nav>
    {badge}
  </div>
}
