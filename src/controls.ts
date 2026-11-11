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
  min: number;
  max: number;
  step: number;
  value: number;
  label: string;
  format: (value: number) => string;
  onInput: (value: number) => void;
}

export interface Slider {
  root: HTMLLabelElement;
  set(value: number): void;
}

/** A labelled range input with a filled track and a live value. */
export function slider(options: SliderOptions): Slider {
  const output = el('output', { text: options.format(options.value) });
  const input = el('input', { type: 'range', min: options.min, max: options.max, step: options.step, value: options.value, 'aria-label': options.label });
  const paint = () => {
    const fraction = (Number(input.value) - options.min) / (options.max - options.min || 1);
    input.style.setProperty('--fill', `${fraction * 100}%`);
    output.textContent = options.format(Number(input.value));
  };
  input.addEventListener('input', () => {
    paint();
    options.onInput(Number(input.value));
  });
  paint();
  const root = el('label', { class: 'slider' }, [el('span', { class: 'slider-head' }, [el('span', { text: options.label }), output]), input]);
  return {
    root,
    set(value) {
      input.value = String(value);
      paint();
    },
  };
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
