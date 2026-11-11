import { icon, type IconName } from './icons';
import { el } from './ui';

/** An icon button; `label` is the tooltip and the accessible name. */
export function iconButton(name: IconName, label: string, onClick: () => void, extraClass = ''): HTMLButtonElement {
  const button = el('button', { type: 'button', class: `icon-button ${extraClass}`.trim(), title: label, 'aria-label': label }, [icon(name)]);
  button.addEventListener('click', onClick);
  return button;
}

/** An icon button that stays pressed. */
export function toggleButton(name: IconName, label: string, pressed: boolean, onChange: (pressed: boolean) => void): HTMLButtonElement {
  const button = iconButton(name, label, () => {
    const next = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(next));
    onChange(next);
  }, 'toggle');
  button.setAttribute('aria-pressed', String(pressed));
  return button;
}

export interface SliderOptions {
  /** The range the slider starts with. It stretches when a value goes past it, up to the hard limits. */
  min: number;
  max: number;
  step: number;
  value: number;
  label: string;
  format: (value: number) => string;
  onInput: (value: number) => void;
  /** What the quantity itself allows; defaults to the starting range, which then never stretches. */
  hardMin?: number;
  hardMax?: number;
}

export interface Slider {
  root: HTMLLabelElement;
  set(value: number): void;
}

/** The next round number at or above `value`: 1, 2, 5, 10, 20, 50… */
function roundUp(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 5, 10].map((m) => m * magnitude).find((v) => v >= value - 1e-12) ?? value;
}

/**
 * A labelled range input with a filled track and a value you can also type. The track is only a convenient window
 * on the quantity: type a number outside it, or let go at its end, and the window grows.
 */
export function slider(options: SliderOptions): Slider {
  const hardMin = options.hardMin ?? options.min;
  const hardMax = options.hardMax ?? options.max;
  let { min, max } = options;
  let value = options.value;
  const field = el('input', { class: 'slider-value', type: 'text', inputmode: 'decimal', 'aria-label': `${options.label}, type a value`, title: 'Click to type a value' });
  const input = el('input', { type: 'range', step: options.step, 'aria-label': options.label });

  /** Makes the track cover `v`, growing in round steps. */
  const cover = (v: number) => {
    if (v > max) max = Math.min(hardMax, Math.max(roundUp(v), v));
    if (v < min) min = Math.max(hardMin, v < 0 ? -roundUp(-v) : hardMin);
    input.min = String(min);
    input.max = String(max);
  };
  const paint = () => {
    input.style.setProperty('--fill', `${((value - min) / (max - min || 1)) * 100}%`);
    if (document.activeElement !== field) field.value = options.format(value);
  };
  const show = (v: number) => {
    value = v;
    cover(v);
    input.value = String(v);
    paint();
  };

  input.addEventListener('input', () => {
    value = Number(input.value);
    paint();
    options.onInput(value);
  });
  // Letting go at the end of the track asks for more room.
  input.addEventListener('change', () => {
    if (value >= max && max < hardMax) max = Math.min(hardMax, roundUp(max * 2));
    else if (value <= min && min > hardMin) min = Math.max(hardMin, min > 0 ? min / 2 : min * 2);
    else return;
    input.min = String(min);
    input.max = String(max);
    paint();
  });

  field.addEventListener('focus', () => {
    field.value = String(Number(value.toFixed(6)));
    field.select();
  });
  const commit = () => {
    // Units and stray letters are dropped; text with no number in it leaves the value alone.
    const cleaned = field.value.replace(',', '.').replace('−', '-').replace(/[^0-9.+-]/g, '');
    const typed = Number(cleaned);
    if (/[0-9]/.test(cleaned) && Number.isFinite(typed)) {
      const next = Math.min(hardMax, Math.max(hardMin, typed));
      if (next !== value) {
        show(next);
        options.onInput(next);
      }
    }
    field.value = options.format(value);
  };
  field.addEventListener('blur', commit);
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') field.blur();
    else if (e.key === 'Escape') {
      field.value = String(value);
      field.blur();
    }
    e.stopPropagation();
  });

  show(value);
  const root = el('label', { class: 'slider' }, [el('span', { class: 'slider-head' }, [el('span', { text: options.label }), field]), input]);
  // A click on the typed value must not be forwarded to the range input by the label.
  field.addEventListener('click', (e) => e.preventDefault());
  return { root, set: show };
}

let openPopover: { panel: HTMLElement; anchor: HTMLElement; close: () => void } | undefined;

/** Shows `content` in a floating panel beside `anchor`; a second call on the same anchor closes it. */
export function popover(anchor: HTMLElement, content: HTMLElement, placement: 'below' | 'above' | 'right' = 'below'): void {
  const same = openPopover?.anchor === anchor;
  openPopover?.close();
  if (same) return;
  const panel = el('div', { class: 'popover glass', role: 'dialog' }, [content]);
  document.body.append(panel);
  const a = anchor.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  const gap = 8;
  let left = placement === 'right' ? a.right + gap : a.left;
  let top = placement === 'above' ? a.top - p.height - gap : placement === 'right' ? a.top : a.bottom + gap;
  left = Math.max(8, Math.min(left, innerWidth - p.width - 8));
  top = Math.max(8, Math.min(top, innerHeight - p.height - 8));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  const onDown = (e: PointerEvent) => {
    if (!panel.contains(e.target as Node) && !anchor.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  function close(): void {
    panel.remove();
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey);
    anchor.removeAttribute('aria-expanded');
    openPopover = undefined;
  }
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey);
  anchor.setAttribute('aria-expanded', 'true');
  openPopover = { panel, anchor, close };
}

export function closePopover(): void {
  openPopover?.close();
}

let toastTimer: number | undefined;

/** A short message at the bottom of the stage; `kind: 'error'` for what the engine refused. */
export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  let node = document.querySelector<HTMLDivElement>('.toast');
  if (!node) {
    node = el('div', { class: 'toast glass', role: 'status' });
    document.body.append(node);
  }
  node.textContent = message;
  node.dataset.kind = kind;
  node.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node!.classList.remove('visible'), kind === 'error' ? 5000 : 2400);
}
