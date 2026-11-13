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

export type Theme = 'light' | 'dark';

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  themeCache.clear();
  window.dispatchEvent(new Event('themechange'));
}

export function toggleTheme(): void {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem('soliton-theme', next);
  } catch {
    /* storage unavailable */
  }
  applyTheme(next);
}

export function presenting(): boolean {
  return 'present' in document.documentElement.dataset;
}

/**
 * Projector mode: everything larger and heavier, on the light theme, because a projector washes out a dark one.
 * The theme the viewer had chosen comes back when they leave.
 */
export function setPresenting(on: boolean): void {
  const root = document.documentElement;
  if (on === presenting()) return;
  if (on) {
    root.dataset.present = currentTheme();
    applyTheme('light');
  } else {
    const before = root.dataset.present === 'dark' ? 'dark' : 'light';
    delete root.dataset.present;
    applyTheme(before);
  }
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

/** A colour for a canvas: a token such as `--force-gravity` is looked up in the theme, anything else is used as it is. */
export function paint(color: string): string {
  return color.startsWith('--') ? cssVar(color) : color;
}

/** The same colour for an element's style. */
export function cssColor(color: string): string {
  return color.startsWith('--') ? `var(${color})` : color;
}

/** How much larger than usual a canvas draws its text and lines: more than 1 on a projector. */
export function stageScale(): number {
  return Number(cssVar('--stage-scale')) || 1;
}

/** A length from the layout, given in pixels at the usual text size, as it is now that the text may be larger. */
export function layoutPx(px: number): number {
  let size = Number(themeCache.get('font-size'));
  if (!size) {
    size = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
    themeCache.set('font-size', String(size));
  }
  return (px * size) / 14;
}

/** A canvas font of `size` pixels at the usual scale. */
export function stageFont(size: number, weight = 400): string {
  return `${weight} ${Math.round(size * stageScale() * 10) / 10}px Inter, ui-sans-serif, system-ui, sans-serif`;
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
