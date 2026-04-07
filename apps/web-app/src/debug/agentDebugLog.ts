const HEADERS = {
  'Content-Type': 'application/json',
  'X-Debug-Session-Id': 'eff5be',
} as const;

/** Survives backend-down / no repo file sync; copy via `exportReelbazaarDebugNdjson()` in DevTools. */
const LS_KEY = 'reelbazaar-agent-debug-eff5be';
const LS_MAX_LINES = 120;

function persistNdjsonLine(body: string) {
  if (!import.meta.env.DEV) return;
  try {
    const lines = (localStorage.getItem(LS_KEY) ?? '')
      .split('\n')
      .filter(Boolean);
    lines.push(body);
    while (lines.length > LS_MAX_LINES) lines.shift();
    localStorage.setItem(LS_KEY, lines.join('\n'));
  } catch {
    /* quota / private mode */
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as Window & { exportReelbazaarDebugNdjson?: () => string }).exportReelbazaarDebugNdjson = () =>
    localStorage.getItem(LS_KEY) ?? '';
}

/** Express (non-prod) appends NDJSON to repo `.cursor/debug-eff5be.log`. */
async function postIngest(body: string): Promise<void> {
  if (import.meta.env.DEV) {
    try {
      const direct = await fetch('http://127.0.0.1:4000/api/__debug/ingest', {
        method: 'POST',
        headers: HEADERS,
        body,
      });
      if (direct.ok) return;
    } catch {
      /* try proxy */
    }
  }
  await fetch('/api/__debug/ingest', {
    method: 'POST',
    headers: HEADERS,
    body,
  }).catch(() => {});
}

/** Dev-only NDJSON to backend ingest + in-memory buffer if file ingest fails. */
export function agentDebugLog(payload: {
  runId?: string;
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  const body = JSON.stringify({
    sessionId: 'eff5be',
    ...payload,
    timestamp: Date.now(),
  });
  persistNdjsonLine(body);
  if (import.meta.env.DEV) {
    const w = window as Window & { __AGENT_DEBUG__?: string[] };
    w.__AGENT_DEBUG__ = w.__AGENT_DEBUG__ ?? [];
    w.__AGENT_DEBUG__.push(body);
    if (w.__AGENT_DEBUG__.length > 80) w.__AGENT_DEBUG__.splice(0, w.__AGENT_DEBUG__.length - 80);
  }
  void postIngest(body);
}
