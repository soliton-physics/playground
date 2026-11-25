import { iconButton, popover, slider, toast, type Slider } from '../controls';
import { Formula, maths_number } from '../engine';
import { icon } from '../icons';
import type { Shell } from '../shell';
import { cssVar, el, formatNumber, wheelZooms } from '../ui';
import { HOME, Plane, type Area, type Curve, type Marker } from './plane';
import { mountMatrices } from './matrices';
import { roomTabs } from './rooms';
import { tex } from './tex';

const MOST_ROWS = 4;
const COLOURS = ['--series-1', '--series-2', '--series-3', '--series-5'];
const RULES = [
  { value: 'none', label: 'None' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'midpoint', label: 'Middle' },
  { value: 'trapezium', label: 'Trapezium' },
  { value: 'simpson', label: 'Simpson' },
] as const;
type RuleName = (typeof RULES)[number]['value'];

interface Complaint {
  message: string;
  start: number;
  end: number;
}

interface Step {
  words: string;
  latex: string | null;
}

interface Integral {
  latex: string;
  text: string;
  steps: Step[];
}

interface DefiniteResult {
  value: number;
  numeric: number | null;
  error: number | null;
  exact_latex: string | null;
  exact_text: string | null;
}

interface Row {
  text: string;
  colour: string;
  formula?: Formula;
  derivative?: Formula;
  /** undefined: not yet worked out; null: no formula found */
  integral?: Integral | null;
  complaint?: Complaint;
  input: HTMLInputElement;
  preview: HTMLElement;
  root: HTMLElement;
}

interface Example {
  title: string;
  rows: string[];
  values?: Record<string, number>;
  derivative?: boolean;
  area?: [string, string];
  rule?: RuleName;
  strips?: number;
  point?: number;
  note: string;
}

const EXAMPLES: Example[] = [
  { title: 'A parabola and its sliders', rows: ['a x^2 + b x + c'], values: { a: 1, b: 0, c: -2 }, note: 'Each letter is a slider. Drag them and watch the parabola move.' },
  { title: 'The slope of sin x', rows: ['sin x'], derivative: true, point: 0.8, note: 'The dashed curve is the derivative. Drag the point: its height is the slope of the tangent.' },
  { title: 'Area under x² by strips', rows: ['x^2'], area: ['0', '1'], rule: 'left', strips: 8, note: 'More strips close in on the exact area, 1/3.' },
  { title: 'π as an area', rows: ['4/(1 + x^2)'], area: ['0', '1'], note: 'The area under 4/(1 + x²) from 0 to 1 is exactly π.' },
  { title: 'x sin x, by parts', rows: ['x sin x'], area: ['0', 'pi'], note: 'Open "How" under the integral to see the parts.' },
  { title: 'Partial fractions', rows: ['(3x - 1)/((x - 1)(x - 2)(x - 3))'], note: 'Three poles; the integral splits into three logarithms.' },
  { title: 'tan x and its poles', rows: ['tan x'], derivative: true, note: 'The graph is cut where tan x has no value.' },
  { title: 'The greatest integer [x]', rows: ['[x]'], area: ['0', '3'], note: 'No single formula holds across the jumps; the area is still exact: 0 + 1 + 2.' },
  { title: 'eˣ, log x and the mirror y = x', rows: ['e^x', 'log x', 'x'], note: 'Each is the other reflected in y = x.' },
  { title: 'The bell curve', rows: ['e^(-x^2)'], area: ['-2', '2'], note: 'No formula exists for this integral, so the area is found numerically.' },
];

function tidy(f: Formula | undefined): void {
  f?.free();
}

