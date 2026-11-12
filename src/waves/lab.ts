import { choice, slider } from '../controls';
import { icon } from '../icons';
import { el, formatDuration, formatQuantity } from '../ui';
import type { Formula } from './formulas';
import type { Fact } from './lessons';
import { commonFrequency, commonWavelength, resultant, waveSpeed, type Component, type Sine } from './model';
import { partColor, type Resolved } from './scene';

/** A wave of the reader's own making: any number of sine waves and pulses on one line, added together. */
export interface Lab {
  length: number;
  parts: Component[];
  medium: 'string' | 'air';
  yUnit: string;
}

const STORE = 'soliton.wave-lab';
const MAX_PARTS = 5;

export const emptyLab = (): Lab => ({
  length: 12,
  medium: 'string',
  yUnit: 'm',
  parts: [
    { kind: 'sine', amplitude: 0.2, wavelength: 3, frequency: 1, phase: 0, direction: 1 },
    { kind: 'sine', amplitude: 0.1, wavelength: 1.5, frequency: 2, phase: 0, direction: 1 },
  ],
});

/** A lab holding the parts of something else, to take apart and add to. */
export const labFrom = (source: Resolved): Lab => ({
  length: source.domain[1] - source.domain[0],
  medium: source.medium,
  yUnit: source.yUnit,
  parts: source.parts.map((c) => (c.kind === 'pulse' ? { ...c, centre: c.centre - source.domain[0] } : { ...c })),
});

const isPart = (c: unknown): c is Component => {
  const part = c as Record<string, unknown>;
  const numbers = (keys: string[]) => keys.every((k) => Number.isFinite(part[k]));
  if (!part || (part.direction !== 1 && part.direction !== -1)) return false;
  if (part.kind === 'sine') return numbers(['amplitude', 'wavelength', 'frequency', 'phase']) && (part.wavelength as number) > 0 && (part.frequency as number) > 0;
  return part.kind === 'pulse' && numbers(['amplitude', 'width', 'centre', 'speed']) && (part.width as number) > 0 && (part.speed as number) > 0;
};

/** A lab from a link or from storage: anything not shaped like one is refused, since it came from outside. */
export function parseLab(text: string | null): Lab | undefined {
  if (!text) return undefined;
  try {
    const lab = JSON.parse(text) as Lab;
    if (!(lab.length > 0) || !Array.isArray(lab.parts) || !lab.parts.every(isPart)) return undefined;
    return { length: lab.length, parts: lab.parts.slice(0, MAX_PARTS), medium: lab.medium === 'air' ? 'air' : 'string', yUnit: ['µm', 'cm'].includes(lab.yUnit) ? lab.yUnit : 'm' };
  } catch {
    return undefined;
  }
}

export const encodeLab = (lab: Lab) => btoa(unescape(encodeURIComponent(JSON.stringify(lab)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function decodeLab(code: string | null): Lab | undefined {
  if (!code) return undefined;
  try {
    return parseLab(decodeURIComponent(escape(atob(code.replace(/-/g, '+').replace(/_/g, '/')))));
  } catch {
    return undefined;
  }
}

export function savedLab(): Lab | undefined {
  try {
    return parseLab(localStorage.getItem(STORE));
  } catch {
    return undefined;
  }
}

export function saveLab(lab: Lab): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(lab));
  } catch {
    /* private windows have no storage; the link still carries the lab */
  }
}

const FORMULAS: Formula[] = [
  { label: 'Principle of superposition', tex: String.raw`y(x,t) = \sum_i y_i(x,t)`, note: 'However many waves share the line, the displacement is the sum of what each would do alone.' },
  { label: 'Each sine wave', tex: String.raw`y_i = A_i \sin(k_i x \mp \omega_i t + \varphi_i)`, note: '− travels right, + travels left.' },
  { label: 'Same frequency, opposite ways', tex: String.raw`2A\,\sin kx\,\cos\omega t`, note: 'A standing wave.' },
  { label: 'Nearly the same frequency', tex: String.raw`f_\text{beat} = |f_1 - f_2|`, note: 'Beats.' },
];

function facts(lab: Lab): Fact[] {
  const rows: Fact[] = lab.parts.map((c, i) =>
    c.kind === 'sine'
      ? { label: `Wave ${i + 1}: speed, period`, value: `${formatQuantity(waveSpeed(c), 'm/s')}, ${formatDuration(1 / c.frequency)}` }
      : { label: `Pulse ${i + 1}: speed`, value: formatQuantity(c.speed, 'm/s') },
  );
  const sines = lab.parts.filter((c): c is Sine => c.kind === 'sine');
  if (sines.length > 1 && sines.length === lab.parts.length) {
    const sameWay = sines.every((c) => c.direction === sines[0]!.direction);
    if (commonFrequency(sines) !== undefined && commonWavelength(sines) !== undefined) {
      if (sameWay) rows.push({ label: 'Together: one wave of amplitude', value: formatQuantity(resultant(sines).amplitude, lab.yUnit) });
      else rows.push({ label: 'Together', value: 'a standing pattern' });
    } else if (sines.length === 2 && sameWay && Math.abs(sines[0]!.frequency - sines[1]!.frequency) < 0.25 * sines[0]!.frequency) rows.push({ label: 'Beat frequency, |f₁ − f₂|', value: formatQuantity(Math.abs(sines[0]!.frequency - sines[1]!.frequency), 'Hz') });
  }
  return rows;
}

