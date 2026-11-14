import { choice, closePopover, iconButton, popover, slider, toast } from '../controls';
import { CircuitBench, circuits_catalogue } from '../engine';
import { icon } from '../icons';
import type { Shell } from '../shell';
import { drawPlot, type Curve } from '../thermal/graphs';
import { clamp, cssVar, el, formatNumber, formatPrefixed, layoutPx, stageScale } from '../ui';
import { openCircuitGallery } from './gallery';
import { Schematic } from './schematic';
import { kindOf, type Analysis, type CircuitAnswer, type CircuitSceneFile, type CircuitSpec, type Vec } from './types';

/** How close, in pixels, a press must be to the jockey to take it. */
const KNOB_REACH = 22;
/** The colours of the curves on a graph, in order. */
const CURVES = ['--molecule-1', '--molecule-2', '--molecule-3', '--molecule-4'];
/** Scenarios with a contact that slides along a wire ten units long on the page, set by `jockey` in centimetres. */
const JOCKEYS = new Set(['meter-bridge', 'potentiometer']);

/** The circuits tab: a circuit from the catalogue, solved by the engine from Kirchhoff's laws. */
export function mountCircuits(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  const catalogue = circuits_catalogue() as CircuitSpec[];
  const canvas = el('canvas', { class: 'stage-canvas' });
  const description = el('p');
  const actions = el('div', { class: 'info-actions' });
  const info = el('section', { class: 'info glass overlay' }, [description, actions]);
  const answers = el('div', { class: 'answers overlay' });
  const notes = el('div', { class: 'stage-notes overlay' }, [answers]);
  const table = el('dl', { class: 'readout circuit-readout' });
  const plot = el('canvas', { class: 'thermal-plot' });
  const legend = el('p', { class: 'formula-note' });
  const graphPicker = el('div');
  const panel = el('aside', { class: 'wave-readout glass overlay' }, [el('h4', { class: 'panel-title', text: 'Each component now' }), table, graphPicker, plot, legend]);
  const clock = el('output', { class: 'clock' });
  const play = iconButton('play', 'Play (Space)', () => toggle(), 'play');
  let speed = 1;
  const speedSlider = slider({ label: 'Speed', min: 0.1, max: 4, step: 0.1, value: speed, format: (v) => `×${formatNumber(v, 2)}`, onInput: (v) => (speed = v) });
  const speedChip = el('button', { type: 'button', class: 'speed-chip wide-only', title: 'Speed', text: 'Speed' });
  speedChip.addEventListener('click', () => popover(speedChip, el('div', { class: 'params' }, [speedSlider.root]), 'above'));
  const dock = el('div', { class: 'dock glass overlay' }, [iconButton('restart', 'Start again (R)', () => rebuild(false)), play, clock, speedChip]);
  main.append(canvas, info, notes, panel, dock);

  const schematic = new Schematic(canvas);
  let spec = catalogue[0]!;
  let values: Record<string, number> = {};
  let bench: CircuitBench | undefined;
  let scene!: CircuitSceneFile;
  let analysis: Analysis = 'steady';
  let running = false;
  let graph = 0;
  let drift = new Float64Array(0);
  let largest = 1;
  let holding = false;
  let hovering = false;
  let lastPanel = 0;

  const current = (): Record<string, number> => Object.fromEntries(spec.params.map((p) => [p.name, values[p.name] ?? p.default]));
  const jockeyAt = (): Vec | undefined => (JOCKEYS.has(spec.id) ? [current().jockey! / 10, 0] : undefined);

  function insets(): void {
    const wide = main.clientWidth >= 1180;
    const phone = main.clientWidth <= 700;
    schematic.insets = embedded
      ? { left: 8, right: 8, top: 8, bottom: layoutPx(52) }
      : { left: wide ? layoutPx(344) : 16, right: phone ? 16 : panel.offsetWidth + 24, top: wide ? 16 : info.offsetHeight + 24, bottom: layoutPx(84) };
  }

  function setRunning(next: boolean): void {
    running = next;
    play.replaceChildren(icon(running ? 'pause' : 'play', 20));
    play.title = running ? 'Pause (Space)' : 'Play (Space)';
  }

  /** Play or pause; play on a run that has ended starts it again. */
  function toggle(): void {
    if (!running && bench?.finished()) rebuild(false);
    setRunning(!running);
  }

  /** Solves the circuit afresh with the present numbers. One the engine refuses leaves the old one standing. */
  function rebuild(keepRunning: boolean): void {
    let next: CircuitBench;
    try {
      next = new CircuitBench(spec.id, current());
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
      return;
    }
    bench?.free();
    bench = next;
    scene = JSON.parse(bench.scene_json()) as CircuitSceneFile;
    analysis = bench.analysis() as Analysis;
    if (drift.length !== scene.elements.length) drift = new Float64Array(scene.elements.length);
    // The charges drift at a pace set against the largest current there will be, so that the eye can compare.
    const phasors = bench.phasors();
    largest = 1e-12;
    const readings = bench.readings();
    for (let i = 0; i < scene.elements.length; i++) largest = Math.max(largest, Math.abs(readings[2 * i + 1]!), phasors.length ? Math.hypot(phasors[4 * i + 2]!, phasors[4 * i + 3]!) : 0);
    // A steady circuit goes on being steady while a slider is moved; one followed in time starts over.
    if (!keepRunning || analysis === 'transient') setRunning(false);
    link();
    refreshPanel();
  }

  function link(): void {
    if (embedded) return;
    let url = `?mode=circuits&scenario=${spec.id}`;
    for (const p of spec.params) if (values[p.name] !== undefined && values[p.name] !== p.default) url += `&${p.name}=${Number(values[p.name]!.toPrecision(6))}`;
    history.replaceState(null, '', url);
  }

  function renderAnswers(list: CircuitAnswer[]): void {
    answers.replaceChildren(
      ...list.map((answer) => {
        const yesNo = /^(.*)\?\s*\(1 = yes\)$/.exec(answer.name);
        if (yesNo) return el('div', { class: 'answer glass' }, [el('span', { class: 'name', text: `${yesNo[1]}?` }), el('span', { class: 'value', text: answer.value ? 'yes' : 'no' })]);
        const parts = /^(.*?)\s*\(([^()]*)\)$/.exec(answer.name);
        const [name, unit] = parts ? [parts[1]!, parts[2]!] : [answer.name, ''];
        const nodes = [el('span', { class: 'name', text: name }), el('span', { class: 'value', text: `${formatNumber(answer.value)}${unit ? ` ${unit}` : ''}` })];
        if (answer.measured !== null && Number.isFinite(answer.measured)) {
          const agrees = Math.abs(answer.measured - answer.value) <= 0.01 * Math.max(Math.abs(answer.value), 1e-3);
          nodes.push(el('span', { class: agrees ? 'measured agrees' : 'measured', text: `${agrees ? '✓ ' : ''}solved ${formatNumber(answer.measured)}` }));
        }
        return el('div', { class: 'answer glass', title: 'The textbook value, and what Kirchhoff’s laws give' }, nodes);
      }),
    );
  }

  const cycleTime = (): string => {
    const t = bench!.time();
    return t < 1 ? `${formatNumber(t * 1000)} ms` : `${formatNumber(t)} s`;
  };

  function refreshPanel(): void {
    if (!bench) return;
    clock.textContent = analysis === 'steady' ? 'steady' : `t = ${cycleTime()}`;
    renderAnswers(bench.answers() as CircuitAnswer[]);
    if (embedded) return;
    const readings = bench.readings();
    const rows: HTMLElement[] = [];
    scene.elements.forEach((element, i) => {
      if (kindOf(element.kind) === 'wire') return;
      rows.push(el('dt', { text: element.name }), el('dd', { text: `${formatPrefixed(readings[2 * i]!, 'V')} · ${formatPrefixed(readings[2 * i + 1]!, 'A')}` }));
    });
    table.replaceChildren(...rows);
    drawGraph();
  }

  /** The components worth graphing: those the scene names, by their place in its list. */
  const watched = (): number[] => (scene.watch ?? []).map((name) => scene.elements.findIndex((e) => e.name === name)).filter((i) => i >= 0);

  function drawGraph(): void {
    if (!bench) return;
    const show = analysis !== 'steady';
    plot.hidden = !show;
    graphPicker.hidden = !show;
    legend.hidden = !show;
    if (!show) return;
    const names = watched().map((i) => scene.elements[i]!.name);
    if (analysis === 'transient') {
      const time = bench.series_time();
      const quantity = graph === 0 ? 'voltage' : 'current';
      const curves: Curve[] = watched().map((i, k) => ({ x: time, y: bench!.series(i, quantity), color: cssVar(CURVES[k % CURVES.length]!), width: 2 }));
      drawPlot(plot, { xLabel: 'time (s)', yLabel: graph === 0 ? 'voltage (V)' : 'current (A)', curves, fromZero: true });
      legend.textContent = names.map((name, k) => `${name}: ${['teal', 'amber', 'violet', 'rose'][k % 4]}`).join(' · ');
    } else if (graph === 0) {
      // Two cycles of each watched quantity, each as a share of its own peak, so that the lag between them shows.
      const phasors = bench.phasors();
      const turn = 2 * Math.PI * bench.frequency();
      const [i0, i1] = watched();
      if (i0 === undefined || i1 === undefined) return;
      const [vr, vi, cr, ci] = [phasors[4 * i0]!, phasors[4 * i0 + 1]!, phasors[4 * i1 + 2]!, phasors[4 * i1 + 3]!];
      const period = 1 / bench.frequency();
      const from = bench.time();
      const x = Float64Array.from({ length: 200 }, (_, k) => ((k / 199) * 2 * period) * 1000);
      const wave = (re: number, im: number) => x.map((ms) => Math.sin(turn * (from + ms / 1000) + Math.atan2(im, re)));
      drawPlot(plot, {
        xLabel: 'time from now (ms)',
        yLabel: 'share of its peak',
        curves: [
          { x, y: wave(vr, vi), color: cssVar(CURVES[0]!), width: 2 },
          { x, y: wave(cr, ci), color: cssVar(CURVES[1]!), width: 2 },
        ],
      });
      legend.textContent = 'Teal: voltage of the source. Amber: current. Each is drawn against its own peak.';
    } else {
      drawPhasors();
      legend.textContent = 'Each arrow turns once a cycle; what the quantity is at this moment is how high its tip stands.';
    }
  }

  /** The voltages across the parts of an alternating circuit and its current, as arrows turning together. */
  function drawPhasors(): void {
    if (!bench) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = plot.getBoundingClientRect();
    if (rect.width === 0) return;
    plot.width = Math.round(rect.width * ratio);
    plot.height = Math.round(rect.height * ratio);
    const ctx = plot.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const phasors = bench.phasors();
    const angle = 2 * Math.PI * bench.frequency() * bench.time();
    const [cx, cy] = [rect.width / 2, rect.height / 2];
    const reach = Math.min(cx, cy) - 16;
    const arrows: { re: number; im: number; label: string; color: string }[] = [];
    let voltage = 1e-12;
    let currentPeak = 1e-12;
    scene.elements.forEach((element, i) => {
      const kind = kindOf(element.kind);
      if (!['source', 'resistor', 'inductor', 'capacitor'].includes(kind)) return;
      voltage = Math.max(voltage, Math.hypot(phasors[4 * i]!, phasors[4 * i + 1]!));
      arrows.push({ re: phasors[4 * i]!, im: phasors[4 * i + 1]!, label: kind === 'source' ? 'V' : `V(${element.name})`, color: CURVES[arrows.length % CURVES.length]! });
    });
    const meter = scene.elements.findIndex((e) => kindOf(e.kind) === 'ammeter');
    if (meter >= 0) currentPeak = Math.hypot(phasors[4 * meter + 2]!, phasors[4 * meter + 3]!);
    ctx.strokeStyle = cssVar('--canvas-grid-major');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - reach, cy);
    ctx.lineTo(cx + reach, cy);
    ctx.moveTo(cx, cy - reach);
    ctx.lineTo(cx, cy + reach);
    ctx.stroke();
    const arrow = (re: number, im: number, scale: number, color: string, label: string, dashed: boolean) => {
      // Turned through ωt, and drawn with the imaginary part upward.
      const [x, y] = [re * Math.cos(angle) - im * Math.sin(angle), re * Math.sin(angle) + im * Math.cos(angle)];
      const [tx, ty] = [cx + x * scale, cy - y * scale];
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.25;
      ctx.setLineDash(dashed ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(tx, ty, 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = '600 12px Inter, ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = tx >= cx ? 'left' : 'right';
      ctx.fillText(label, tx + (tx >= cx ? 6 : -6), ty - 5);
    };
    for (const a of arrows) arrow(a.re, a.im, reach / voltage, cssVar(a.color), a.label, false);
    if (meter >= 0) arrow(phasors[4 * meter + 2]!, phasors[4 * meter + 3]!, (0.7 * reach) / currentPeak, cssVar('--text'), 'I', true);
  }

  function action(name: 'sliders' | 'restart', label: string, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
    const button = el('button', { type: 'button', class: 'text-button outlined' }, [icon(name, 16), label]);
    button.addEventListener('click', () => onClick(button));
    return button;
  }

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
            rebuild(true);
          },
        }).root,
      );
    }
    popover(anchor, box, 'below');
  }

  function show(next: CircuitSpec, chosen: Record<string, number> = {}): void {
    closePopover();
    spec = next;
    values = chosen;
    graph = 0;
    shell.setTitle(`Class ${spec.syllabus.class} · ${spec.syllabus.chapter}`, spec.title);
    description.textContent = spec.description;
    actions.replaceChildren(action('sliders', 'Parameters', openParameters), action('restart', 'Reset', () => show(spec)));
    rebuild(false);
    const options = analysis === 'alternating' ? ['Waves', 'Phasors'] : ['Voltage', 'Current'];
    graphPicker.replaceChildren(
      choice('Graph', options.map((label, value) => ({ label, value })), 0, (v) => {
        graph = v;
        drawGraph();
      }),
    );
    insets();
  }

  // ---------------------------------------------------------------- the sliding contact

  const local = (e: PointerEvent): Vec => {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  const overJockey = (e: PointerEvent): boolean => {
    const at = jockeyAt();
    if (!at) return false;
    const [sx, sy] = schematic.toScreen(at);
    const [px, py] = local(e);
    return Math.hypot(sx - px, sy - 8 - py) < KNOB_REACH;
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!overJockey(e)) return;
    canvas.setPointerCapture(e.pointerId);
    holding = true;
    canvas.classList.add('holding');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (holding) {
      const p = spec.params.find((candidate) => candidate.name === 'jockey')!;
      // The wire is ten units long on the page and a hundred centimetres on the bench.
      values.jockey = clamp(Math.round((schematic.toPage(local(e))[0] * 10) / p.step) * p.step, p.min, p.max);
      rebuild(true);
    } else {
      hovering = overJockey(e);
      canvas.classList.toggle('over-body', hovering);
    }
  });
  const letGo = () => {
    holding = false;
    canvas.classList.remove('holding');
  };
  canvas.addEventListener('pointerup', letGo);
  canvas.addEventListener('pointercancel', letGo);

  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') {
      e.preventDefault();
      toggle();
    } else if (e.key.toLowerCase() === 'r') rebuild(false);
    else if (e.key === '/') {
      e.preventDefault();
      openGallery();
    }
  });

  const openGallery = () => openCircuitGallery(catalogue, spec.id, (id) => show(catalogue.find((s) => s.id === id) ?? spec));
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
    if (bench) {
      if (running && !bench.finished()) {
        try {
          bench.advance(elapsed * bench.playback() * speed);
        } catch (error) {
          toast(error instanceof Error ? error.message : String(error), 'error');
          setRunning(false);
        }
        const readings = bench.readings();
        // The largest current drifts at about a hundred pixels a second.
        for (let i = 0; i < drift.length; i++) drift[i]! += (readings[2 * i + 1]! / largest) * 100 * stageScale() * elapsed * speed;
        if (bench.finished()) setRunning(false);
      }
      const at = jockeyAt();
      schematic.draw({ scene, readings: bench.readings(), drift, jockey: at ? { at, active: holding || hovering } : undefined });
      if (now - lastPanel > 150) {
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
