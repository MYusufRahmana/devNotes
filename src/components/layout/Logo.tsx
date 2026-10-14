export function LogoMark({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-fg" />
      <path
        d="M10 9h6.5a7 7 0 0 1 0 14H10z"
        fill="none"
        className="stroke-bg"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle cx="22.5" cy="9.5" r="2.5" className="fill-accent" />
    </svg>
  )
}
