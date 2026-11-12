import { WaveSimulation } from '../engine';
import { icon } from '../icons';
import { cssVar, el } from '../ui';
import { resolveLab, type Lab } from './lab';
import { defaults, lessons } from './lessons';
import { sparkline } from './line';
import { presets, type Preset } from './presets';
import { CHAPTER, resolve, TextbookScene, type Resolved } from './scene';

export type WaveChoice = { lesson: string } | { preset: string } | { lab: 'new' | 'saved' };

/** A textbook wave a third of a cycle in, when it has had time to become what it is about. */
function drawTextbook(canvas: HTMLCanvasElement, spec: Resolved): void {
  const scene = new TextbookScene(spec);
  scene.advance(spec.duration === undefined ? 1 : (spec.duration / scene.pace) * 0.3, 1);
  sparkline(canvas, scene.series(spec.showParts).map(({ values, color, width }) => ({ values, color, width: Math.min(width, 2) })), scene.range[1]);
}

function drawSoliton(canvas: HTMLCanvasElement, preset: Preset): void {
  const sim = new WaveSimulation(preset.model, preset.points, preset.length, preset.dt);
  try {
    preset.setup(sim, sim.positions());
    const values = preset.model === 'kdv' ? sim.real() : sim.magnitude();
    sparkline(canvas, [{ values, color: cssVar('--accent'), width: 2 }], Math.max(Math.abs(preset.range[0]), Math.abs(preset.range[1])));
  } finally {
    sim.free();
  }
}

/** A searchable grid of every wave there is to open, the class 11 chapter first. */
export function openWaveGallery(current: string, saved: Lab | undefined, choose: (choice: WaveChoice) => void): void {
  const search = el('input', { type: 'search', placeholder: 'Search waves: standing, beats, reflection, soliton…', 'aria-label': 'Search waves' });
  const list = el('div', { class: 'gallery-list' });
  const panel = el('div', { class: 'gallery glass', role: 'dialog', 'aria-label': 'Waves' }, [el('div', { class: 'gallery-search' }, [icon('search'), search]), list]);
  const backdrop = el('div', { class: 'gallery-backdrop' }, [panel]);

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') (list.querySelector('.gallery-card') as HTMLButtonElement | null)?.click();
  };

  function card(id: string, title: string, text: string, choice: WaveChoice, draw: (canvas: HTMLCanvasElement) => void): HTMLButtonElement {
    const canvas = el('canvas');
    const button = el('button', { type: 'button', class: 'gallery-card' }, [canvas, el('span', { class: 'caption' }, [el('b', { text: title }), el('small', { text })])]);
    if (id === current) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => {
      close();
      choose(choice);
    });
    requestAnimationFrame(() => draw(canvas));
    return button;
  }

  function render(): void {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (...text: string[]) => words.every((w) => text.join(' ').toLowerCase().includes(w));
    const groups: [string, HTMLButtonElement[]][] = [
      [CHAPTER, lessons.filter((l) => matches(l.title, l.description, CHAPTER)).map((l) => card(l.id, l.title, l.description, { lesson: l.id }, (c) => drawTextbook(c, resolve(l, defaults(l)))))],
      [
        'Build your own',
        [
          ...(matches('wave lab build your own remix superposition') ? [card('wave-lab', 'Wave lab', 'Add sine waves and pulses of your own and watch them combine.', { lab: 'new' }, (c) => drawTextbook(c, resolveLab({ length: 12, medium: 'string', yUnit: 'm', parts: [{ kind: 'sine', amplitude: 0.2, wavelength: 3, frequency: 1, phase: 0, direction: 1 }, { kind: 'sine', amplitude: 0.1, wavelength: 1.5, frequency: 2, phase: 0, direction: 1 }] })))] : []),
          ...(saved && matches('your wave lab saved') ? [card('', 'Your wave lab', 'Carry on with the mixture you were building.', { lab: 'saved' }, (c) => drawTextbook(c, resolveLab(saved)))] : []),
        ],
      ],
      ['Beyond the textbook · Solitons', presets.filter((p) => matches(p.title, p.description, 'soliton')).map((p) => card(p.id, p.title, p.description, { preset: p.id }, (c) => drawSoliton(c, p)))],
    ];
    list.replaceChildren();
    for (const [title, cards] of groups) if (cards.length) list.append(el('h4', { text: title }), el('div', { class: 'gallery-grid' }, cards));
    if (!list.children.length) list.append(el('p', { class: 'empty', text: 'Nothing matches that. Try a single word, like “standing” or “beats”.' }));
  }

  search.addEventListener('input', render);
  backdrop.addEventListener('pointerdown', (e) => e.target === backdrop && close());
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  render();
  search.focus();
}
