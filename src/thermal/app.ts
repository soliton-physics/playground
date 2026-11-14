import { choice, closePopover, iconButton, popover, slider, toast } from '../controls';
import { ThermalGas, thermal_catalogue } from '../engine';
import { icon } from '../icons';
import type { Shell } from '../shell';
import { clamp, cssVar, el, formatNumber, layoutPx } from '../ui';
import { openThermalGallery } from './gallery';
import { statisticalCatalogue } from './statistics';
import { drawPlot, type Curve } from './graphs';
import { GasStage, speciesToken, type GasFrame } from './stage';
import { MOLECULE_STRIDE, type GroupInfo, type NowInfo, type ThermalAnswer, type ThermalSceneFile, type ThermalSpec } from './types';

type Graph = 'speeds' | 'pv' | 'temperature' | 'sides';
const GRAPHS: { label: string; value: number; id: Graph }[] = [
  { label: 'Speeds', value: 0, id: 'speeds' },
  { label: 'P–V', value: 1, id: 'pv' },
  { label: 'T–time', value: 2, id: 'temperature' },
  { label: 'Left half', value: 3, id: 'sides' },
];
const BINS = 28;
/** Boltzmann's constant over one atomic mass unit, (m/s)² per kelvin. */
const K_PER_AMU = 8314.462618;

