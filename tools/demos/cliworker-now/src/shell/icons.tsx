// The few glyphs DSH draws from outside the primitives package (workflow plugin, "open in" app tile).
export function WorkflowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <rect x="1.5" y="6" width="4" height="4" rx="1" />
      <rect x="10.5" y="2.5" width="4" height="4" rx="1" />
      <rect x="10.5" y="9.5" width="4" height="4" rx="1" />
      <path d="M5.5 8H8M8 4.5v7M8 4.5h2.5M8 11.5h2.5" />
    </svg>
  )
}
/** Generic "open in file manager" app tile (stand-in for the system app icon). */
export function OpenInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="3.5" fill="#5aa7f5" />
      <path d="M4 5.6c0-.5.4-.9.9-.9h2l.9 1h3.3c.5 0 .9.4.9.9v3.9c0 .5-.4.9-.9.9H4.9a.9.9 0 0 1-.9-.9z" fill="#fff" />
    </svg>
  )
}
