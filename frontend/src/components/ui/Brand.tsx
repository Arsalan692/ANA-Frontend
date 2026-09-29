export function NucleusMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 48 64" fill="none" aria-hidden="true">
    <g transform="rotate(-24 24 32)" stroke="currentColor">
      <ellipse cx="24" cy="32" rx="15" ry="26" strokeWidth=".8" />
      <ellipse cx="24" cy="32" rx="11" ry="22" strokeWidth="1.3" strokeDasharray=".2 3.5" strokeLinecap="round" />
      <ellipse cx="24" cy="32" rx="7" ry="16" strokeWidth="2" strokeDasharray=".1 4" strokeLinecap="round" />
      <path d="M19 19 28 24 20 32 29 38 23 46" strokeWidth="2" strokeDasharray=".1 4.5" strokeLinecap="round" />
    </g>
  </svg>
}
