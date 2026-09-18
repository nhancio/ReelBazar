/** Compact relative time — "3h", "2w". Ported verbatim from the web InstaPostCard. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}y`;
}

/** `1234` -> `1,234`. Replaces the web build's `Number.toLocaleString()`, which is a no-op
 *  on Android where Hermes ships without full ICU unless explicitly enabled. */
export function formatCount(n: number | undefined | null): string {
  return String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
