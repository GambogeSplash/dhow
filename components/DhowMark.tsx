/** Dhow mark — a lateen sail over a hull line. Inherits currentColor. */
export function DhowMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* lateen sail */}
      <path
        d="M12.2 2.6c.0-.5.7-.6.9-.1L19 16.2H12.6V3.0Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* foresail */}
      <path
        d="M11.2 5.4c0-.45-.62-.55-.83-.13L5.2 16.2h6.0V5.4Z"
        fill="currentColor"
        opacity="0.45"
      />
      {/* hull */}
      <path
        d="M3 17.4h18l-2.4 3.2a2 2 0 0 1-1.6.8H7a2 2 0 0 1-1.6-.8L3 17.4Z"
        fill="currentColor"
      />
    </svg>
  );
}
