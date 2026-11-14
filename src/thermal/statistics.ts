import { choice, closePopover, iconButton, popover, slider, toast } from '../controls';
import { StatRun, statmech_catalogue } from '../engine';
import { icon } from '../icons';
import type { Shell } from '../shell';
import { clamp, cssVar, el, formatNumber, layoutPx, stageFont, stageScale } from '../ui';
import { openThermalGallery } from './gallery';
import { drawPlot, type Curve } from './graphs';
import type { ThermalSpec } from './types';

type Kind = 'ising' | 'sweep' | 'darts' | 'walk';

interface StatNow {
  steps: number;
  temperature: number;
  field: number;
  magnetisation: number;
  energy: number;
  mean_magnetisation: number;
  mean_energy: number;
  thrown: number;
  estimate: number;
  expected_error: number;
  rms_distance: number;
  root_steps: number;
}

interface StatAnswer {
  name: string;
  value: number;
  measured: number | null;
  within: number;
}

/** The statistical scenarios, which live in the thermal tab beside the gas. */
export const statisticalCatalogue = (): ThermalSpec[] => statmech_catalogue() as ThermalSpec[];

type Rgb = [number, number, number];

function rgbOf(color: string): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16)) as Rgb;
  const parts = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  return parts?.length === 3 ? (parts as Rgb) : [128, 128, 128];
}