/** The Functions room: type functions, see them, their slopes and areas, and their integrals worked out. */
export function mountMaths(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  if (query.get('room') === 'matrices') return mountMatrices(main, query, embedded, shell);
  const canvas = el('canvas', { class: 'stage-canvas maths-canvas' });
  const plane = new Plane(canvas);

  const list = el('div', { class: 'maths-rows' });
  const add = el('button', { type: 'button', class: 'text-button outlined maths-add' }, [icon('plus', 16), el('span', { text: 'Add a function' })]);
  const sliders = el('div', { class: 'maths-sliders' });
  const note = el('p', { class: 'maths-note' });
  const left = el('section', { class: 'maths-panel glass overlay' }, [roomTabs('functions'), list, add, sliders, note]);

  const calculus = el('div', { class: 'maths-calculus-body' });
  const right = el('aside', { class: 'maths-calculus glass overlay' }, [calculus]);

  const dock = el('div', { class: 'dock glass overlay maths-dock' }, [
    iconButton('fit', 'Back to the start ( 0 )', () => home()),
    iconButton('plus', 'Closer', () => zoomCentre(1.5)),
    iconButton('minus', 'Further', () => zoomCentre(1 / 1.5)),
  ]);
  main.append(canvas, left, right, dock);
  if (embedded) main.classList.add('maths-embedded');

  const rows: Row[] = [];
  const values = new Map<string, number>();
  const sliderOf = new Map<string, Slider>();
  let selected = 0;
  let showDerivative = false;
  let showArea = false;
  let from = '0';
  let to = '1';
  let rule: RuleName = 'none';
  let strips = 10;
  let point: number | undefined;
  let hover: number | undefined;
  let title = 'Your functions';

  const valuesOf = (f: Formula) => new Float64Array(f.parameters().map((n) => values.get(n) ?? 1));
  const colourOf = (row: Row) => cssVar(row.colour);
  const plotted = (row: Row | undefined): row is Row & { formula: Formula } =>
    !!row?.formula && (row.formula.kind() === 'expression' || row.formula.kind() === 'function');

  // ---------- the rows ----------

  function read(row: Row): void {
    tidy(row.formula);
    tidy(row.derivative);
    row.formula = row.derivative = undefined;
    row.integral = undefined;
    row.complaint = undefined;
    const text = row.text.trim();
    if (text) {
      try {
        row.formula = new Formula(text);
      } catch (e) {
        row.complaint = typeof e === 'object' && e && 'message' in e ? (e as Complaint) : { message: String(e), start: 0, end: text.length };
      }
    }
    try {
      if (plotted(row)) row.derivative = row.formula.derivative();
    } catch {
      /* n! has none */
    }
    preview(row);
  }

  function preview(row: Row): void {
    row.root.classList.toggle('wrong', !!row.complaint);
    if (row.complaint) {
      const { message, start, end } = row.complaint;
      const shown = row.input.value;
      const mark = el('mark', { text: shown.slice(start, Math.max(end, start + 1)) || ' ' });
      row.preview.replaceChildren(
        el('span', { class: 'maths-complaint', text: message }),
        el('code', {}, [shown.slice(0, start), mark, shown.slice(Math.max(end, start + 1))]),
      );
      return;
    }
    if (!row.formula) {
      row.preview.replaceChildren(el('span', { class: 'muted', text: 'Type a function of x, such as x sin x' }));
      return;
    }
    const kind = row.formula.kind();
    const holder = el('span');
    row.preview.replaceChildren(holder);
    const lhs = kind === 'function' ? 'y = ' : '';
    if (kind === 'relation' || kind === 'differential') {
      row.preview.append(el('small', { class: 'muted', text: kind === 'relation' ? ' A relation: curves like this come with conic sections.' : ' A differential equation: the solver comes later.' }));
      tex(holder, row.formula.latex());
      return;
    }
    tex(holder, `${lhs}${row.formula.latex()}`);
  }

  function addRow(text: string): Row {
    const colour = COLOURS.find((c) => !rows.some((r) => r.colour === c)) ?? COLOURS[0]!;
    const input = el('input', { type: 'text', class: 'maths-input', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'A function of x', placeholder: 'x sin x' });
    input.value = text;
    const preview = el('div', { class: 'maths-preview' });
    const swatch = el('span', { class: 'maths-swatch' });
    swatch.style.background = `var(${colour})`;
    const remove = iconButton('close', 'Remove this function', () => removeRow(row), 'maths-remove');
    const root = el('div', { class: 'maths-row' }, [el('div', { class: 'maths-line' }, [swatch, input, remove]), preview]);
    const row: Row = { text, colour, input, preview, root };
    let pause: number | undefined;
    input.addEventListener('input', () => {
      clearTimeout(pause);
      pause = window.setTimeout(() => {
        row.text = input.value;
        read(row);
        changed();
      }, 250);
    });
    input.addEventListener('focus', () => choose(rows.indexOf(row)));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') input.blur();
    });
    rows.push(row);
    list.append(root);
    read(row);
    return row;
  }

  function removeRow(row: Row): void {
    const i = rows.indexOf(row);
    if (i < 0) return;
    tidy(row.formula);
    tidy(row.derivative);
    rows.splice(i, 1);
    row.root.remove();
    if (rows.length === 0) addRow('');
    selected = Math.min(selected, rows.length - 1);
    changed();
  }

  function choose(i: number): void {
    if (i === selected || i < 0) return;
    selected = i;
    point = undefined;
    changed();
  }

  add.addEventListener('click', () => {
    if (rows.length >= MOST_ROWS) return toast(`Up to ${MOST_ROWS} functions at once.`);
    const row = addRow('');
    selected = rows.length - 1;
    row.input.focus();
    changed();
  });

  // ---------- sliders for the letters ----------

  function syncSliders(): void {
    const names: string[] = [];
    for (const row of rows) for (const n of row.formula?.parameters() ?? []) if (!names.includes(n) && row.formula!.kind() !== 'relation' && row.formula!.kind() !== 'differential') names.push(n);
    const shown = [...sliderOf.keys()];
    if (shown.length === names.length && shown.every((n, i) => n === names[i])) return;
    sliderOf.clear();
    sliders.replaceChildren(...(names.length ? [el('h4', { class: 'panel-title', text: 'Sliders' })] : []));
    for (const name of names) {
      if (!values.has(name)) values.set(name, 1);
      const s = slider({
        label: name,
        min: -5,
        max: 5,
        step: 0.05,
        value: values.get(name)!,
        hardMin: -1e9,
        hardMax: 1e9,
        format: (v) => formatNumber(v, 4),
        onInput: (v) => {
          values.set(name, v);
          draw();
          refreshNumbers();
        },
      });
      sliderOf.set(name, s);
      sliders.append(s.root);
    }
  }

  // ---------- the calculus panel ----------

  function section(heading: string, ...children: (Node | string)[]): HTMLElement {
    return el('section', { class: 'maths-section' }, [el('h4', { class: 'panel-title', text: heading }), ...children]);
  }

  function formulaLine(source: string): HTMLElement {
    const holder = el('div', { class: 'maths-formula' });
    tex(holder, source, true);
    return holder;
  }

  function toggle(label: string, on: boolean, change: (on: boolean) => void): HTMLButtonElement {
    const button = el('button', { type: 'button', class: 'text-button outlined maths-toggle', text: label });
    button.setAttribute('aria-pressed', String(on));
    button.addEventListener('click', () => {
      change(button.getAttribute('aria-pressed') !== 'true');
      changed();
    });
    return button;
  }

  function limitField(label: string, value: string, set: (v: string) => void): HTMLElement {
    const input = el('input', { type: 'text', class: 'maths-limit', spellcheck: 'false', 'aria-label': label });
    input.value = value;
    let pause: number | undefined;
    input.addEventListener('input', () => {
      clearTimeout(pause);
      pause = window.setTimeout(() => {
        set(input.value);
        draw();
        refreshNumbers();
      }, 300);
    });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    return el('label', { class: 'maths-limit-label' }, [el('span', { text: label }), input]);
  }

  function number(text: string): number {
    try {
      return maths_number(text);
    } catch {
      return Number.NaN;
    }
  }

  let areaResult: HTMLElement | undefined;
  let pointResult: HTMLElement | undefined;

  /** Rebuilds the right panel, for a new formula or a new choice of what to show. */
  function showCalculus(): void {
    const row = rows[selected];
    if (!plotted(row)) {
      calculus.replaceChildren(el('p', { class: 'muted', text: row?.complaint ? 'Fix the function on the left to see its calculus.' : 'Type a function on the left.' }));
      return;
    }
    const f = row.formula;
    const name = f.kind() === 'function' ? 'y' : 'f';
    const variable = f.variable();
    const parts: HTMLElement[] = [];

    // derivative
    const derivative = row.derivative;
    parts.push(
      section(
        'Derivative',
        derivative ? formulaLine(`\\frac{d}{d${variable}}\\,${name === 'y' ? 'y' : `f(${variable})`} = ${derivative.latex()}`) : el('p', { class: 'muted', text: 'This function has no derivative.' }),
        el('div', { class: 'maths-actions' }, [toggle('Draw the derivative', showDerivative, (on) => (showDerivative = on))]),
      ),
    );

    // indefinite integral, worked once per formula
    if (row.integral === undefined) row.integral = (f.integral() as Integral | null) ?? null;
    const integral = row.integral;
    const integralBody: (Node | string)[] = [];
    if (integral) {
      integralBody.push(formulaLine(`\\int ${f.latex()}\\,d${variable} = ${integral.latex} + C`));
      if (integral.steps.length) {
        const steps = el('ol', { class: 'maths-steps' });
        for (const step of integral.steps) {
          const item = el('li', {}, [el('span', { text: step.words })]);
          if (step.latex) {
            const formula = el('div', { class: 'maths-step-formula' });
            tex(formula, step.latex, true);
            item.append(formula);
          }
          steps.append(item);
        }
        integralBody.push(el('details', { class: 'fold' }, [el('summary', { text: 'How' }), steps]));
      }
    } else {
      integralBody.push(el('p', { class: 'muted', text: 'No formula found. Many functions, such as e^(−x²) and sin x / x, have none made of the usual functions; their areas can still be measured below.' }));
    }
    parts.push(section('Integral', ...integralBody));

    // area between limits
    areaResult = el('div', { class: 'maths-result' });
    const ruleButtons = RULES.map((r) => {
      const button = el('button', { type: 'button', text: r.label });
      button.setAttribute('aria-pressed', String(r.value === rule));
      button.addEventListener('click', () => {
        rule = r.value;
        if (rule !== 'none') showArea = true;
        changed();
      });
      return button;
    });
    const areaBody: (Node | string)[] = [
      el('div', { class: 'maths-limits' }, [limitField('from', from, (v) => (from = v)), limitField('to', to, (v) => (to = v))]),
      el('div', { class: 'maths-actions' }, [toggle('Shade the area', showArea, (on) => (showArea = on))]),
      areaResult,
      el('div', { class: 'slider' }, [el('span', { class: 'slider-head' }, [el('span', { text: 'Strips' })]), el('div', { class: 'choice maths-rules', role: 'group', 'aria-label': 'Strips' }, ruleButtons)]),
    ];
    if (rule !== 'none') {
      areaBody.push(
        slider({
          label: 'How many strips',
          min: 1,
          max: 100,
          step: 1,
          value: strips,
          hardMin: 1,
          hardMax: 2000,
          format: (v) => String(Math.round(v)),
          onInput: (v) => {
            strips = Math.max(1, Math.round(v));
            draw();
            refreshNumbers();
          },
        }).root,
      );
    }
    parts.push(section('Area', ...areaBody));

    pointResult = el('div');
    parts.push(section('Point', pointResult));
    calculus.replaceChildren(...parts);
    refreshNumbers();
  }

  /** The numbers that follow the sliders, the limits and the point, without rebuilding the panel around them. */
  function refreshNumbers(): void {
    const row = rows[selected];
    if (!plotted(row) || !areaResult || !pointResult) return;
    const f = row.formula;
    const variable = f.variable();
    const name = f.kind() === 'function' ? 'y' : `f(${variable})`;
    const a = number(from);
    const b = number(to);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      try {
        const d = f.definite(from, to, valuesOf(f)) as DefiniteResult;
        const holder = el('div', { class: 'maths-formula' });
        const sign = `\\int_{${texLimit(from)}}^{${texLimit(to)}} ${f.latex()}\\,d${variable}`;
        const approx = formatNumber(d.value, 8);
        tex(holder, d.exact_latex && d.exact_text !== approx ? `${sign} = ${d.exact_latex} \\approx ${approx}` : `${sign} \\approx ${approx}`, true);
        const result: HTMLElement[] = [holder];
        if (!d.exact_latex && d.numeric !== null) {
          const error = d.error ?? 0;
          const within = error < 1e-9 ? 'better than a billionth' : `about ${formatNumber(error, 2)}`;
          result.push(el('p', { class: 'muted', text: `Measured numerically, to ${within}.` }));
        }
        if (rule !== 'none') {
          const sum = f.riemann(a, b, strips, rule, valuesOf(f)) as { value: number };
          const label = RULES.find((r) => r.value === rule)!.label;
          result.push(el('p', { class: 'maths-sum' }, [el('b', { text: `${label} sum, ${strips} strips: ${formatNumber(sum.value, 6)}` }), el('span', { class: 'muted', text: ` (off by ${formatNumber(sum.value - d.value, 3)})` })]));
        }
        areaResult.replaceChildren(...result);
      } catch {
        areaResult.replaceChildren(el('p', { class: 'muted', text: 'The area could not be found.' }));
      }
    } else {
      areaResult.replaceChildren(el('p', { class: 'maths-complaint', text: 'Type the limits as numbers or formulas, such as 0 and pi/2.' }));
    }

    if (point !== undefined) {
      const y = f.at(point, valuesOf(f));
      const slope = row.derivative ? row.derivative.at(point, valuesOf(row.derivative)) : Number.NaN;
      pointResult.replaceChildren(
        el('dl', { class: 'readout' }, [
          el('dt', { text: variable }),
          el('dd', { text: formatNumber(point, 5) }),
          el('dt', { text: name }),
          el('dd', { text: formatNumber(y, 5) }),
          el('dt', { text: 'slope' }),
          el('dd', { text: formatNumber(slope, 5) }),
        ]),
      );
    } else {
      pointResult.replaceChildren(el('p', { class: 'muted', text: 'Click the graph to put a point on the curve, then drag it along. The line through it is the tangent.' }));
    }
  }

  // ---------- drawing ----------

  function draw(): void {
    const b = plane.bounds();
    const curves: Curve[] = [];
    const areas: Area[] = [];
    const markers: Marker[] = [];
    rows.forEach((row, i) => {
      if (!plotted(row)) return;
      const f = row.formula;
      const colour = colourOf(row);
      const chosen = i === selected;
      curves.push({ points: f.graph(b.left, b.right, b.bottom, b.top, plane.pixels, valuesOf(f)), colour, width: chosen ? 3 : 2.2 });
      if (!chosen) return;
      if (showDerivative && row.derivative) {
        const d = row.derivative;
        curves.push({ points: d.graph(b.left, b.right, b.bottom, b.top, plane.pixels, valuesOf(d)), colour, width: 2, dashed: true });
      }
      const lo = number(from);
      const hi = number(to);
      if (showArea && Number.isFinite(lo) && Number.isFinite(hi) && lo !== hi) {
        const [p, q] = lo < hi ? [lo, hi] : [hi, lo];
        const area: Area = { from: p, to: q, points: f.graph(p, q, b.bottom, b.top, plane.pixels, valuesOf(f)), colour };
        if (rule !== 'none') {
          const sum = f.riemann(lo, hi, strips, rule, valuesOf(f)) as { edges: number[]; heights: number[] };
          area.strips = { edges: sum.edges, heights: sum.heights, rule };
        }
        areas.push(area);
      }
      if (point !== undefined) {
        const y = f.at(point, valuesOf(f));
        const slope = row.derivative?.at(point, valuesOf(row.derivative));
        markers.push({ x: point, y, slope, colour, label: `(${formatNumber(point, 3)}, ${formatNumber(y, 3)})` });
      }
      if (hover !== undefined && hover !== point) {
        const y = f.at(hover, valuesOf(f));
        markers.push({ x: hover, y, colour, label: `(${formatNumber(hover, 3)}, ${formatNumber(y, 3)})` });
      }
    });
    plane.draw({ curves, areas, markers });
  }

  /** Something on the left changed: sliders, the panel, the graph and the link all follow. */
  function changed(): void {
    rows.forEach((row, i) => row.root.classList.toggle('chosen', i === selected));
    add.hidden = rows.length >= MOST_ROWS;
    syncSliders();
    draw();
    showCalculus();
    shell.setTitle('Maths · Functions', title);
  }

  // ---------- the view ----------

  /** The origin in the middle of the space the panels leave free. */
  function home(): void {
    const leftEdge = embedded ? 0 : left.getBoundingClientRect().right - main.getBoundingClientRect().left;
    const rightEdge = embedded || getComputedStyle(right).display === 'none' ? main.clientWidth : right.getBoundingClientRect().left - main.getBoundingClientRect().left;
    const free = rightEdge > leftEdge + 200 ? (leftEdge + rightEdge) / 2 : main.clientWidth / 2;
    const scale = HOME.scale * Math.max(0.6, Math.min(1.4, (rightEdge - leftEdge) / 700));
    plane.camera = { scale, x: -(free - main.clientWidth / 2) / scale, y: 0 };
    draw();
  }

  function zoomCentre(factor: number): void {
    plane.zoom(factor, main.clientWidth / 2, main.clientHeight / 2);
    draw();
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let dragging: 'pan' | 'point' | undefined;
  let moved = 0;
  let pinch = 0;

  const local = (e: PointerEvent | WheelEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function nearPoint(px: number, py: number): boolean {
    const row = rows[selected];
    if (point === undefined || !plotted(row)) return false;
    const [qx, qy] = plane.toScreen(point, row.formula.at(point, valuesOf(row.formula)));
    return Math.hypot(px - qx, py - qy) < 16;
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const [px, py] = local(e);
    pointers.set(e.pointerId, { x: px, y: py });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      dragging = undefined;
      return;
    }
    dragging = nearPoint(px, py) ? 'point' : 'pan';
    moved = 0;
    canvas.classList.toggle('holding', dragging === 'pan');
  });

  canvas.addEventListener('pointermove', (e) => {
    const [px, py] = local(e);
    const before = pointers.get(e.pointerId);
    if (pointers.size === 2 && before) {
      pointers.set(e.pointerId, { x: px, y: py });
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinch > 0) plane.zoom(distance / pinch, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      pinch = distance;
      draw();
      return;
    }
    if (dragging === 'pan' && before) {
      plane.pan(px - before.x, py - before.y);
      moved += Math.abs(px - before.x) + Math.abs(py - before.y);
      pointers.set(e.pointerId, { x: px, y: py });
      draw();
      return;
    }
    if (dragging === 'point') {
      point = plane.toPlane(px, py)[0];
      draw();
      refreshNumbers();
      return;
    }
    hover = plotted(rows[selected]) ? plane.toPlane(px, py)[0] : undefined;
    canvas.classList.toggle('over-body', nearPoint(px, py));
    draw();
  });

  const release = (e: PointerEvent) => {
    const [px, py] = local(e);
    const was = dragging;
    pointers.delete(e.pointerId);
    dragging = undefined;
    canvas.classList.remove('holding');
    if (was === 'pan' && moved < 4 && plotted(rows[selected])) {
      point = plane.toPlane(px, py)[0];
      draw();
      refreshNumbers();
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    hover = undefined;
    draw();
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!wheelZooms(e)) return;
      e.preventDefault();
      const [px, py] = local(e);
      plane.zoom(Math.exp(-e.deltaY * 0.0015), px, py);
      draw();
    },
    { passive: false },
  );

  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '0') home();
    else if (e.key === '/') {
      e.preventDefault();
      rows[selected]?.input.focus();
    } else if (e.key === 'Escape') {
      point = undefined;
      changed();
    }
  });

  window.addEventListener('resize', () => {
    plane.resize();
    draw();
  });
  window.addEventListener('themechange', () => draw());

  // ---------- examples and links ----------

  function load(example: Example | undefined, rowsText: string[]): void {
    for (const row of rows) {
      tidy(row.formula);
      tidy(row.derivative);
    }
    rows.length = 0;
    list.replaceChildren();
    for (const text of rowsText.slice(0, MOST_ROWS)) addRow(text);
    if (rows.length === 0) addRow('');
    selected = 0;
    if (example) {
      title = example.title;
      values.clear();
      for (const [k, v] of Object.entries(example.values ?? {})) values.set(k, v);
      showDerivative = example.derivative ?? false;
      showArea = !!example.area;
      [from, to] = example.area ?? ['0', '1'];
      rule = example.rule ?? 'none';
      strips = example.strips ?? 10;
      point = example.point;
      note.textContent = example.note;
    }
    sliderOf.clear();
    changed();
  }

  shell.onTitle(() => {
    const anchor = document.querySelector<HTMLElement>('.title-button')!;
    const menu = el(
      'nav',
      { class: 'menu maths-examples' },
      EXAMPLES.map((example) => {
        const item = el('button', { type: 'button', class: 'subject' }, [el('span', {}, [el('b', { text: example.title }), el('small', { text: example.rows.join(',  ') })])]);
        item.addEventListener('click', () => {
          load(example, example.rows);
          home();
          popover(anchor, el('div'));
        });
        return item;
      }),
    );
    popover(anchor, menu, 'below');
  });

  shell.onShare(() => {
    const link = new URLSearchParams({ mode: 'maths' });
    for (const row of rows) if (row.text.trim()) link.append('f', row.text.trim());
    for (const [k, v] of values) link.append('v', `${k}:${v}`);
    if (showDerivative) link.set('derivative', '1');
    if (showArea) link.set('area', `${from},${to}`);
    if (rule !== 'none') link.set('strips', `${rule},${strips}`);
    if (point !== undefined) link.set('point', String(Number(point.toFixed(4))));
    const url = `${location.origin}${location.pathname}?${link}`;
    history.replaceState(null, '', url);
    navigator.clipboard?.writeText(url).then(
      () => toast('Link copied: it opens these functions as they are now.'),
      () => toast(url),
    );
  });

  // ---------- start ----------

  plane.resize();
  const typed = query.getAll('f');
  if (typed.length) {
    const shared: Example = { title: 'Shared functions', rows: typed, note: '', values: Object.fromEntries(query.getAll('v').map((s) => s.split(':')).map(([k, v]) => [k!, Number(v)])) };
    const area = query.get('area')?.split(',');
    if (area?.length === 2) shared.area = [area[0]!, area[1]!];
    shared.derivative = query.get('derivative') === '1';
    const s = query.get('strips')?.split(',');
    if (s?.length === 2 && RULES.some((r) => r.value === s[0])) {
      shared.rule = s[0] as RuleName;
      shared.strips = Number(s[1]) || 10;
    }
    const p = Number(query.get('point'));
    if (query.has('point') && Number.isFinite(p)) shared.point = p;
    load(shared, typed);
  } else {
    load(EXAMPLES[1], EXAMPLES[1]!.rows);
  }
  requestAnimationFrame(() => home());
}

/** A typed limit for the integral sign: `pi/2` as \frac{\pi}{2}. */
function texLimit(text: string): string {
  try {
    const f = new Formula(text);
    const latex = f.latex();
    f.free();
    return latex;
  } catch {
    return text;
  }
}
