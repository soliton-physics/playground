import { closePopover, iconButton, popover, slider, toast, toggleButton } from '../controls';
import { WaveSimulation } from '../engine';
import { icon } from '../icons';
import type { Shell } from '../shell';
import { cssVar, el, formatNumber } from '../ui';
import { LinePlot, type Series } from './line';
import { findPreset, presets, type Preset } from './presets';

/** One running wave and the conserved quantities it started with. */
class Session {
  readonly sim: WaveSimulation;
  readonly x: Float64Array;
  initial: Record<string, number>;
  running = true;

  constructor(readonly preset: Preset) {
    this.sim = new WaveSimulation(preset.model, preset.points, preset.length, preset.dt);
    this.x = this.sim.positions();
    preset.setup(this.sim, this.x);
    this.initial = { ...(this.sim.invariants() as Record<string, number>) };
  }

  series(): Series[] {
    const accent = cssVar('--accent');
    const fill = cssVar('--accent-soft');
    if (this.preset.model === 'kdv') return [{ values: this.sim.real(), color: accent, width: 2.5, fill }];
    return [
      { values: this.sim.real(), color: 'rgba(167, 139, 250, 0.6)', width: 1.25 },
      { values: this.sim.magnitude(), color: accent, width: 2.5, fill },
    ];
  }

  /** Replaces the field with a profile drawn by hand and takes its invariants as the new reference. */
  setProfile(u: Float64Array): void {
    this.sim.clear();
    this.sim.set_state(u, new Float64Array(u.length));
    this.initial = { ...(this.sim.invariants() as Record<string, number>) };
  }

  dispose(): void {
    this.sim.free();
  }
}

export function mountWaves(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  const canvas = el('canvas', { class: 'stage-canvas' });
  const description = el('p', { class: 'empty' });
  const readout = el('dl', { class: 'readout' });
  const clock = el('output', { class: 'clock' });
  const plot = new LinePlot(canvas);
  let session: Session | undefined;
  let stepsPerFrame = 20;
  let drawing = false;
  let sketch: Float64Array | undefined;

  const play = iconButton('pause', 'Pause (Space)', () => toggle(), 'play');
  const speed = slider({ label: 'Speed', min: 1, max: 200, step: 1, value: stepsPerFrame, format: (v) => `${v} steps a frame`, onInput: (v) => (stepsPerFrame = v) });
  const speedChip = el('button', { type: 'button', class: 'speed-chip wide-only', title: 'Speed', text: 'Speed' });
  speedChip.addEventListener('click', () => popover(speedChip, el('div', { class: 'params' }, [speed.root]), 'above'));
  const draw = toggleButton('pencil', 'Draw your own wave', false, (on) => {
    drawing = on;
    canvas.classList.toggle('placing', on);
    if (on && session) {
      session.running = false;
      refreshPlay();
      toast('Drag across the plot to draw a wave, then press play.');
    }
  });

  const dock = el('div', { class: 'dock glass overlay' }, [iconButton('restart', 'Start again (R)', () => session && start(session.preset)), play, clock, speedChip, el('span', { class: 'dock-divider' }), draw]);
  main.append(canvas, el('section', { class: 'wave-readout glass overlay' }, [description, el('h4', { class: 'panel-title', text: 'Conserved quantities' }), readout]), dock);

  function refreshPlay(): void {
    play.replaceChildren(icon(session?.running ? 'pause' : 'play', 20));
  }

  function toggle(): void {
    if (!session) return;
    session.running = !session.running;
    refreshPlay();
  }

  function start(preset: Preset): void {
    session?.dispose();
    session = new Session(preset);
    stepsPerFrame = preset.stepsPerFrame;
    speed.set(stepsPerFrame);
    description.textContent = preset.description;
    shell.setTitle(preset.model === 'kdv' ? 'Korteweg–de Vries' : 'Nonlinear Schrödinger', preset.title.replace(/^(KdV|NLS): /, ''));
    refreshPlay();
    if (!embedded) history.replaceState(null, '', `?mode=waves&preset=${preset.id}`);
  }

  shell.onTitle(() => {
    const menu = el('div', { class: 'menu' });
    for (const preset of presets) {
      const row = el('button', { type: 'button', text: preset.title });
      if (preset.id === session?.preset.id) row.setAttribute('aria-current', 'true');
      row.addEventListener('click', () => {
        closePopover();
        start(preset);
      });
      menu.append(row);
    }
    popover(document.querySelector<HTMLElement>('.title-button')!, menu, 'below');
  });
  shell.onShare(async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied.');
    } catch {
      prompt('Copy this link', location.href);
    }
  });

  // Drawing: each pointer position sets the field at the grid points it passes over.
  let previous: [number, number] | undefined;
  const stroke = (e: PointerEvent) => {
    if (!session || !sketch) return;
    const rect = canvas.getBoundingClientRect();
    const at = plot.toField(e.clientX - rect.left, e.clientY - rect.top);
    const from = previous ?? at;
    const [a, b] = from[0] <= at[0] ? [from, at] : [at, from];
    const x = session.x;
    const dx = x[1]! - x[0]!;
    const first = Math.max(0, Math.ceil((a[0] - x[0]!) / dx));
    const lastIndex = Math.min(x.length - 1, Math.floor((b[0] - x[0]!) / dx));
    for (let i = first; i <= lastIndex; i++) {
      const t = b[0] === a[0] ? 1 : (x[i]! - a[0]) / (b[0] - a[0]);
      sketch[i] = a[1] + t * (b[1] - a[1]);
    }
    previous = at;
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!drawing || !session) return;
    canvas.setPointerCapture(e.pointerId);
    sketch = new Float64Array(session.x.length);
    previous = undefined;
    stroke(e);
  });
  canvas.addEventListener('pointermove', (e) => sketch && stroke(e));
  canvas.addEventListener('pointerup', () => {
    if (!sketch || !session) return;
    // A hand-drawn line has corners the spectral solver would ring on; a few passes of smoothing round them off.
    let u = sketch;
    for (let pass = 0; pass < 12; pass++) {
      const next = new Float64Array(u.length);
      for (let i = 0; i < u.length; i++) next[i] = 0.25 * u[(i + u.length - 1) % u.length]! + 0.5 * u[i]! + 0.25 * u[(i + 1) % u.length]!;
      u = next;
    }
    session.setProfile(u);
    sketch = undefined;
  });

  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input:not([type=range]), select, textarea')) return;
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'r' || e.key === 'R') session && start(session.preset);
  });

  let lastReadout = 0;
  function loop(now: number): void {
    if (session) {
      if (session.running) session.sim.step(stepsPerFrame);
      const series = sketch ? [{ values: sketch, color: cssVar('--accent'), width: 2.5 }] : session.series();
      plot.draw(session.x, series, session.preset.range);
      clock.textContent = `t = ${session.sim.time().toFixed(2)}`;
      if (now - lastReadout > 250) {
        lastReadout = now;
        const rows = Object.entries(session.sim.invariants() as Record<string, number>).flatMap(([name, value]) => {
          const drift = Math.abs(value - session!.initial[name]!) / Math.max(Math.abs(session!.initial[name]!), 1);
          return [el('dt', { text: name }), el('dd', { title: `drift ${drift.toExponential(1)}`, text: `${formatNumber(value, 5)}  ±${drift.toExponential(0)}` })];
        });
        readout.replaceChildren(...rows);
      }
    }
    requestAnimationFrame(loop);
  }
  start(findPreset(query.get('preset')));
  requestAnimationFrame(loop);
}
