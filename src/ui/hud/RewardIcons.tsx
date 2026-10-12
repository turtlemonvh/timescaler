/** Inline SVG icons for coins and trophies — inline rather than emoji because
 * headless Chromium (screenshots, CI) has no emoji font. Decorative: callers
 * put the meaning in text or an `aria-label`. */

export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="#e3a722" stroke="#a85a26" strokeWidth="2" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="#fff1c6" strokeWidth="2" />
    </svg>
  );
}

export function TrophyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5A3.5 3.5 0 0 1 16.5 10"
        fill="none"
        stroke="#a85a26"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7 3h10v5a5 5 0 0 1-10 0V3z"
        fill="#e3a722"
        stroke="#a85a26"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10.5 13h3v4h-3z" fill="#e3a722" />
      <path d="M7.5 21h9v-2.5a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1z" fill="#a85a26" />
    </svg>
  );
}