export function resolveLab(lab: Lab): Resolved {
  return {
    id: 'wave-lab',
    group: 'Build your own',
    title: 'Wave lab',
    description: 'Your own mixture. Add sine waves and pulses, send them either way, and see what the line does when it has to do all of them at once. Share the link and it opens just as you left it.',
    domain: [0, lab.length],
    parts: lab.parts,
    height: Math.max(lab.parts.reduce((sum, c) => sum + Math.abs(c.amplitude), 0), lab.yUnit === 'm' ? 0.05 : 0.5),
    facts: facts(lab),
    marks: () => [],
    formulas: [{ title: 'Formulas', formulas: FORMULAS }],
    medium: lab.medium,
    yUnit: lab.yUnit,
    showParts: true,
  };
}

/** The controls for a lab: a card for each part, and buttons to add more. `changed` is called after every edit. */
export function labEditor(lab: Lab, changed: (rebuilt: boolean) => void): HTMLElement {
  const root = el('div', { class: 'lab' });
  const tall = lab.yUnit === 'm' ? 0.5 : lab.yUnit === 'cm' ? 2 : 20;
  const direction = (c: Component) =>
    choice('Travels', [{ label: 'to the right', value: 1 }, { label: 'to the left', value: -1 }], c.direction, (v) => {
      c.direction = v < 0 ? -1 : 1;
      changed(false);
    });
  const control = (label: string, unit: string, min: number, max: number, value: number, set: (v: number) => void, hardMin = min, stretch = 100) =>
    slider({ label, min, max, step: (max - min) / 200, value, hardMin, hardMax: max * stretch, format: (v) => formatQuantity(v, unit), onInput: (v) => (set(v), changed(false)) }).root;

  function render(): void {
    const cards = lab.parts.map((c, i) => {
      const remove = el('button', { type: 'button', class: 'icon-button small', title: 'Remove', 'aria-label': `Remove part ${i + 1}` }, [icon('close', 14)]);
      remove.addEventListener('click', () => {
        lab.parts.splice(i, 1);
        render();
        changed(true);
      });
      const swatch = el('span', { class: 'swatch' });
      swatch.style.background = partColor(i);
      const head = el('div', { class: 'lab-head' }, [swatch, el('b', { text: c.kind === 'sine' ? `Wave ${i + 1}` : `Pulse ${i + 1}` }), remove]);
      const controls =
        c.kind === 'sine'
          ? [
              control('Amplitude', lab.yUnit, 0, Math.max(tall, c.amplitude), c.amplitude, (v) => (c.amplitude = v), 0),
              control('Wavelength', 'm', lab.length / 60, Math.max(lab.length, c.wavelength), c.wavelength, (v) => (c.wavelength = v), lab.length / 600),
              control('Frequency', 'Hz', c.frequency / 5, c.frequency * 3, c.frequency, (v) => (c.frequency = v), c.frequency / 500),
              control('Starting phase', '°', 0, 360, (c.phase * 180) / Math.PI, (v) => (c.phase = (v * Math.PI) / 180), 0, 1),
            ]
          : [
              control('Height', lab.yUnit, -tall, tall, c.amplitude, (v) => (c.amplitude = v), -tall * 20, 20),
              control('Width', 'm', lab.length / 60, lab.length / 6, c.width, (v) => (c.width = v), lab.length / 600, 6),
              control('Starts at', 'm', 0, lab.length, c.centre, (v) => (c.centre = v), -lab.length, 2),
              control('Speed', 'm/s', c.speed / 5, c.speed * 3, c.speed, (v) => (c.speed = v), c.speed / 500),
            ];
      return el('div', { class: 'lab-card' }, [head, ...controls, direction(c)]);
    });
    const add = (label: string, make: () => Component) => {
      const button = el('button', { type: 'button', class: 'text-button outlined' }, [icon('plus', 16), label]);
      button.disabled = lab.parts.length >= MAX_PARTS;
      button.addEventListener('click', () => {
        lab.parts.push(make());
        render();
        changed(true);
      });
      return button;
    };
    const speed = lab.parts[0] ? waveSpeed(lab.parts[0]) : 2;
    root.replaceChildren(
      ...cards,
      el('div', { class: 'info-actions' }, [
        add('Sine wave', () => ({ kind: 'sine', amplitude: tall * 0.3, wavelength: lab.length / 5, frequency: speed / (lab.length / 5), phase: 0, direction: 1 })),
        add('Pulse', () => ({ kind: 'pulse', amplitude: tall * 0.5, width: lab.length / 20, centre: lab.length / 6, speed, direction: 1 })),
      ]),
    );
  }
  render();
  return root;
}
