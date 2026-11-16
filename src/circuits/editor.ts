import { choice, iconButton, slider } from '../controls';
import type { IconName } from '../icons';
import { el, formatNumber, formatPrefixed } from '../ui';
import { kindOf, type ElementSpec, type KindSpec, type Vec } from './types';

export type PartTool = 'select' | 'wire' | 'resistor' | 'battery' | 'capacitor' | 'inductor' | 'source' | 'switch' | 'diode' | 'ammeter' | 'voltmeter' | 'erase';

const TOOLS: [PartTool, IconName, string][] = [
  ['select', 'cursor', 'Select a part, or drag a junction'],
  ['wire', 'wire', 'Wire: drag from one dot to another'],
  ['resistor', 'resistor', 'Resistor'],
  ['battery', 'battery', 'Cell: its positive end is where the drag starts'],
  ['switch', 'knife', 'Switch'],
  ['capacitor', 'capacitor', 'Capacitor'],
  ['inductor', 'inductor', 'Inductor'],
  ['source', 'acsource', 'Alternating source'],
  ['diode', 'diode', 'Diode: it conducts the way it is dragged'],
  ['ammeter', 'ammeter', 'Ammeter: put it in the path of the current'],
  ['voltmeter', 'voltmeter', 'Voltmeter: put it across a part'],
  ['erase', 'erase', 'Erase a part'],
];

const HINTS: Record<PartTool, string> = {
  select: 'Click a part to set its value. Drag a junction to move it. Delete removes the part picked out.',
  wire: 'Drag from one dot to another to join them with wire.',
  resistor: 'Drag from one dot to another to place a resistor.',
  battery: 'Drag to place a cell. Its positive end is where the drag starts.',
  switch: 'Drag to place a switch. Select it to open or close it.',
  capacitor: 'Drag to place a capacitor. The circuit is then followed in time as it charges.',
  inductor: 'Drag to place an inductor.',
  source: 'Drag to place an alternating source.',
  diode: 'Drag to place a diode. It conducts in the direction of the drag.',
  ammeter: 'Drag to place an ammeter in the path of the current: it is a wire that reads.',
  voltmeter: 'Drag to place a voltmeter across the part to be measured: it passes no current.',
  erase: 'Click a part to remove it.',
};

/** What a new part of each kind is worth, and the letter its name begins with. */
const NEW: Record<Exclude<PartTool, 'select' | 'erase'>, [string, () => KindSpec]> = {
  wire: ['wire ', () => 'wire'],
  resistor: ['R', () => ({ resistor: { resistance: 100 } })],
  battery: ['cell ', () => ({ battery: { emf: 6 } })],
  switch: ['S', () => ({ switch: { closed: true } })],
  capacitor: ['C', () => ({ capacitor: { capacitance: 1e-4 } })],
  inductor: ['L', () => ({ inductor: { inductance: 0.1 } })],
  source: ['AC', () => ({ source: { amplitude: 10, frequency: 50 } })],
  diode: ['D', () => ({ diode: {} })],
  ammeter: ['A', () => 'ammeter'],
  voltmeter: ['V', () => 'voltmeter'],
};

/** The board parts are placed on, unless a circuit brought in needs a bigger one: squares across and up. */
const BOARD: [number, number] = [8, 5];

/** A circuit being built, as the engine's scene file has it. */
export interface Draft {
  schema: number;
  title: string;
  nodes: Vec[];
  elements: ElementSpec[];
  analysis: unknown;
  watch?: string[];
}

/** A cell, a switch and a resistor in a loop: somewhere to start from. */
export function starter(): Draft {
  return {
    schema: 1,
    title: 'My circuit',
    nodes: [[2, 1], [2, 4], [4, 4], [6, 4], [6, 1]],
    elements: [
      { name: 'cell 1', a: 1, b: 0, kind: { battery: { emf: 6 } } },
      { name: 'S1', a: 1, b: 2, kind: { switch: { closed: true } } },
      { name: 'wire 1', a: 2, b: 3, kind: 'wire' },
      { name: 'R1', a: 3, b: 4, kind: { resistor: { resistance: 100 } } },
      { name: 'wire 2', a: 4, b: 0, kind: 'wire' },
    ],
    analysis: 'steady',
  };
}

const same = (a: Vec, b: Vec) => a[0] === b[0] && a[1] === b[1];

