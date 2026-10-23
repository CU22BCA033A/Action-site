export function Spinner({ className = "size-4", label }: { className?: string; label?: string }) {
  return (
    <svg className={`spinner shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" role={label ? "img" : undefined} aria-hidden={label ? undefined : true} aria-label={label}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
