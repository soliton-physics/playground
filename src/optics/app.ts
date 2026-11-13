import { closePopover, popover, slider, toast } from '../controls';
import { OpticsBench, optics_catalogue } from '../engine';
import { icon } from '../icons';
import type { Shell } from '../shell';
import { clamp, el, formatNumber, formatSize, layoutPx } from '../ui';
import { frameOf, openOpticsGallery } from './gallery';
import { HANDLES, type Handle } from './handles';
import { BenchRenderer, type Knob } from './renderer';
import type { AnswerInfo, BenchFrame, OpticsSpec, OpticsView, Vec } from './types';

/** How close, in pixels, a press must be to a knob to take it. */
const KNOB_REACH = 18;

/** The optics bench: a scenario from the catalogue, its rays traced by the engine afresh whenever a number changes. */
export function mountOptics(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  const catalogue = optics_catalogue() as OpticsSpec[];
  const canvas = el('canvas', { class: 'stage-canvas' });
  const description = el('p');
  const actions = el('div', { class: 'info-actions' });
  const info = el('section', { class: 'info glass overlay' }, [description, actions]);
  const answers = el('div', { class: 'answers overlay' });
  const scaleChip = el('p', { class: 'scale-chip glass overlay', title: 'The scale of the bench at this zoom' });
  const notes = el('div', { class: 'stage-notes overlay' }, [answers, scaleChip]);
  main.append(canvas, info, notes);

  const renderer = new BenchRenderer(canvas);
  let spec = catalogue[0]!;
  let values: Record<string, number> = {};
  let bench: OpticsBench | undefined;
  let frame: BenchFrame = { elements: [], rays: [], objects: [], marks: [] };
  let held: Handle | undefined;
  let hovered: Handle | undefined;
  let pan: Vec | undefined;
  let dirty = true;

  const current = (): Record<string, number> => Object.fromEntries(spec.params.map((p) => [p.name, values[p.name] ?? p.default]));

  function insets(): void {
    const wide = main.clientWidth >= 1180;
    renderer.camera.insets = embedded
      ? { left: 8, right: 8, top: 8, bottom: 22 }
      : { left: wide ? layoutPx(344) : 16, right: 16, top: wide ? 16 : info.offsetHeight + 24, bottom: wide ? 28 : notes.offsetHeight + 28 };
  }

  function fit(): void {
    insets();
    const view = bench?.view() as OpticsView | undefined;
    if (view) {
      // A bench is framed with its axis in the middle of the free part of the stage.
      const camera = renderer.camera;
      const { left, right, top, bottom } = camera.insets;
      const [width, height] = [Math.max(80, canvas.clientWidth - left - right), Math.max(80, canvas.clientHeight - top - bottom)];
      camera.scale = Math.min(width / (2 * view.half_width), height / (2 * view.half_height));
      camera.centerX = view.center[0] - (left - right) / 2 / camera.scale;
      camera.centerY = view.center[1] + (top - bottom) / 2 / camera.scale;
    }
    dirty = true;
  }

  /** Traces the bench again with the present numbers. A scene the engine refuses leaves the old one standing. */
  function rebuild(refit: boolean): void {
    let next: OpticsBench;
    try {
      next = new OpticsBench(spec.id, current());
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
      return;
    }
    bench?.free();
    bench = next;
    frame = frameOf(bench);
    renderAnswers(bench.answers() as AnswerInfo[]);
    if (refit) fit();
    link();
    dirty = true;
  }

  function renderAnswers(list: AnswerInfo[]): void {
    answers.replaceChildren(
      ...list.map((answer) => {
        const yesNo = /^(.*)\?\s*\(1 = yes\)$/.exec(answer.name);
        if (yesNo) return el('div', { class: 'answer glass' }, [el('span', { class: 'name', text: `${yesNo[1]}?` }), el('span', { class: 'value', text: answer.value ? 'yes' : 'no' })]);
        const parts = /^(.*?)\s*\(([^()]*)\)$/.exec(answer.name);
        const [name, unit] = parts ? [parts[1]!, parts[2]!] : [answer.name, ''];
        const shown = Number.isFinite(answer.value) ? `${formatNumber(answer.value)}${unit ? ` ${unit}` : ''}` : 'at infinity';
        const nodes = [el('span', { class: 'name', text: name }), el('span', { class: 'value', text: shown })];
        if (answer.measured !== null && Number.isFinite(answer.measured)) {
          const agrees = Math.abs(answer.measured - answer.value) <= 0.01 * Math.max(Math.abs(answer.value), 1);
          nodes.push(el('span', { class: agrees ? 'measured agrees' : 'measured', text: `${agrees ? '✓ ' : ''}traced ${formatNumber(answer.measured)}` }));
        }
        return el('div', { class: 'answer glass', title: 'The textbook value, and what the traced rays give' }, nodes);
      }),
    );
  }

  function link(): void {
    if (embedded) return;
    let url = `?mode=optics&scenario=${spec.id}`;
    for (const p of spec.params) if (values[p.name] !== undefined && values[p.name] !== p.default) url += `&${p.name}=${Number(values[p.name]!.toPrecision(6))}`;
    history.replaceState(null, '', url);
  }

  function action(name: 'sliders' | 'restart' | 'fit', label: string, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
    const button = el('button', { type: 'button', class: 'text-button outlined' }, [icon(name, 16), label]);
    button.addEventListener('click', () => onClick(button));
    return button;
  }

  function openParameters(anchor: HTMLElement): void {
    const panel = el('div', { class: 'params' }, [el('h4', { text: 'Parameters' })]);
    for (const p of spec.params) {
      panel.append(
        slider({
          label: p.label,
          min: p.min,
          max: p.max,
          step: p.step,
          value: values[p.name] ?? p.default,
          format: (v) => `${formatNumber(v)}${p.unit ? ` ${p.unit}` : ''}`,
          onInput: (v) => {
            values[p.name] = v;
            rebuild(false);
          },
        }).root,
      );
    }
    popover(anchor, panel, 'below');
  }

  function show(next: OpticsSpec, chosen: Record<string, number> = {}): void {
    closePopover();
    spec = next;
    values = chosen;
    shell.setTitle(`Class ${spec.syllabus.class} · ${spec.syllabus.chapter}`, spec.title);
    description.textContent = spec.description;
    actions.replaceChildren(
      action('sliders', 'Parameters', openParameters),
      action('restart', 'Reset', () => show(spec)),
      action('fit', 'Fit', () => fit()),
    );
    rebuild(true);
  }

  // ---------------------------------------------------------------- pointer

  const local = (e: PointerEvent | WheelEvent): Vec => {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  const handles = (): Handle[] => HANDLES[spec.id] ?? [];
  const knobUnder = (e: PointerEvent): Handle | undefined => {
    const [px, py] = local(e);
    return handles().find((h) => {
      const [sx, sy] = renderer.camera.toScreen(...h.position(current()));
      return Math.hypot(sx - px, sy - py) < KNOB_REACH;
    });
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    held = knobUnder(e);
    if (!held) pan = local(e);
    canvas.classList.toggle('holding', true);
  });
  canvas.addEventListener('pointermove', (e) => {
    const at = local(e);
    if (held) {
      const asked = held.drag(renderer.camera.toWorld(...at), current());
      for (const [name, value] of Object.entries(asked)) {
        const p = spec.params.find((candidate) => candidate.name === name);
        if (p && Number.isFinite(value)) values[name] = clamp(Math.round(value / p.step) * p.step, p.min, p.max);
      }
      rebuild(false);
    } else if (pan) {
      renderer.camera.pan(at[0] - pan[0], at[1] - pan[1]);
      pan = at;
      dirty = true;
    } else {
      const over = knobUnder(e);
      if (over !== hovered) dirty = true;
      hovered = over;
      canvas.classList.toggle('over-body', over !== undefined);
    }
  });
  const letGo = () => {
    held = undefined;
    pan = undefined;
    canvas.classList.toggle('holding', false);
    dirty = true;
  };
  canvas.addEventListener('pointerup', letGo);
  canvas.addEventListener('pointercancel', letGo);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      renderer.camera.zoomAt(...local(e), Math.exp(-e.deltaY * 0.0015));
      dirty = true;
    },
    { passive: false },
  );

  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') {
      e.preventDefault();
      openGallery();
    } else if (e.key.toLowerCase() === 'f') fit();
  });

  const openGallery = () => openOpticsGallery(catalogue, spec.id, (id) => show(catalogue.find((s) => s.id === id) ?? spec));
  shell.onTitle(openGallery);
  shell.onShare(async () => {
    const url = new URL(location.href).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied. Anyone who opens it gets exactly this.');
    } catch {
      prompt('Copy this link', url);
    }
  });
  new ResizeObserver(() => fit()).observe(main);
  // The theme and the projector switch change every colour and size on the canvas.
  new MutationObserver(() => (dirty = true)).observe(document.documentElement, { attributes: true });

  function loop(): void {
    if (dirty) {
      dirty = false;
      const knobs: Knob[] = handles().map((h) => ({ at: h.position(current()), label: h.label(current()), active: h === held || h === hovered }));
      renderer.draw(frame, knobs);
      scaleChip.textContent = `1 square = ${formatSize(renderer.gridStep())}`;
    }
    requestAnimationFrame(loop);
  }

  const wanted = catalogue.find((s) => s.id === query.get('scenario')) ?? catalogue[0]!;
  const chosen: Record<string, number> = {};
  for (const p of wanted.params) {
    const given = query.get(p.name);
    if (given !== null && Number.isFinite(Number(given))) chosen[p.name] = clamp(Number(given), p.min, p.max);
  }
  show(wanted, chosen);
  requestAnimationFrame(loop);
}
