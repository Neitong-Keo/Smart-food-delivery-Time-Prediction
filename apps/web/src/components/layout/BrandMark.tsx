export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="brand-mark-route"
        d="M7 21h8a4 4 0 0 0 0-8h-3a4 4 0 0 1 0-8h9"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="6" cy="21" r="4" fill="currentColor" />
      <circle cx="22" cy="5" r="3.5" fill="currentColor" />
    </svg>
  );
}