/** The tools for building a circuit, and the circuit they build. Solving it is somebody else's business. */
export class CircuitEditor {
  readonly rail = el('div', { class: 'rail two glass overlay', role: 'toolbar', 'aria-label': 'Parts' });
  draft: Draft = starter();
  board: [number, number] = [...BOARD];
  tool: PartTool = 'select';
  selected: number | undefined;
  /** A part being dragged out. */
  preview: [Vec, Vec] | undefined;
  /** How much longer or shorter than the engine's own guess a circuit followed in time is watched for. */
  span = 1;
  private moving: number | undefined;
  private moved = false;
  private history: string[] = [];
  private future: string[] = [];
  private readonly buttons = new Map<PartTool, HTMLButtonElement>();

  constructor(private readonly changed: () => void, private readonly picked: () => void, private readonly hint: (text: string) => void) {
    for (const [tool, name, label] of TOOLS) {
      const button = iconButton(name, label, () => this.setTool(tool));
      this.buttons.set(tool, button);
      this.rail.append(button);
      if (tool === 'select' || tool === 'voltmeter') this.rail.append(el('div', { class: 'rail-divider' }));
    }
    this.rail.append(el('div', { class: 'rail-divider' }), iconButton('undo', 'Undo (Ctrl+Z)', () => this.undo()), iconButton('redo', 'Redo (Ctrl+Shift+Z)', () => this.redo()), iconButton('close', 'Clear the board', () => this.clear()));
    this.setTool('select');
  }

  setTool(tool: PartTool): void {
    this.tool = tool;
    for (const [name, button] of this.buttons) button.setAttribute('aria-pressed', String(name === tool));
    this.preview = undefined;
    this.hint(HINTS[tool]);
    this.picked();
  }

  /** Takes a scene from a scenario, a link or the last visit, keeping only what a builder has a use for. */
  load(json: string): void {
    const given = JSON.parse(json) as Draft;
    // Scenarios are drawn to their own sizes; on the board every junction sits on a dot. Each distinct x and y
    // takes the next column or row, two apart where there is room, so that what was level stays level.
    const place = (values: number[], room: number): ((v: number) => number) => {
      const distinct = [...new Set(values)].sort((a, b) => a - b);
      const step = 2 * (distinct.length - 1) <= room ? 2 : 1;
      const start = Math.max(0, Math.floor((room - step * (distinct.length - 1)) / 2));
      return (v) => start + step * distinct.indexOf(v);
    };
    const [toX, toY] = [place(given.nodes.map((n) => n[0]), BOARD[0]), place(given.nodes.map((n) => n[1]), BOARD[1])];
    // One that was built here is already on the dots, and goes back where it was.
    const onDots = given.nodes.every((n) => Number.isInteger(n[0]) && Number.isInteger(n[1]) && n[0] >= 0 && n[1] >= 0);
    const nodes = onDots ? given.nodes : given.nodes.map((n): Vec => [toX(n[0]), toY(n[1])]);
    this.board = [Math.max(BOARD[0], ...nodes.map((n) => n[0])), Math.max(BOARD[1], ...nodes.map((n) => n[1]))];
    this.draft = { schema: 1, title: 'My circuit', nodes, elements: given.elements, analysis: given.analysis, watch: given.watch };
    this.selected = undefined;
    this.history = [];
    this.future = [];
    this.tidy();
  }

  /** The scene for the engine, with how it is to be solved worked out from what is in it. */
  json(): string {
    return JSON.stringify({ ...this.draft, analysis: this.analysis(), watch: this.watching() });
  }

  private parts(kind: string): ElementSpec[] {
    return this.draft.elements.filter((e) => kindOf(e.kind) === kind);
  }

