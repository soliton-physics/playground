/** Small DOM helpers so the modes can build their layouts without a framework. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (typeof value === 'boolean') {
      if (value) node.setAttribute(key, '');
    } else node.setAttribute(key, String(value));
  }
  node.append(...children);
  return node;
}

export function query<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`missing element ${selector}`);
  return node;
}

/** Three significant figures, the way a textbook writes a measured quantity. */
export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '–';
  const magnitude = Math.abs(value);
  if (magnitude < 5e-10) return '0';
  if (magnitude < 1e-3 || magnitude >= 1e6) return value.toExponential(2).replace('e+', 'e').replace(/^-/, '−');
  const decimals = Math.max(0, digits - 1 - Math.floor(Math.log10(magnitude)));
  return value.toFixed(Math.min(decimals, 4)).replace('-0', '−0').replace(/^-/, '−');
}

export function formatQuantity(value: number, unit: string, digits = 3): string {
  if (unit === '°') return `${formatNumber(value, digits)}°`;
  return unit ? `${formatNumber(value, digits)} ${unit}` : formatNumber(value, digits);
}

/** A length of time: milliseconds when it is too short for seconds to say much. */
export function formatDuration(seconds: number): string {
  return Math.abs(seconds) < 0.1 && seconds !== 0 ? `${formatNumber(seconds * 1000)} ms` : `${formatNumber(seconds)} s`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function toggleTheme(): void {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('soliton-theme', next);
  } catch {
    /* storage unavailable */
  }
  themeCache.clear();
  window.dispatchEvent(new Event('themechange'));
}

const themeCache = new Map<string, string>();

/** Reads a CSS custom property from the document, for canvases that must match the theme. */
export function cssVar(name: string): string {
  let value = themeCache.get(name);
  if (value === undefined) {
    value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    themeCache.set(name, value);
  }
  return value;
}

/** A time on the clock: seconds for a pendulum, minutes or hours for an orbit. */
export function formatTime(seconds: number): string {
  const t = Math.abs(seconds);
  if (t < 120) return `${seconds.toFixed(2)} s`;
  if (t < 7200) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(2)} h`;
}

/** A position on an axis whose lines are `step` metres apart: metres, or kilometres once the lines are that far apart. */
export function formatLength(metres: number, step: number): string {
  if (step >= 1000) return `${+(metres / 1000).toFixed(0)} km`;
  return `${+metres.toFixed(2)} m`;
}

/** A size or distance in words: millimetres to thousands of kilometres, to two or three figures. */
export function formatSize(metres: number): string {
  const m = Math.abs(metres);
  if (m >= 1000) return `${formatNumber(metres / 1000)} km`;
  if (m >= 1) return `${formatNumber(metres)} m`;
  if (m >= 0.01) return `${formatNumber(metres * 100)} cm`;
  return `${formatNumber(metres * 1000)} mm`;
}
