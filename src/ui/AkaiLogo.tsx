/** AKAI professional wordmark — simplified vector for boot + deck. */
export function AkaiLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 28"
      aria-label="AKAI professional"
      role="img"
    >
      <text x="0" y="20" fill="currentColor" fontFamily="ui-sans-serif, system-ui" fontSize="22" fontWeight="800">
        AKAI
      </text>
      <text x="62" y="20" fill="currentColor" fontFamily="ui-sans-serif, system-ui" fontSize="11" fontStyle="italic" opacity="0.85">
        professional
      </text>
    </svg>
  );
}