  /**
   * Steady currents unless something in the circuit changes with time. An alternating source is solved with
   * complex numbers, or stepped through a few cycles if a diode makes that impossible; a capacitor or an
   * inductor on a cell is followed for a few of its time constants.
   */
  analysis(): unknown {
    const value = <K extends string>(e: ElementSpec, kind: K, field: string): number => ((e.kind as unknown as Record<K, Record<string, number>>)[kind]?.[field] ?? 0);
    const source = this.parts('source')[0];
    if (source) {
      const frequency = value(source, 'source', 'frequency');
      if (this.parts('diode').length === 0) return { alternating: { playback: 0.25 / frequency } };
      const cycles = Math.max(1, Math.round(5 * this.span));
      return { transient: { dt: 1 / frequency / 400, duration: cycles / frequency, playback: 0.5 / frequency } };
    }
    const c = this.parts('capacitor').reduce((sum, e) => sum + value(e, 'capacitor', 'capacitance'), 0);
    const l = this.parts('inductor').reduce((sum, e) => sum + value(e, 'inductor', 'inductance'), 0);
    if (c === 0 && l === 0) return 'steady';
    const r = this.parts('resistor').reduce((sum, e) => sum + value(e, 'resistor', 'resistance'), 0) + this.parts('battery').reduce((sum, e) => sum + value(e, 'battery', 'internal'), 0);
    // A rough time for things to happen in: RC, L/R, or a period of the two swinging against each other.
    const times = [c > 0 && r > 0 ? r * c : 0, l > 0 && r > 0 ? l / r : 0, c > 0 && l > 0 ? 2 * Math.PI * Math.sqrt(l * c) : 0].filter((t) => t > 0);
    const duration = 6 * (times.length ? Math.max(...times) : 1) * this.span;
    return { transient: { dt: duration / 2000, duration, playback: duration / 8 } };
  }

  /** The parts graphed: those chosen, or failing that the ones most likely to be of interest. */
  watching(): string[] {
    const present = (this.draft.watch ?? []).filter((name) => this.draft.elements.some((e) => e.name === name));
    if (present.length > 0) return present;
    const first = (...kinds: string[]) => this.draft.elements.find((e) => kinds.includes(kindOf(e.kind)))?.name;
    const picks = this.parts('source').length ? [first('source'), first('resistor', 'capacitor', 'inductor')] : [first('capacitor', 'inductor'), first('resistor')];
    return picks.filter((name): name is string => name !== undefined);
  }

  // ---------------------------------------------------------------- the pointer

  private snap(at: Vec): Vec {
    return [Math.min(this.board[0], Math.max(0, Math.round(at[0]))), Math.min(this.board[1], Math.max(0, Math.round(at[1])))];
  }

