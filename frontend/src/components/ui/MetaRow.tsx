import { Children } from 'react'
import type { ReactNode } from 'react'

/** Inline metadata separated by fine vertical rules, e.g. "S-0248 | 4 images | Ready for review". */
export function MetaRow({ children }: { children: ReactNode }) {
  return <div className="meta-row">{Children.toArray(children).map((child, index) => <span key={index} className="meta-item">{child}</span>)}</div>
}