/** Draws whichever model a run is: a lattice of spins, darts in a square, or a crowd of walkers. */
export function drawStatistics(canvas: HTMLCanvasElement, run: StatRun, insets: { left: number; right: number; top: number; bottom: number }, plain = false): void {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) {
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const k = stageScale();
  ctx.fillStyle = cssVar('--canvas-bg');
  ctx.fillRect(0, 0, rect.width, rect.height);
  const margin = plain ? 4 : 30 * k;
  const side = Math.max(40, Math.min(rect.width - insets.left - insets.right, rect.height - insets.top - insets.bottom) - 2 * margin);
  const x0 = insets.left + (rect.width - insets.left - insets.right - side) / 2;
  const y0 = insets.top + (rect.height - insets.top - insets.bottom - side) / 2;
  const kind = run.kind() as Kind;
  const edge = cssVar('--canvas-static-edge');

  if (kind === 'ising' || kind === 'sweep') {
    const n = run.size();
    const spins = run.spins();
    // One pixel a spin on a small canvas, then stretched without smoothing so that each stays a square.
    const small = document.createElement('canvas');
    small.width = n;
    small.height = n;
    const image = new ImageData(n, n);
    const [up, down] = [rgbOf(cssVar('--molecule-1')), rgbOf(cssVar('--surface'))];
    for (let i = 0; i < spins.length; i++) {
      const color = spins[i]! > 0 ? up : down;
      image.data.set([color[0], color[1], color[2], 255], 4 * i);
    }
    small.getContext('2d')!.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, x0, y0, side, side);
    ctx.imageSmoothingEnabled = true;
  } else if (kind === 'darts') {
    ctx.fillStyle = cssVar('--surface');
    ctx.fillRect(x0, y0, side, side);
    const darts = run.darts();
    const colors = [cssVar('--molecule-2'), cssVar('--molecule-1')];
    const r = (plain ? 1 : 1.8) * k;
    for (let i = 0; i < darts.length; i += 3) {
      ctx.fillStyle = colors[darts[i + 2]!]!;
      ctx.beginPath();
      ctx.arc(x0 + darts[i]! * side, y0 + side - darts[i + 1]! * side, r, 0, 2 * Math.PI);
      ctx.fill();
    }
    // The quarter circle of unit radius, centred on the bottom left corner.
    ctx.strokeStyle = cssVar('--text');
    ctx.lineWidth = (plain ? 1.5 : 2.5) * k;
    ctx.beginPath();
    ctx.arc(x0, y0 + side, side, -Math.PI / 2, 0);
    ctx.stroke();
  } else {
    ctx.fillStyle = cssVar('--surface');
    ctx.fillRect(x0, y0, side, side);
    const scene = JSON.parse(run.scene_json()) as { model: { walk: { steps: number } } };
    // Room for three times the distance they will have spread to by the end.
    const reach = 3.2 * Math.sqrt(scene.model.walk.steps);
    const scale = side / (2 * reach);
    const [cx, cy] = [x0 + side / 2, y0 + side / 2];
    const walkers = run.walkers();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, side, side);
    ctx.clip();
    ctx.fillStyle = cssVar('--molecule-1');
    ctx.globalAlpha = 0.5;
    const r = (plain ? 1 : 1.6) * k;
    for (let i = 0; i < walkers.length; i += 2) {
      ctx.beginPath();
      ctx.arc(cx + walkers[i]! * scale, cy - walkers[i + 1]! * scale, r, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // A circle at √N, the distance statistics says they should have reached.
    const now = run.now() as StatNow;
    ctx.strokeStyle = cssVar('--text');
    ctx.lineWidth = 2 * k;
    ctx.setLineDash([6 * k, 5 * k]);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(now.root_steps * scale, 0.5), 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cssVar('--molecule-2');
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5 * k, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = edge;
  ctx.lineWidth = (plain ? 1 : 2) * k;
  ctx.strokeRect(x0, y0, side, side);
  if (plain) return;
  const caption = { ising: 'teal: spin up · white: spin down', sweep: 'teal: spin up · white: spin down', darts: 'teal: inside the quarter circle · amber: outside', walk: 'dashed circle: √N steps from the start' }[kind];
  ctx.font = stageFont(12.5, 600);
  ctx.fillStyle = cssVar('--canvas-text');
  ctx.textAlign = 'left';
  ctx.fillText(caption, x0, y0 + side + 20 * k);
}

/** A statistical scenario in the thermal tab: a model run by chance, with its averages beside it. */
export function mountStatistics(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell, others: ThermalSpec[]): void {
  const catalogue = statisticalCatalogue();
  const canvas = el('canvas', { class: 'stage-canvas' });
  const description = el('p');
  const actions = el('div', { class: 'info-actions' });
  const info = el('section', { class: 'info glass overlay' }, [description, actions]);
  const answers = el('div', { class: 'answers overlay' });
  const notes = el('div', { class: 'stage-notes overlay' }, [answers]);
  const readout = el('dl', { class: 'readout circuit-readout' });
  const plot = el('canvas', { class: 'thermal-plot' });
  const legend = el('p', { class: 'formula-note' });
  const graphPicker = el('div');
  const panel = el('aside', { class: 'wave-readout glass overlay' }, [el('h4', { class: 'panel-title', text: 'So far' }), readout, graphPicker, plot, legend]);
  const clock = el('output', { class: 'clock' });
  const play = iconButton('play', 'Play (Space)', () => toggle(), 'play');
  let speed = 1;
  const speedSlider = slider({ label: 'Speed', min: 0.1, max: 8, step: 0.1, value: speed, format: (v) => `×${formatNumber(v, 2)}`, onInput: (v) => (speed = v) });
  const speedChip = el('button', { type: 'button', class: 'speed-chip wide-only', title: 'Speed', text: 'Speed' });
  speedChip.addEventListener('click', () => popover(speedChip, el('div', { class: 'params' }, [speedSlider.root]), 'above'));
  const dock = el('div', { class: 'dock glass overlay' }, [iconButton('restart', 'Start again (R)', () => rebuild()), play, clock, speedChip]);
  main.append(canvas, info, notes, panel, dock);

  let spec = catalogue[0]!;
  let values: Record<string, number> = {};
  let run: StatRun | undefined;
  let kind: Kind = 'ising';
  let running = false;
  let graph = 0;
  let owed = 0;
  let lastPanel = 0;
  let insets = { left: 16, right: 16, top: 16, bottom: 16 };

  const current = (): Record<string, number> => Object.fromEntries(spec.params.map((p) => [p.name, values[p.name] ?? p.default]));

  function layout(): void {
    const wide = main.clientWidth >= 1180;
    const phone = main.clientWidth <= 700;
    insets = embedded
      ? { left: 8, right: 8, top: 8, bottom: layoutPx(52) }
      : { left: wide ? layoutPx(344) : 16, right: phone ? 16 : panel.offsetWidth + 24, top: wide ? 16 : info.offsetHeight + 24, bottom: layoutPx(84) };
  }

  function setRunning(next: boolean): void {
    running = next;
    play.replaceChildren(icon(running ? 'pause' : 'play', 20));
    play.title = running ? 'Pause (Space)' : 'Play (Space)';
  }

  function toggle(): void {
    if (!running && run?.finished()) rebuild();
    setRunning(!running);
  }

  function rebuild(): void {
    let next: StatRun;
    try {
      next = new StatRun(spec.id, current());
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
      return;
    }
    run?.free();
    run = next;
    kind = run.kind() as Kind;
    owed = 0;
    setRunning(false);
    if (!embedded) {
      let url = `?mode=thermal&scenario=${spec.id}`;
      for (const p of spec.params) if (values[p.name] !== undefined && values[p.name] !== p.default) url += `&${p.name}=${Number(values[p.name]!.toPrecision(6))}`;
      history.replaceState(null, '', url);
    }
    refreshPanel();
  }

  function renderAnswers(list: StatAnswer[]): void {
    answers.replaceChildren(
      ...list.map((answer) => {
        const parts = /^(.*?)\s*\(([^()]*)\)$/.exec(answer.name);
        const [name, unit] = parts ? [parts[1]!, parts[2]!] : [answer.name, ''];
        const nodes = [el('span', { class: 'name', text: name }), el('span', { class: 'value', text: `${formatNumber(answer.value, 4)}${unit ? ` ${unit}` : ''}` })];
        if (answer.measured !== null && Number.isFinite(answer.measured)) {
          const agrees = Math.abs(answer.measured - answer.value) <= answer.within;
          nodes.push(el('span', { class: agrees ? 'measured agrees' : 'measured', text: `${agrees ? '✓ ' : ''}found ${formatNumber(answer.measured, 4)}` }));
        }
        return el('div', { class: 'answer glass', title: 'The exact value, and what the random trials have given so far' }, nodes);
      }),
    );
  }

  /** A count of things, which is a whole number however large. */
  const whole = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');

  const row = (label: string, value: string): HTMLElement[] => [el('dt', { text: label }), el('dd', { text: value })];

  /** One column of a flat array of rows `stride` wide. */
  const column = (flat: Float64Array, stride: number, which: number) => Float64Array.from({ length: flat.length / stride }, (_, i) => flat[i * stride + which]!);

  function refreshPanel(): void {
    if (!run) return;
    const now = run.now() as StatNow;
    const unit = { ising: 'sweeps', sweep: 'sweeps', darts: 'points', walk: 'steps' }[kind];
    clock.textContent = `${whole(kind === 'darts' ? now.thrown : now.steps)} ${unit}`;
    renderAnswers(run.answers() as StatAnswer[]);
    if (embedded) return;
    const rows =
      kind === 'darts'
        ? [...row('Points thrown, N', whole(now.thrown)), ...row('Estimate of π', formatNumber(now.estimate, 5)), ...row('Off by', formatNumber(Math.abs(now.estimate - Math.PI), 2)), ...row('Error to expect, 1.64/√N', formatNumber(now.expected_error, 2))]
        : kind === 'walk'
          ? [...row('Steps taken, N', whole(now.steps)), ...row('Root mean square distance', formatNumber(now.rms_distance)), ...row('√N', formatNumber(now.root_steps))]
          : [
              ...row('Temperature', `${formatNumber(now.temperature)} J/k`),
              ...row('Critical temperature', `${formatNumber(StatRun.critical_temperature())} J/k`),
              ...row('Magnetisation per spin, now', formatNumber(now.magnetisation)),
              ...row('Energy per spin, now', `${formatNumber(now.energy)} J`),
              ...row('Sweeps made', whole(now.steps)),
            ];
    readout.replaceChildren(...rows);
    drawGraph();
  }

  function drawGraph(): void {
    if (!run) return;
    const [teal, amber, muted] = [cssVar('--molecule-1'), cssVar('--molecule-2'), cssVar('--muted')];
    const history = run.history();
    const steps = column(history, 3, 0);
    if (kind === 'sweep') {
      const points = run.points();
      const t = column(points, 5, 0);
      const exact = StatRun.onsager(1.2, 3.6, 120);
      const exactT = column(exact, 3, 0);
      const critical = StatRun.critical_temperature();
      if (graph === 0) {
        const curves: Curve[] = [{ x: exactT, y: column(exact, 3, 1), color: muted, dashed: true, width: 1.5 }, { x: t, y: column(points, 5, 1), color: teal, width: 2.25 }];
        drawPlot(plot, { xLabel: 'temperature (J/k)', yLabel: 'magnetisation per spin', curves, fromZero: true, now: t.length ? [t[t.length - 1]!, points[points.length - 4]!] : undefined });
        legend.textContent = 'Teal: the lattice, cooling from the right. Dashed: Onsager’s exact result for an infinite lattice.';
      } else {
        const heat = column(points, 5, 3);
        const top = Math.max(1, ...heat);
        drawPlot(plot, { xLabel: 'temperature (J/k)', yLabel: 'specific heat per spin (k)', curves: [{ x: [critical, critical], y: [0, top], color: muted, dashed: true, width: 1.5 }, { x: t, y: heat, color: amber, width: 2.25 }], fromZero: true });
        legend.textContent = 'From how much the energy flickers at each temperature. Dashed: the critical temperature.';
      }
    } else if (kind === 'ising') {
      const curves: Curve[] = graph === 0 ? [{ x: steps, y: column(history, 3, 1), color: teal, width: 2 }] : [{ x: steps, y: column(history, 3, 2), color: amber, width: 2 }];
      drawPlot(plot, { xLabel: 'sweeps', yLabel: graph === 0 ? 'magnetisation per spin' : 'energy per spin (J)', curves });
      legend.textContent = 'Each sweep offers every spin, on average, one chance to flip.';
    } else if (kind === 'darts') {
      const [estimate, error] = [column(history, 3, 1), column(history, 3, 2)];
      // Left out until there are enough points for the estimate to be on the page.
      const from = Math.max(1, estimate.findIndex((e) => Math.abs(e - Math.PI) < 0.5));
      const n = steps.subarray(from);
      const band = (sign: number) => n.map((_, i) => Math.PI + sign * Math.min(error[from + i]!, 0.5));
      drawPlot(plot, {
        xLabel: 'points thrown',
        yLabel: 'estimate of π',
        curves: [
          { x: n, y: band(1), color: muted, dashed: true, width: 1.25 },
          { x: n, y: band(-1), color: muted, dashed: true, width: 1.25 },
          { x: n, y: estimate.subarray(from), color: teal, width: 2 },
        ],
      });
      legend.textContent = 'Dashed: π plus and minus the error to expect, which narrows as one over √N.';
    } else {
      drawPlot(plot, { xLabel: 'steps', yLabel: 'distance from the start', curves: [{ x: steps, y: column(history, 3, 2), color: muted, dashed: true, width: 1.5 }, { x: steps, y: column(history, 3, 1), color: teal, width: 2.25 }], fromZero: true });
      legend.textContent = 'Teal: root mean square distance of the walkers. Dashed: √N.';
    }
  }

  function action(name: 'sliders' | 'restart', label: string, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
    const button = el('button', { type: 'button', class: 'text-button outlined' }, [icon(name, 16), label]);
    button.addEventListener('click', () => onClick(button));
    return button;
  }

  let pending: number | undefined;
  function openParameters(anchor: HTMLElement): void {
    const box = el('div', { class: 'params' }, [el('h4', { text: 'Parameters' })]);
    for (const p of spec.params) {
      box.append(
        slider({
          label: p.label,
          min: p.min,
          max: p.max,
          step: p.step,
          value: values[p.name] ?? p.default,
          format: (v) => `${formatNumber(v)}${p.unit ? ` ${p.unit}` : ''}`,
          onInput: (v) => {
            values[p.name] = v;
            clearTimeout(pending);
            pending = window.setTimeout(rebuild, 120);
          },
        }).root,
      );
    }
    popover(anchor, box, 'below');
  }

  function show(next: ThermalSpec, chosen: Record<string, number> = {}): void {
    closePopover();
    spec = next;
    values = chosen;
    graph = 0;
    shell.setTitle(`Beyond the textbook · ${spec.syllabus.chapter}`, spec.title);
    description.textContent = spec.description;
    actions.replaceChildren(action('sliders', 'Parameters', openParameters), action('restart', 'Reset', () => show(spec)));
    rebuild();
    const options = kind === 'sweep' ? ['Magnetisation', 'Specific heat'] : kind === 'ising' ? ['Magnetisation', 'Energy'] : [];
    graphPicker.replaceChildren(
      ...(options.length
        ? [
            choice('Graph', options.map((label, value) => ({ label, value })), 0, (v) => {
              graph = v;
              drawGraph();
            }),
          ]
        : []),
    );
    layout();
  }

  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') {
      e.preventDefault();
      toggle();
    } else if (e.key.toLowerCase() === 'r') rebuild();
    else if (e.key === '/') {
      e.preventDefault();
      openGallery();
    }
  });

  const openGallery = () => openThermalGallery(others, catalogue, spec.id, (id) => show(catalogue.find((s) => s.id === id) ?? spec));
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
  new ResizeObserver(() => layout()).observe(main);

  let last = performance.now();
  function loop(now: number): void {
    const elapsed = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (run) {
      if (running && !run.finished()) {
        // Steps are whole; what is left over of a frame is carried to the next.
        owed += elapsed * run.playback() * speed;
        const whole = Math.floor(owed);
        owed -= whole;
        if (whole > 0) run.advance(whole);
        if (run.finished()) setRunning(false);
      }
      drawStatistics(canvas, run, insets);
      if (now - lastPanel > 200) {
        lastPanel = now;
        refreshPanel();
      }
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