  private partAt(at: Vec, reach: number): number | undefined {
    let best: [number, number] | undefined;
    this.draft.elements.forEach((element, i) => {
      const [a, b] = [this.draft.nodes[element.a]!, this.draft.nodes[element.b]!];
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const along = Math.min(1, Math.max(0, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      const distance = Math.hypot(at[0] - a[0] - along * dx, at[1] - a[1] - along * dy);
      // A wire is thin and a part is not, so of two under the pointer the part is the one meant.
      const weighed = distance + (element.kind === 'wire' ? 0.3 * reach : 0);
      if (distance < reach && (!best || weighed < best[1])) best = [i, weighed];
    });
    return best?.[0];
  }

  /** What is under the pointer: for the cursor. */
  over(at: Vec, reach: number): boolean {
    return this.tool !== 'select' && this.tool !== 'erase' ? true : this.partAt(at, reach) !== undefined || this.draft.nodes.some((n) => Math.hypot(n[0] - at[0], n[1] - at[1]) < reach);
  }

  press(at: Vec, reach: number): void {
    if (this.tool === 'select') {
      const node = this.draft.nodes.findIndex((n) => Math.hypot(n[0] - at[0], n[1] - at[1]) < 0.6 * reach);
      if (node >= 0) {
        this.moving = node;
        this.moved = false;
        return;
      }
      this.selected = this.partAt(at, reach);
      this.picked();
    } else if (this.tool === 'erase') {
      const part = this.partAt(at, reach);
      if (part !== undefined) this.remove(part);
    } else {
      const from = this.snap(at);
      this.preview = [from, from];
    }
  }

  dragTo(at: Vec): void {
    if (this.preview) this.preview = [this.preview[0], this.snap(at)];
    if (this.moving !== undefined) {
      const to = this.snap(at);
      if (same(to, this.draft.nodes[this.moving]!)) return;
      if (!this.moved) this.checkpoint();
      this.moved = true;
      this.draft.nodes[this.moving] = to;
      this.changed();
    }
  }

  release(): void {
    if (this.moving !== undefined) {
      this.moving = undefined;
      if (this.moved) {
        this.tidy();
        this.changed();
      }
    }
    const drawn = this.preview;
    this.preview = undefined;
    if (!drawn || same(drawn[0], drawn[1]) || this.tool === 'select' || this.tool === 'erase') return;
    this.checkpoint();
    const [prefix, make] = NEW[this.tool];
    const node = (at: Vec) => {
      const found = this.draft.nodes.findIndex((n) => same(n, at));
      return found >= 0 ? found : this.draft.nodes.push(at) - 1;
    };
    const [a, b] = [node(drawn[0]), node(drawn[1])];
    let n = 1;
    while (this.draft.elements.some((e) => e.name === `${prefix}${n}`)) n++;
    this.draft.elements.push({ name: `${prefix}${n}`, a, b, kind: make() });
    this.selected = this.tool === 'wire' ? undefined : this.draft.elements.length - 1;
    this.picked();
    this.changed();
  }

  // ---------------------------------------------------------------- edits

  private checkpoint(): void {
    this.history.push(JSON.stringify(this.draft));
    if (this.history.length > 100) this.history.shift();
    this.future = [];
  }

  private restore(from: string[], to: string[]): void {
    const state = from.pop();
    if (!state) return;
    to.push(JSON.stringify(this.draft));
    this.draft = JSON.parse(state) as Draft;
    this.selected = undefined;
    this.picked();
    this.changed();
  }

  undo(): void {
    this.restore(this.history, this.future);
  }

  redo(): void {
    this.restore(this.future, this.history);
  }

  /** Junctions moved onto one another become one; a part with both ends at one junction, and a junction nothing is joined to, go. */
  private tidy(): void {
    const { nodes } = this.draft;
    const stands = nodes.map((n, i) => nodes.findIndex((m) => same(m, n)) ?? i);
    const chosen = this.selected === undefined ? undefined : this.draft.elements[this.selected];
    let elements = this.draft.elements.map((e) => ({ ...e, a: stands[e.a]!, b: stands[e.b]! })).filter((e) => e.a !== e.b);
    const used = [...new Set(elements.flatMap((e) => [e.a, e.b]))].sort((x, y) => x - y);
    elements = elements.map((e) => ({ ...e, a: used.indexOf(e.a), b: used.indexOf(e.b) }));
    this.draft.nodes = used.map((i) => nodes[i]!);
    this.draft.elements = elements;
    const again = chosen ? elements.findIndex((e) => e.name === chosen.name) : -1;
    this.selected = again >= 0 ? again : undefined;
  }

  remove(index: number): void {
    this.checkpoint();
    this.draft.elements.splice(index, 1);
    this.selected = undefined;
    this.tidy();
    this.picked();
    this.changed();
  }

  clear(): void {
    this.checkpoint();
    this.draft = { ...this.draft, nodes: [], elements: [], watch: [] };
    this.selected = undefined;
    this.picked();
    this.changed();
  }

  /** Changes the part picked out; one change of a slider is one step of undo, however far it is dragged. */
  private lastEdit = { key: '', time: 0 };
  private edit(key: string, change: (element: ElementSpec) => void): void {
    const element = this.selected === undefined ? undefined : this.draft.elements[this.selected];
    if (!element) return;
    const now = performance.now();
    if (key !== this.lastEdit.key || now - this.lastEdit.time > 800) this.checkpoint();
    this.lastEdit = { key, time: now };
    change(element);
    this.changed();
  }

  /** The panel for the part picked out; with nothing picked, for the circuit as a whole. */
  properties(transient: boolean): HTMLElement | undefined {
    const element = this.selected === undefined ? undefined : this.draft.elements[this.selected];
    if (!element) {
      if (!transient) return undefined;
      return el('div', { class: 'properties' }, [
        el('div', { class: 'properties-head' }, [el('b', { text: 'Followed in time' })]),
        slider({ label: 'How long it is watched for', min: 0.2, max: 5, step: 0.1, value: this.span, format: (v) => `×${formatNumber(v, 2)}`, onInput: (v) => ((this.span = v), this.changed()) }).root,
      ]);
    }
    const index = this.selected!;
    const kind = element.kind;
    const rows: HTMLElement[] = [];
    // A slider in the unit a person would say the value in, stored in the unit the engine works in.
    const quantity = (label: string, unit: string, per: number, range: [number, number, number], hard: [number, number], get: () => number, set: (v: number) => void) =>
      rows.push(
        slider({
          label,
          min: range[0],
          max: range[1],
          step: range[2],
          hardMin: hard[0],
          hardMax: hard[1],
          value: get() / per,
          format: (v) => (unit ? formatPrefixed(v * per, unit) : formatNumber(v)),
          onInput: (v) => this.edit(label, () => set(v * per)),
        }).root,
      );
    if (typeof kind !== 'string') {
      if ('resistor' in kind) quantity('Resistance', 'Ω', 1, [1, 1000, 1], [1e-3, 1e8], () => kind.resistor.resistance, (v) => (kind.resistor.resistance = v));
      if ('battery' in kind) {
        quantity('EMF', 'V', 1, [0, 24, 0.5], [0, 1e4], () => kind.battery.emf, (v) => (kind.battery.emf = v));
        quantity('Internal resistance', 'Ω', 1, [0, 5, 0.1], [0, 1e4], () => kind.battery.internal ?? 0, (v) => (kind.battery.internal = v));
      }
      if ('capacitor' in kind) {
        quantity('Capacitance', 'F', 1e-6, [1, 1000, 1], [1e-6, 1e7], () => kind.capacitor.capacitance, (v) => (kind.capacitor.capacitance = v));
        quantity('Voltage on it at the start', 'V', 1, [0, 24, 0.5], [-1e4, 1e4], () => kind.capacitor.initial_voltage ?? 0, (v) => (kind.capacitor.initial_voltage = v));
      }
      if ('inductor' in kind) quantity('Inductance', 'H', 1e-3, [1, 1000, 1], [1e-3, 1e7], () => kind.inductor.inductance, (v) => (kind.inductor.inductance = v));
      if ('source' in kind) {
        quantity('Peak voltage', 'V', 1, [1, 24, 0.5], [1e-3, 1e5], () => kind.source.amplitude, (v) => (kind.source.amplitude = v));
        quantity('Frequency', 'Hz', 1, [1, 1000, 1], [1e-2, 1e7], () => kind.source.frequency, (v) => (kind.source.frequency = v));
      }
      if ('switch' in kind) {
        rows.push(choice('The switch is', [{ label: 'Closed', value: 1 }, { label: 'Open', value: 0 }], kind.switch.closed ? 1 : 0, (v) => this.edit('switch', () => (kind.switch.closed = v === 1))));
      }
      if ('diode' in kind) {
        const which = kind.diode.breakdown ? 2 : (kind.diode.saturation ?? 0) > 1e-9 ? 1 : 0;
        rows.push(
          choice('Kind', [{ label: 'Silicon', value: 0 }, { label: 'Germanium', value: 1 }, { label: 'Zener', value: 2 }], which, (v) => {
            this.edit('diode', () => (kind.diode = v === 1 ? { saturation: 1e-6 } : v === 2 ? { breakdown: 5.1 } : {}));
            this.picked();
          }),
        );
        if (kind.diode.breakdown) quantity('Zener voltage', 'V', 1, [2, 15, 0.1], [0.5, 500], () => kind.diode.breakdown!, (v) => (kind.diode.breakdown = v));
      }
    }
    const what = kindOf(kind);
    if (['battery', 'diode', 'source', 'ammeter', 'voltmeter', 'capacitor'].includes(what)) {
      const turn = el('button', { type: 'button', class: 'text-button outlined', text: 'Turn it round' });
      turn.addEventListener('click', () => this.edit(`turn ${performance.now()}`, (e) => ([e.a, e.b] = [e.b, e.a])));
      rows.push(turn);
    }
    if (!['wire', 'ammeter', 'voltmeter', 'switch'].includes(what)) {
      const graphed = this.watching().includes(element.name);
      const graph = el('button', { type: 'button', class: 'text-button outlined', text: graphed ? 'Take it off the graph' : 'Put it on the graph' });
      graph.addEventListener('click', () => {
        const now = this.watching();
        this.draft.watch = graphed ? now.filter((n) => n !== element.name) : [...now, element.name].slice(-4);
        this.picked();
        this.changed();
      });
      rows.push(graph);
    }
    const title = { wire: 'A wire', ammeter: 'An ammeter', voltmeter: 'A voltmeter' }[what] ?? element.name;
    return el('div', { class: 'properties' }, [el('div', { class: 'properties-head' }, [el('b', { text: title }), iconButton('erase', 'Remove it (Delete)', () => this.remove(index))]), ...rows]);
  }
}