/** What a scene's walls are ever held at, for colouring them and for drawing isotherms. */
function bathsOf(scene: ThermalSceneFile): number[] {
  const out = new Set<number>();
  for (const stage of scene.stages) {
    if (stage.walls === 'insulated') continue;
    if ('bath' in stage.walls) out.add(stage.walls.bath);
    else {
      out.add(stage.walls.ends.left);
      out.add(stage.walls.ends.right);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** The frame the stage draws from a gas as it stands. */
export function gasFrame(gas: ThermalGas, scene: ThermalSceneFile, trail?: number[]): GasFrame {
  const baths = bathsOf(scene);
  return {
    molecules: gas.molecules(),
    size: gas.size(),
    longest: Math.max(scene.size[0], ...scene.stages.map((s) => s.piston_to ?? 0)),
    walls: gas.walls(),
    partition: gas.partition() ?? undefined,
    piston: gas.piston(),
    hasPiston: scene.stages.some((s) => s.piston_to !== undefined),
    coldest: baths[0] ?? 0,
    hottest: baths[baths.length - 1] ?? 0,
    trail,
  };
}

/** The gas scenarios of the thermal tab. */
export const thermalCatalogue = (): ThermalSpec[] => thermal_catalogue() as ThermalSpec[];

/** The thermal tab: a gas from the catalogue, stepped by the engine, with what it is doing read off beside it. */
export function mountThermal(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  const catalogue = thermalCatalogue();
  const canvas = el('canvas', { class: 'stage-canvas' });
  const description = el('p');
  const actions = el('div', { class: 'info-actions' });
  const info = el('section', { class: 'info glass overlay' }, [description, actions]);
  const answers = el('div', { class: 'answers overlay' });
  const notes = el('div', { class: 'stage-notes overlay' }, [answers]);
  const stageLabel = el('p', { class: 'thermal-stage glass overlay' });
  const readout = el('dl', { class: 'readout' });
  const plot = el('canvas', { class: 'thermal-plot' });
  const legend = el('p', { class: 'formula-note' });
  const graphPicker = el('div');
  const panel = el('aside', { class: 'wave-readout glass overlay' }, [el('h4', { class: 'panel-title', text: 'The gas now' }), readout, graphPicker, plot, legend]);
  const clock = el('output', { class: 'clock' });
  const play = iconButton('play', 'Play (Space)', () => toggle(), 'play');
  let speed = 1;
  const speedSlider = slider({ label: 'Speed', min: 0.1, max: 4, step: 0.1, value: speed, format: (v) => `×${formatNumber(v, 2)}`, onInput: (v) => (speed = v) });
  const speedChip = el('button', { type: 'button', class: 'speed-chip wide-only', title: 'Speed', text: 'Speed' });
  speedChip.addEventListener('click', () => popover(speedChip, el('div', { class: 'params' }, [speedSlider.root]), 'above'));
  const dock = el('div', { class: 'dock glass overlay' }, [iconButton('restart', 'Start again (R)', () => rebuild()), play, clock, speedChip]);
  main.append(canvas, info, notes, stageLabel, panel, dock);

  const stage = new GasStage(canvas);
  let spec = catalogue[0]!;
  let values: Record<string, number> = {};
  let gas: ThermalGas | undefined;
  let scene!: ThermalSceneFile;
  let groups: GroupInfo[] = [];
  let running = false;
  let graph: Graph = 'speeds';
  let fastest = 1000;
  /** The histogram of each kind, smoothed over the last second or so: a few hundred molecules are a noisy sample. */
  let smoothed: Float64Array[] = [];
  let trail: number[] = [];
  let lastPanel = 0;

  const current = (): Record<string, number> => Object.fromEntries(spec.params.map((p) => [p.name, values[p.name] ?? p.default]));

  function insets(): void {
    const wide = main.clientWidth >= 1180;
    const phone = main.clientWidth <= 700;
    stage.insets = embedded
      ? { left: 8, right: 8, top: 8, bottom: layoutPx(52) }
      : { left: wide ? layoutPx(344) : 16, right: phone ? 16 : panel.offsetWidth + 24, top: wide ? 16 : info.offsetHeight + 24, bottom: layoutPx(84) };
    // The name of the stage sits over the gas, not over the middle of the window.
    stageLabel.style.left = `${(stage.insets.left + main.clientWidth - stage.insets.right) / 2}px`;
  }

  function setRunning(next: boolean): void {
    running = next;
    play.replaceChildren(icon(running ? 'pause' : 'play', 20));
    play.title = running ? 'Pause (Space)' : 'Play (Space)';
  }

  /** Play or pause; play on a run that has ended starts it again. */
  function toggle(): void {
    if (!running && gas?.finished()) rebuild();
    setRunning(!running);
  }

  /** Fills the box afresh with the present numbers. A scene the engine refuses leaves the old one running. */
  function rebuild(): void {
    let next: ThermalGas;
    try {
      next = new ThermalGas(spec.id, current());
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
      return;
    }
    gas?.free();
    gas = next;
    scene = JSON.parse(gas.scene_json()) as ThermalSceneFile;
    groups = gas.groups() as GroupInfo[];
    // Wide enough for the fastest molecules of the lightest, hottest gas there will be.
    const hottest = Math.max(...scene.groups.map((g) => g.temperature), ...bathsOf(scene), 1);
    const lightest = Math.min(...groups.filter((g) => g.count > 1 || groups.length === 1).map((g) => g.mass));
    fastest = 3.4 * Math.sqrt((2 * K_PER_AMU * hottest * 1.6) / lightest);
    smoothed = [];
    trail = [];
    // A fresh gas waits for play, so that it can be looked at and talked about before anything moves.
    setRunning(false);
    link();
    refreshPanel(true);
  }

  function link(): void {
    if (embedded) return;
    let url = `?mode=thermal&scenario=${spec.id}`;
    for (const p of spec.params) if (values[p.name] !== undefined && values[p.name] !== p.default) url += `&${p.name}=${Number(values[p.name]!.toPrecision(6))}`;
    history.replaceState(null, '', url);
  }

  function renderAnswers(list: ThermalAnswer[]): void {
    answers.replaceChildren(
      ...list.map((answer) => {
        const parts = /^(.*?)\s*\(([^()]*)\)$/.exec(answer.name);
        const [name, unit] = parts ? [parts[1]!, parts[2]!] : [answer.name, ''];
        const nodes = [el('span', { class: 'name', text: name }), el('span', { class: 'value', text: `${formatNumber(answer.value)}${unit ? ` ${unit}` : ''}` })];
        if (answer.measured !== null && Number.isFinite(answer.measured)) {
          // An answer of zero is judged against the energy the gas holds, not against itself.
          const scale = answer.value === 0 ? 1000 : Math.abs(answer.value);
          const agrees = Math.abs(answer.measured - answer.value) <= answer.tolerance * scale;
          nodes.push(el('span', { class: agrees ? 'measured agrees' : 'measured', text: `${agrees ? '✓ ' : ''}measured ${formatNumber(answer.measured)}` }));
        }
        return el('div', { class: 'answer glass', title: 'The textbook value, and what the molecules give so far' }, nodes);
      }),
    );
  }

  function row(label: string, value: string): HTMLElement[] {
    return [el('dt', { text: label }), el('dd', { text: value })];
  }

  function refreshPanel(force = false): void {
    if (!gas) return;
    const now = gas.now() as NowInfo;
    const count = groups.reduce((sum, g) => sum + g.count, 0);
    const time = now.time >= 1000 ? `${formatNumber(now.time / 1000)} ns` : `${now.time.toFixed(0)} ps`;
    // An embedded gas has no side panel, so the two numbers that matter most ride with the clock.
    clock.textContent = embedded ? `t = ${time} · T = ${formatNumber(now.temperature)} K · P = ${formatNumber(now.pressure)} atm` : `t = ${time}`;
    stageLabel.textContent = gas.stage_count() > 1 ? gas.stage_label() : '';
    stageLabel.hidden = gas.stage_count() <= 1;
    renderAnswers(gas.answers() as ThermalAnswer[]);
    if (embedded) return;
    readout.replaceChildren(
      ...row('Molecules, N', String(count)),
      ...row('Temperature, T', `${formatNumber(now.temperature)} K`),
      ...row('Pressure, P', `${formatNumber(now.pressure)} atm`),
      ...row('NkT/V for comparison', `${formatNumber(gas.ideal_pressure())} atm`),
      ...row('Volume, V', `${formatNumber(now.volume)} nm³`),
      ...row('Internal energy, U', `${formatNumber(now.energy)} × 10⁻²¹ J`),
      ...row('Work done on the gas', `${formatNumber(now.work)} × 10⁻²¹ J`),
      ...row('Heat given to the gas', `${formatNumber(now.heat)} × 10⁻²¹ J`),
    );
    drawGraph(now, count, force);
  }

  function drawGraph(now: NowInfo, count: number, reset: boolean): void {
    if (!gas) return;
    const text = cssVar('--text');
    if (graph === 'speeds') {
      const centres = Float64Array.from({ length: BINS }, (_, i) => ((i + 0.5) * fastest) / BINS);
      const fine = Float64Array.from({ length: 80 }, (_, i) => (i * fastest) / 79);
      const curves: Curve[] = [];
      groups.forEach((group, species) => {
        // One molecule has a speed, not a distribution of them.
        if (group.count < 2) return;
        const fresh = gas!.speed_histogram(species, BINS, fastest);
        const kept = smoothed[species];
        smoothed[species] = !kept || reset ? Float64Array.from(fresh) : kept.map((v, i) => 0.85 * v + 0.15 * fresh[i]!);
        const color = cssVar(speciesToken(species));
        curves.push({ x: centres, y: smoothed[species]!, color, bars: true });
        curves.push({ x: fine, y: ThermalGas.maxwell(group.mass, now.temperature, 80, fastest), color, width: 2 });
      });
      drawPlot(plot, { xLabel: 'speed (m/s)', yLabel: 'share of molecules', curves, fromZero: true });
      legend.textContent = 'Bars: the molecules, counted by speed. Curve: Maxwell’s distribution at the present temperature.';
    } else if (graph === 'pv') {
      const [volume, pressure] = [gas.series('volume'), gas.series('pressure')];
      // The first few samples have too short a history to average the blows on the walls over.
      const from = Math.min(12, Math.max(0, volume.length - 1));
      const curves: Curve[] = [];
      const [low, high] = [Math.min(...volume), Math.max(...volume)];
      if (high > low * 1.01) {
        for (const bath of bathsOf(scene)) {
          const x = Float64Array.from({ length: 40 }, (_, i) => low + ((high - low) * i) / 39);
          // PV = NkT, in atmospheres and cubic nanometres.
          curves.push({ x, y: x.map((v) => (count * 1.380649e-23 * bath) / (v * 1e-27) / 101325), color: cssVar('--muted'), dashed: true, width: 1.25 });
        }
      }
      curves.push({ x: volume.subarray(from), y: pressure.subarray(from), color: cssVar('--accent'), width: 2 });
      drawPlot(plot, { xLabel: 'volume (nm³)', yLabel: 'pressure (atm)', curves, now: [now.volume, now.pressure] });
      legend.textContent = bathsOf(scene).length ? 'Dashed: PV = NkT at each temperature the walls are held at.' : 'The pressure is the blows on the walls over the last few picoseconds, so it wobbles.';
    } else if (graph === 'sides') {
      const time = gas.series('time');
      const curves: Curve[] = [{ x: [time[0] ?? 0, time[time.length - 1] ?? 1], y: [0.5, 0.5], color: cssVar('--muted'), dashed: true, width: 1.25 }];
      groups.forEach((group, species) => {
        if (group.count > 1) curves.push({ x: time, y: gas!.series_share(species), color: cssVar(speciesToken(species)), width: 2 });
      });
      drawPlot(plot, { xLabel: 'time (ps)', yLabel: 'share in the left half', curves, fromZero: true });
      legend.textContent = 'How much of each gas is in the left half of the box. Evenly spread is one half, the dashed line.';
    } else {
      const [time, temperature] = [gas.series('time'), gas.series('temperature')];
      drawPlot(plot, { xLabel: 'time (ps)', yLabel: 'temperature (K)', curves: [{ x: time, y: temperature, color: text, width: 2 }] });
      legend.textContent = 'Temperature is the mean kinetic energy of the molecules, so with only a few hundred of them it flickers.';
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
            // Refilling the box on every pixel of a drag would be wasted work.
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
    shell.setTitle(`Class ${spec.syllabus.class} · ${spec.syllabus.chapter}`, spec.title);
    description.textContent = spec.description;
    actions.replaceChildren(action('sliders', 'Parameters', openParameters), action('restart', 'Reset', () => show(spec)));
    graph = spec.syllabus.topic === 'irreversible processes' ? 'sides' : spec.syllabus.chapter === 'Thermodynamics' ? 'pv' : 'speeds';
    graphPicker.replaceChildren(choice('Graph', GRAPHS, GRAPHS.find((g) => g.id === graph)!.value, (v) => {
      graph = GRAPHS[v]!.id;
      refreshPanel(true);
    }));
    rebuild();
    insets();
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

  const openGallery = () => openThermalGallery(catalogue, statisticalCatalogue(), spec.id, (id) => show(catalogue.find((s) => s.id === id) ?? spec));
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
  new ResizeObserver(() => insets()).observe(main);

  let last = performance.now();
  function loop(now: number): void {
    const elapsed = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (gas) {
      if (running && !gas.finished()) {
        gas.advance(elapsed * gas.playback() * speed);
        // A lone heavy molecule is a grain to be followed.
        if (groups[0]?.count === 1) {
          const m = gas.molecules();
          for (let i = 0; i < m.length; i += MOLECULE_STRIDE) {
            if (m[i + 4] === 0) trail.push(m[i]!, m[i + 1]!);
          }
          if (trail.length > 6000) trail.splice(0, 2);
        }
        if (gas.finished()) setRunning(false);
      }
      stage.draw(gasFrame(gas, scene, trail.length ? trail : undefined));
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
