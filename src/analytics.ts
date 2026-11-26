/*
 * Which simulations people open. Vercel's free plan counts page views but not custom events, so each scene opened in
 * the playground is reported as a page of its own, /play/<mode>/<scenario>, or /embed/... when it runs inside another
 * page. Like the rest of Vercel's analytics it sets no cookies and knows nothing of who is visiting.
 */
declare global {
  interface Window {
    va?: (event: string, payload?: unknown) => void;
    vaq?: unknown[][];
  }
}

export function pageview(path: string): void {
  const payload = { route: path, path };
  // Before Vercel's script has loaded, it reads what was queued for it.
  if (window.va) window.va('pageview', payload);
  else (window.vaq ??= []).push(['pageview', payload]);
}

const word = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60);

/** The page a playground address stands for: the subject, and the scenario, preset, sandbox or gallery in it. */
export function scenePath(search: string): string {
  const q = new URLSearchParams(search);
  const mode = word(q.get('mode')) || (q.has('preset') ? 'waves' : 'mechanics');
  const what = q.get('scenario') ?? q.get('preset') ?? (q.has('sandbox') ? 'sandbox' : q.has('lesson') ? `lesson-${q.get('lesson')}` : '');
  return `/${q.has('embed') ? 'embed' : 'play'}/${mode}${what ? `/${word(what)}` : ''}`;
}

/**
 * Reports the scene on screen now, and again whenever the playground moves to another. Every subject writes its
 * scene into the address with history.replaceState, so that is where to listen. A slider changes the address too,
 * but not the scene, and is not counted.
 */
export function trackScenes(): void {
  let last = '';
  const report = () => {
    const path = scenePath(location.search);
    if (path !== last) pageview((last = path));
  };
  const replace = history.replaceState.bind(history);
  history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
    replace(data, unused, url);
    report();
  };
  report();
}
