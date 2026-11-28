import { choice, closePopover, iconButton, popover, slider, toast } from '../controls';
import { CircuitBench, circuits_catalogue } from '../engine';
import { icon } from '../icons';
import type { Shell } from '../shell';
import { drawPlot, type Curve } from '../thermal/graphs';
import { clamp, cssVar, el, formatNumber, formatPrefixed, layoutPx, stageScale, typedLimits } from '../ui';
import { encodeScene, sceneFromUrl } from '../mechanics/share';
import { diagnose } from './diagnose';
import { CircuitEditor, starter } from './editor';
import { openCircuitGallery } from './gallery';
import { Schematic } from './schematic';
import { kindOf, type Analysis, type CircuitAnswer, type CircuitSceneFile, type CircuitSpec, type Vec } from './types';

/** How close, in pixels, a press must be to the jockey to take it. */
const KNOB_REACH = 22;
/** The colours of the curves on a graph, in order. */
const CURVES = ['--molecule-1', '--molecule-2', '--molecule-3', '--molecule-4'];
/** Scenarios with a contact that slides along a wire ten units long on the page, set by `jockey` in centimetres. */
const JOCKEYS = new Set(['meter-bridge', 'potentiometer']);

const SAVE_KEY = 'soliton-circuit';

/** The circuits tab: a circuit from the catalogue, solved by the engine from Kirchhoff's laws. */
export function mountCircuits(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  const catalogue = circuits_catalogue() as CircuitSpec[];
  const canvas = el('canvas', { class: 'stage-canvas' });
  const description = el('p');
  const actions = el('div', { class: 'info-actions' });
  const info = el('section', { class: 'info glass overlay' }, [description, actions]);
  const answers = el('div', { class: 'answers overlay' });
  const notes = el('div', { class: 'stage-notes overlay' }, [answers]);
  const hint = el('div', { class: 'hint hint-beside-rail glass overlay', hidden: true });
  const properties = el('div');
  const table = el('dl', { class: 'readout circuit-readout' });
  const plot = el('canvas', { class: 'thermal-plot' });
  const legend = el('p', { class: 'formula-note' });
  // What the moving dots are, and what play does: nothing on the page says so otherwise.
  const about = el('p', { class: 'formula-note about-dots' });
  const graphPicker = el('div');
  const tableTitle = el('h4', { class: 'panel-title', text: 'Each component now' });
  // On a narrow screen the readings are a sheet along the bottom that folds down to this bar, so the circuit shows.
  const sheetToggle = el('button', { type: 'button', class: 'sheet-toggle', 'aria-expanded': 'true' }, [el('span', { text: 'Readings and graph' }), icon('chevron', 16)]);
  const panel = el('aside', { class: 'wave-readout circuit-readout glass overlay' }, [sheetToggle, properties, tableTitle, table, graphPicker, plot, legend, about]);
  const fold = (folded: boolean) => {
    panel.classList.toggle('folded', folded);
    sheetToggle.setAttribute('aria-expanded', String(!folded));
  };
  sheetToggle.addEventListener('click', () => fold(!panel.classList.contains('folded')));
  // A phone starts with the circuit in view and the readings folded away.
  fold(main.clientWidth <= 700);
  const clock = el('output', { class: 'clock' });
  const play = iconButton('play', 'Play (Space)', () => toggle(), 'play');
  let speed = 1;
  const speedSlider = slider({ label: 'Speed', min: 0.1, max: 4, step: 0.1, value: speed, format: (v) => `×${formatNumber(v, 2)}`, onInput: (v) => (speed = v) });
  const speedChip = el('button', { type: 'button', class: 'speed-chip wide-only', title: 'Speed', text: 'Speed' });
  speedChip.addEventListener('click', () => popover(speedChip, el('div', { class: 'params' }, [speedSlider.root]), 'above'));
  const dock = el('div', { class: 'dock glass overlay' }, [iconButton('restart', 'Start again (R)', () => rebuild(false)), play, clock, speedChip, iconButton('fit', 'Fit the circuit (F)', () => fitView())]);
  main.append(canvas, info, hint, notes, panel, dock);

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
  /** Building a circuit of one's own, and why the engine cannot solve it as it stands, if it cannot. */
  let sandbox = false;
  let problem = '';
  /** The parts that make the circuit unsolvable, to highlight, and whether there is a fault at all (not just an empty board). */
  let culprits: number[] = [];
  let fault = false;
  let pickerFor = '';

  const editor = new CircuitEditor(
    () => {
      rebuild(true);
      try {
        localStorage.setItem(SAVE_KEY, editor.json());
      } catch {
        /* storage unavailable */
      }
    },
    () => refreshProperties(),
    (text) => (hint.textContent = text),
  );
  editor.rail.hidden = true;
  main.append(editor.rail);

  const current = (): Record<string, number> => Object.fromEntries(spec.params.map((p) => [p.name, values[p.name] ?? p.default]));
  const jockeyAt = (): Vec | undefined => (JOCKEYS.has(spec.id) ? [current().jockey! / 10, 0] : undefined);

  /**
   * The part of the stage the panels leave free, measured from where they are: beside the circuit on a wide screen,
   * and on a narrow one the readings sheet along the bottom and the tools along the top.
   */
  function insets(): void {
    const width = main.clientWidth;
    const [wide, narrow, phone] = [width >= 1180, width <= 900, width <= 700];
    const box = main.getBoundingClientRect();
    const dock = layoutPx(84);
    // From the foot of the stage up to the top of a panel that sits along the bottom.
    const under = (e: HTMLElement) => (e.hidden ? 0 : box.bottom - e.getBoundingClientRect().top + 12);
    const bottom = narrow ? Math.max(dock, under(panel)) : dock;
    const right = narrow ? 16 : panel.offsetWidth + 24;
    if (embedded) schematic.insets = { left: 8, right: 8, top: 8, bottom: layoutPx(52) };
    else if (sandbox) {
      const rail = editor.rail.getBoundingClientRect();
      schematic.insets = { left: phone ? 16 : rail.right - box.left + 16, right, top: phone && !editor.rail.hidden ? rail.bottom - box.top + 12 : layoutPx(64), bottom };
    } else schematic.insets = { left: wide ? layoutPx(344) : 16, right, top: wide ? 16 : info.offsetHeight + 24, bottom };
    // A phone has no room for the empty board around a circuit: it frames the circuit and a square on every side.
    const nodes = editor.draft.nodes;
    const tight: [number, number, number, number] | undefined = nodes.length
      ? [Math.min(...nodes.map((n) => n[0])) - 1, Math.min(...nodes.map((n) => n[1])) - 1, Math.max(...nodes.map((n) => n[0])) + 1, Math.max(...nodes.map((n) => n[1])) + 1]
      : undefined;
    schematic.board = sandbox ? (phone && tight ? tight : editor.board) : undefined;
  }

  /** Back to the framing that shows the whole circuit: everything built, in the sandbox. */
  function fitView(): void {
    if (sandbox) editor.refit();
    schematic.resetView();
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
      if (sandbox && editor.draft.elements.length === 0) throw new Error('Pick a part on the left and drag between two dots to place it.');
      // Some mistakes the engine would solve into nonsense, like a capacitor charging through no resistance in no
      // time at all: they are caught before it is asked.
      if (sandbox && diagnose(editor.draft, editor.analysis() === 'steady')) throw new Error('diagnosed');
      next = sandbox ? CircuitBench.from_scene(editor.json()) : new CircuitBench(spec.id, current());
      problem = '';
      culprits = [];
      fault = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!sandbox) {
        toast(message, 'error');
        return;
      }
      // A circuit half built is often one with no answer. It stays on the board, unsolved, with the reason given in
      // a student's words and the parts responsible picked out.
      const empty = editor.draft.elements.length === 0;
      const found = empty ? undefined : diagnose(editor.draft, editor.analysis() === 'steady');
      problem = empty
        ? message
        : (found?.message ??
          "This circuit can't be solved as it is drawn: somewhere there is a loop with nothing in it to limit the current. Look for a wire, ammeter or closed switch joined across a cell or a capacitor.");
      culprits = found?.culprits ?? [];
      fault = !empty;
      bench?.free();
      bench = undefined;
      scene = editor.draft;
      analysis = 'steady';
      drift = new Float64Array(scene.elements.length);
      setRunning(false);
      refreshPanel();
      return;
    }
    bench?.free();
    bench = next;
    scene = sandbox ? editor.draft : (JSON.parse(bench.scene_json()) as CircuitSceneFile);

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
    if (sandbox) {
      history.replaceState(null, '', '?mode=circuits&sandbox');
      return;
    }
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
          // A run still going has not reached every moment an answer is about, such as "at the end": until it has,
          // a value that does not agree yet is not a disagreement.
          const pending = !agrees && analysis === 'transient' && !bench!.finished();
          nodes.push(el('span', { class: agrees ? 'measured agrees' : 'measured', text: pending ? 'solved …' : `${agrees ? '✓ ' : ''}solved ${formatNumber(answer.measured)}` }));
        }
        return el('div', { class: 'answer glass', title: 'The textbook value, and what Kirchhoff’s laws give' }, nodes);
      }),
    );
  }

  const cycleTime = (): string => {
    const t = bench!.time();
    return t < 1 ? `${formatNumber(t * 1000)} ms` : `${formatNumber(t)} s`;
  };

  function refreshProperties(): void {
    const card = sandbox ? editor.properties(analysis === 'transient') : undefined;
    properties.replaceChildren(...(card ? [card] : []));
    // A part picked out on a narrow screen opens the sheet, since its settings are in it.
    if (card && editor.selected !== undefined && main.clientWidth <= 900) fold(false);
  }

  /** The graphs on offer depend on how the circuit is solved, which in a sandbox changes as it is built. */
  function setPicker(): void {
    if (pickerFor === analysis) return;
    pickerFor = analysis;
    graph = 0;
    const options = analysis === 'alternating' ? ['Waves', 'Phasors'] : ['Voltage', 'Current'];
    graphPicker.replaceChildren(
      choice('Graph', options.map((label, value) => ({ label, value })), 0, (v) => {
        graph = v;
        drawGraph();
      }),
    );
  }

  function refreshPanel(): void {
    if (!bench) {
      clock.textContent = 'not solved';
      answers.replaceChildren(el('div', { class: `answer glass${fault ? ' problem' : ''}`, role: 'alert' }, [el('span', { class: 'name', text: problem })]));
      table.replaceChildren();
      plot.hidden = graphPicker.hidden = legend.hidden = true;
      return;
    }
    setPicker();
    clock.textContent = analysis === 'steady' ? 'steady' : `t = ${cycleTime()}`;
    about.textContent =
      analysis === 'steady'
        ? 'The moving dots are the current: they flow from the + end of each cell round to its − end, faster where more flows. The currents here are steady, so play only sets the dots moving.'
        : analysis === 'alternating'
          ? 'The moving dots are the current, which swings back and forth every cycle. Play to watch it; the readings are peak values.'
          : 'This circuit changes as time goes on. Play to follow it from the moment it is switched on; the graph fills in as it runs.';
    renderAnswers(bench.answers() as CircuitAnswer[]);
    if (embedded) return;
    const rows: HTMLElement[] = [];
    const alternating = analysis === 'alternating';
    tableTitle.textContent = alternating ? 'Each component: peak values' : 'Each component now';
    const values = componentValues();
    scene.elements.forEach((element, i) => {
      if (kindOf(element.kind) === 'wire') return;
      const [v, current] = values[i]!;
      rows.push(el('dt', { text: element.name }), el('dd', { text: `${formatPrefixed(v, 'V')} · ${formatPrefixed(current, 'A')}` }));
    });
    table.replaceChildren(...rows);
    drawGraph();
  }

  /**
   * Each component's voltage and current as a student expects to read them. On alternating current, the peaks from
   * the phasors, which hold still, not values that change every frame. A cell or source gives the current it
   * delivers, so a working one reads positive; resistors and meters give plain sizes, since which end the part was
   * drawn from means nothing to the reader; a capacitor or inductor followed in time keeps its sign, because there a
   * reversal means something. And a reading under a millionth of the largest in the circuit is the arithmetic's
   * dust, such as the few picoamps through a diode that is off: it reads as nought.
   */
  function componentValues(): [number, number][] {
    const n = scene.elements.length;
    const readings = bench!.readings();
    const phasors = analysis === 'alternating' ? bench!.phasors() : undefined;
    const raw: [number, number][] = Array.from({ length: n }, (_, i) =>
      phasors ? [Math.hypot(phasors[4 * i]!, phasors[4 * i + 1]!), Math.hypot(phasors[4 * i + 2]!, phasors[4 * i + 3]!)] : [readings[2 * i]!, readings[2 * i + 1]!],
    );
    const [topV, topI] = raw.reduce(([a, b], [v, c]) => [Math.max(a, Math.abs(v)), Math.max(b, Math.abs(c))], [0, 0]);
    const clean = (value: number, top: number) => (Math.abs(value) <= 1e-6 * top ? 0 : value);
    return raw.map(([v, current], i) => {
      const kind = kindOf(scene.elements[i]!.kind);
      let [voltage, flow] = [clean(v, topV), clean(current, topI)];
      if (kind === 'battery' || kind === 'source') flow = phasors ? flow : -flow;
      else if (kind === 'galvanometer') {
        // Which way the needle swings is part of a bridge's answer, so a galvanometer keeps its sign.
      } else if (analysis !== 'transient' || !['capacitor', 'inductor'].includes(kind)) [voltage, flow] = [Math.abs(voltage), Math.abs(flow)];
      return [voltage, flow];
    });
  }

  /** Coloured markers naming each curve, in the colours they are drawn in. */
  function key(names: string[]): void {
    legend.replaceChildren(
      ...names.map((name, k) => el('span', { class: 'curve-key' }, [el('i', { style: `background:${cssVar(CURVES[k % CURVES.length]!)}` }), el('span', { text: name })])),
    );
  }

  /** The unit to show values up to `largest` in, and what to multiply by to get it: 0.004 s reads better as 4 ms. */
  function unitFor(largest: number, unit: string): [number, string] {
    if (largest >= 1) return [1, unit];
    if (largest >= 1e-3) return [1e3, `m${unit}`];
    if (largest >= 1e-6) return [1e6, `μ${unit}`];
    return [1e9, `n${unit}`];
  }

  /** The components worth graphing: those the scene names, by their place in its list. */
  const watched = (): number[] => (sandbox ? editor.watching() : (scene.watch ?? [])).map((name) => scene.elements.findIndex((e) => e.name === name)).filter((i) => i >= 0);

  function drawGraph(): void {
    if (!bench) return;
    // A steady circuit has nothing to graph, unless it is there to show a diode's characteristic curve.
    const diode = analysis === 'steady' ? watched().find((i) => kindOf(scene.elements[i]!.kind) === 'diode') : undefined;
    const show = analysis !== 'steady' || diode !== undefined;
    plot.hidden = !show;
    graphPicker.hidden = !show || diode !== undefined;
    legend.hidden = !show;
    if (!show) return;
    if (diode !== undefined) {
      const curve = bench.diode_curve(diode);
      const half = curve.length / 2;
      const readings = bench.readings();
      // The graph stops at 50 mA; a diode driven harder than that is marked at the top of it.
      drawPlot(plot, {
        xLabel: 'voltage across the diode (V)',
        yLabel: 'current (mA)',
        curves: [{ x: Float64Array.from({ length: half }, (_, k) => curve[2 * k]!), y: Float64Array.from({ length: half }, (_, k) => curve[2 * k + 1]!), color: cssVar(CURVES[0]!), width: 2.25 }],
        now: [readings[2 * diode]!, Math.min(1000 * readings[2 * diode + 1]!, 50)],
      });
      legend.textContent = 'The diode’s characteristic curve. The dot is where this circuit puts it.';
      return;
    }
    const names = watched().map((i) => scene.elements[i]!.name);
    if (analysis === 'transient') {
      const quantity = graph === 0 ? 'voltage' : 'current';
      // Axes in the unit a person would read them in: a run of a few milliseconds in ms, a current of microamps in μA.
      const seconds = bench.series_time();
      const series = watched().map((i) => bench!.series(i, quantity));
      const [tScale, tUnit] = unitFor(Math.max(...seconds.map(Math.abs)), 's');
      const [yScale, yUnit] = unitFor(Math.max(1e-300, ...series.flatMap((y) => [...y].map(Math.abs))), graph === 0 ? 'V' : 'A');
      const x = seconds.map((t) => t * tScale);
      const curves: Curve[] = series.map((y, k) => ({ x, y: y.map((v) => v * yScale), color: cssVar(CURVES[k % CURVES.length]!), width: 2 }));
      drawPlot(plot, { xLabel: `time (${tUnit})`, yLabel: `${quantity} (${yUnit})`, curves, fromZero: true });
      key(names);
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

  function action(name: 'sliders' | 'restart' | 'remix', label: string, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
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
          hardMin: typedLimits(p).min,
          hardMax: typedLimits(p).max,
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
    actions.append(action('remix', 'Build on this', () => bench && build(bench.scene_json())));
    sandbox = false;
    editor.rail.hidden = hint.hidden = true;
    info.hidden = false;
    notes.classList.remove('beside-rail');
    refreshProperties();
    pickerFor = '';
    schematic.resetView();
    rebuild(false);
    insets();
  }

  /** The circuit left on the board at the last visit, or the loop a builder starts with. */
  function starterOrSaved(): unknown {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      /* storage unavailable, or what is in it is not a circuit */
    }
    return starter();
  }

  /** Opens the builder on a circuit: one from a scenario, a link, the last visit, or the starting loop. */
  function build(json?: string): void {
    closePopover();
    sandbox = true;
    if (json) {
      try {
        editor.load(json);
      } catch {
        toast('That circuit could not be read.', 'error');
      }
    }
    editor.rail.hidden = hint.hidden = embedded;
    info.hidden = true;
    notes.classList.add('beside-rail');
    shell.setTitle('Sandbox', 'Build your own circuit');
    editor.setTool('select');
    pickerFor = '';
    fitView();
    insets();
    rebuild(false);
    refreshProperties();
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
  /** How near, in squares of the board, the pointer must be to a part to mean it. */
  const reach = () => (1.4 * KNOB_REACH) / schematic.unit;
  // Fingers and the mouse on the stage. One pointer builds, picks or moves the view; two pinch to zoom and pan.
  const pointers = new Map<number, Vec>();
  let panning: Vec | undefined;
  const pinch = () => {
    const [a, b] = [...pointers.values()];
    return { mid: [(a![0] + b![0]) / 2, (a![1] + b![1]) / 2] as Vec, span: Math.hypot(a![0] - b![0], a![1] - b![1]) };
  };
  canvas.addEventListener('pointerdown', (e) => {
    // Keeping the pointer is a nicety: a browser that will not, for a pointer it no longer tracks, loses nothing.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 2) {
      // A second finger: whatever the first began is a zoom instead.
      if (sandbox) editor.abandon();
      holding = false;
      panning = undefined;
      return;
    }
    if (pointers.size > 2) return;
    const at = schematic.toPage(local(e));
    if (sandbox) {
      // With the arrow, a press on empty board moves the view; on a part or a junction it picks or moves that.
      if (editor.tool === 'select' && !editor.over(at, reach())) panning = local(e);
      editor.press(at, reach());
      return;
    }
    if (overJockey(e)) {
      holding = true;
      canvas.classList.add('holding');
    } else panning = local(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    const was = pointers.get(e.pointerId);
    if (was) pointers.set(e.pointerId, local(e));
    if (pointers.size === 2 && was) {
      const before = pinch();
      pointers.set(e.pointerId, was);
      const then = pinch();
      pointers.set(e.pointerId, local(e));
      schematic.panBy(before.mid[0] - then.mid[0], before.mid[1] - then.mid[1]);
      if (then.span > 0) schematic.zoomAt(before.mid, before.span / then.span);
      return;
    }
    if (panning) {
      const now = local(e);
      schematic.panBy(now[0] - panning[0], now[1] - panning[1]);
      panning = now;
      return;
    }
    if (sandbox) {
      const at = schematic.toPage(local(e));
      editor.dragTo(at);
      canvas.classList.toggle('over-body', editor.over(at, reach()));
      return;
    }
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
  const letGo = (e: PointerEvent) => {
    const gesture = pointers.size;
    pointers.delete(e.pointerId);
    if (gesture >= 2) return;
    panning = undefined;
    if (sandbox) editor.release();
    holding = false;
    canvas.classList.remove('holding');
  };
  canvas.addEventListener('pointerup', letGo);
  canvas.addEventListener('pointercancel', letGo);
  // The wheel, or two fingers on a trackpad, zoom about the pointer.
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      schematic.zoomAt(local(e as unknown as PointerEvent), Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    },
    { passive: false },
  );

  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]');
    if (typing) return;
    if (sandbox && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) editor.redo();
      else editor.undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (sandbox && (e.key === 'Delete' || e.key === 'Backspace') && editor.selected !== undefined) editor.remove(editor.selected);
    else if (sandbox && e.key === 'Escape') editor.setTool('select');
    else if (e.key === ' ') {
      e.preventDefault();
      toggle();
    } else if (e.key.toLowerCase() === 'r') rebuild(false);
    else if (e.key.toLowerCase() === 'f') fitView();
    else if (e.key === '/') {
      e.preventDefault();
      openGallery();
    }
  });

  const openGallery = () => openCircuitGallery(catalogue, sandbox ? '' : spec.id, (id) => show(catalogue.find((s) => s.id === id) ?? spec), () => build(sandbox ? undefined : JSON.stringify(starterOrSaved())));
  shell.onTitle(openGallery);
  shell.onShare(async () => {
    const link = new URL(location.href);
    if (sandbox) link.hash = `scene=${await encodeScene(editor.json())}`;
    const url = link.toString();
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
    insets();
    if (!bench && sandbox) schematic.draw({ scene, readings: new Float64Array(2 * scene.elements.length), drift, edit: { selected: editor.selected, preview: editor.preview, culprits } });
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
      const at = sandbox ? undefined : jockeyAt();
      schematic.draw({
        scene,
        readings: bench.readings(),
        drift,
        jockey: at ? { at, active: holding || hovering } : undefined,
        edit: sandbox && !embedded ? { selected: editor.selected, preview: editor.preview } : undefined,
        // The meters on the drawing say what the table says.
        shown: componentValues(),
        peaks: analysis === 'alternating',
      });
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
    if (given !== null && Number.isFinite(Number(given))) chosen[p.name] = clamp(Number(given), typedLimits(p).min, typedLimits(p).max);
  }
  // A link carries its circuit in the part after the #, which is read before anything rewrites the address.
  const shared = query.has('sandbox') ? sceneFromUrl() : undefined;
  show(wanted, chosen);
  if (shared) {
    build(JSON.stringify(starterOrSaved()));
    void shared.then((json) => json && build(json));
  }
  requestAnimationFrame(loop);
}
