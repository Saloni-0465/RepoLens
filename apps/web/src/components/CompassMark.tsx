export function CompassMark({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <circle cx="36" cy="36" r="33" stroke="#1d1914" strokeWidth="1.2" />
      <circle cx="36" cy="36" r="26" stroke="#9a4a28" strokeWidth="0.8" opacity="0.85" />
      <circle cx="36" cy="36" r="4.5" fill="#234038" />
      <path d="M36 8 L40 36 L36 32 L32 36 Z" fill="#9a4a28" />
      <path d="M36 64 L32 36 L36 40 L40 36 Z" fill="#1d1914" />
      <path d="M8 36 L36 32 L32 36 L36 40 Z" fill="#1d1914" opacity="0.55" />
      <path d="M64 36 L36 40 L40 36 L36 32 Z" fill="#1d1914" opacity="0.55" />
      <path d="M18 18 L36 34 L22 22" stroke="#b0893e" strokeWidth="1" />
      <path d="M54 54 L36 38 L50 50" stroke="#b0893e" strokeWidth="1" />
    </svg>
  );
}
