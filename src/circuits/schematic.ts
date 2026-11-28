import { cssVar, formatNumber, formatPrefixed, stageFont, stageScale } from '../ui';
import { kindOf, type CircuitSceneFile, type ElementSpec, type Vec } from './types';

export interface SchematicFrame {
  scene: CircuitSceneFile;
  /** `voltage, current` for each component. */
  readings: Float64Array;
  /** How far the charges have drifted along each component, in pixels. */
  drift: Float64Array;
  /** A point on the page where a sliding contact can be dragged, and whether it is held. */
  jockey?: { at: Vec; active: boolean };
  /** Marks for a circuit that is being built. */
  edit?: EditMarks;
  /** What each part's meter face should read, `voltage, current`, as the readings table gives them; and whether they are peaks. */
  shown?: [number, number][];
  peaks?: boolean;
}

export interface EditMarks {
  selected?: number;
  /** A part being dragged out, from one grid point to another. */
  preview?: [Vec, Vec];
  /** Parts to point at because the circuit cannot be solved as they stand. */
  culprits?: number[];
}

/** What a component is worth, in words for the page: "12 Ω", "100 μF". */
export function valueOf(element: ElementSpec): string {
  const kind = element.kind;
  if (typeof kind === 'string') return '';
  if ('resistor' in kind) return formatPrefixed(kind.resistor.resistance, 'Ω');
  if ('galvanometer' in kind) return '';
  if ('battery' in kind) return `${formatNumber(Math.abs(kind.battery.emf))} V${kind.battery.internal ? `, r = ${formatNumber(kind.battery.internal)} Ω` : ''}`;
  if ('capacitor' in kind) return formatPrefixed(kind.capacitor.capacitance, 'F');
  if ('inductor' in kind) return formatPrefixed(kind.inductor.inductance, 'H');
  if ('source' in kind) return `${formatNumber(kind.source.amplitude)} V peak, ${formatNumber(kind.source.frequency)} Hz`;
  if ('diode' in kind) return kind.diode.breakdown ? `${formatNumber(kind.diode.breakdown)} V` : (kind.diode.saturation ?? 0) > 1e-9 ? 'germanium' : 'silicon';
  return '';
}

/** Draws a circuit diagram with the textbook's symbols, and charges drifting round it with the current. */
export class Schematic {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  /** Screen pixels the floating panels cover on each side. */
  insets = { left: 16, right: 16, top: 16, bottom: 16 };
  /** The region of the page to frame, `[left, bottom, right, top]` in squares, whatever is on it: for a circuit being built. */
  board?: [number, number, number, number];
  private scale = 1;
  private origin: Vec = [0, 0];
  private centre: Vec = [0, 0];
  /** The framing that shows the whole circuit, before the viewer zooms or moves it. */
  private fitted = { scale: 1, origin: [0, 0] as Vec };
  /** How far the viewer has zoomed in from that framing, and moved it, in screen pixels. */
  private zoom = 1;
  private pan: Vec = [0, 0];

  constructor(private readonly canvas: HTMLCanvasElement, observe = true) {
    this.ctx = canvas.getContext('2d')!;
    if (observe) new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize(): void {
    const ratio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  toScreen([x, y]: Vec): Vec {
    return [this.origin[0] + (x - this.centre[0]) * this.scale, this.origin[1] - (y - this.centre[1]) * this.scale];
  }

  toPage([sx, sy]: Vec): Vec {
    return [this.centre[0] + (sx - this.origin[0]) / this.scale, this.centre[1] - (sy - this.origin[1]) / this.scale];
  }

  /** Frames the whole diagram in the part of the stage the panels leave free. */
  private fit(scene: CircuitSceneFile, plain: boolean): void {
    const xs = scene.nodes.map((n) => n[0]);
    const ys = scene.nodes.map((n) => n[1]);
    const [x0, x1, y0, y1] = this.board ? [this.board[0], this.board[2], this.board[1], this.board[3]] : [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const { left, right, top, bottom } = this.insets;
    // Margins in proportion on a small screen, where the desktop's would leave no room for the circuit.
    const margin = plain ? 10 : Math.min(64 * stageScale(), 0.07 * this.width);
    // A component standing upright has its name to its right, so that side is given more room.
    const aside = plain ? 0 : Math.min(96 * stageScale(), 0.18 * this.width);
    const [w, h] = [Math.max(60, this.width - left - right - 2 * margin - aside), Math.max(60, this.height - top - bottom - 2 * margin)];
    const scale = Math.min(w / Math.max(x1 - x0, 1e-9), h / Math.max(y1 - y0, 1e-9), plain ? 1e9 : 150 * stageScale());
    this.centre = [(x0 + x1) / 2, (y0 + y1) / 2];
    this.fitted = { scale, origin: [left + margin + w / 2, top + margin + h / 2] };
    // A thumbnail is always the whole circuit; the stage keeps whatever zoom and position the viewer chose.
    const [zoom, pan]: [number, Vec] = plain ? [1, [0, 0]] : [this.zoom, this.pan];
    this.scale = scale * zoom;
    this.origin = [this.fitted.origin[0] + pan[0], this.fitted.origin[1] + pan[1]];
  }

  /** Zooms by `factor` about a point on the screen, which stays where it is. */
  zoomAt([sx, sy]: Vec, factor: number): void {
    const [x, y] = this.toPage([sx, sy]);
    this.zoom = Math.min(6, Math.max(0.3, this.zoom * factor));
    const scale = this.fitted.scale * this.zoom;
    this.pan = [sx - this.fitted.origin[0] - (x - this.centre[0]) * scale, sy - this.fitted.origin[1] + (y - this.centre[1]) * scale];
    this.scale = scale;
    this.origin = [this.fitted.origin[0] + this.pan[0], this.fitted.origin[1] + this.pan[1]];
  }

  /** Moves the view by screen pixels. */
  panBy(dx: number, dy: number): void {
    this.pan = [this.pan[0] + dx, this.pan[1] + dy];
    this.origin = [this.origin[0] + dx, this.origin[1] + dy];
  }

  /** Back to the framing that shows the whole circuit. */
  resetView(): void {
    this.zoom = 1;
    this.pan = [0, 0];
  }

  /** Whether the viewer has zoomed or moved away from the whole-circuit framing. */
  get moved(): boolean {
    return this.zoom !== 1 || this.pan[0] !== 0 || this.pan[1] !== 0;
  }

  draw(frame: SchematicFrame, plain = false): void {
    const { ctx } = this;
    const { scene } = frame;
    this.fit(scene, plain);
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.fillRect(0, 0, this.width, this.height);
    if (frame.edit && this.board) this.grid(scene, frame.edit);
    this.peaks = frame.peaks === true;
    scene.elements.forEach((element, i) =>
      this.element(element, scene, frame.shown?.[i]?.[0] ?? frame.readings[2 * i] ?? 0, frame.shown?.[i]?.[1] ?? frame.readings[2 * i + 1] ?? 0, plain),
    );
    // No charges where the current is only the arithmetic's dust, such as through a diode that is off.
    const top = scene.elements.reduce((most, _, i) => Math.max(most, Math.abs(frame.readings[2 * i + 1] ?? 0)), 0);
    if (!plain) scene.elements.forEach((element, i) => Math.abs(frame.readings[2 * i + 1] ?? 0) > 1e-6 * top && this.charges(element, scene, frame.readings[2 * i + 1] ?? 0, frame.drift[i] ?? 0));
    // A dot where three or more components meet: wires that merely cross would have none.
    const meets = new Map<number, number>();
    for (const e of scene.elements) for (const n of [e.a, e.b]) meets.set(n, (meets.get(n) ?? 0) + 1);
    ctx.fillStyle = cssVar('--canvas-rope');
    for (const [node, count] of meets) {
      if (count < 3) continue;
      const [sx, sy] = this.toScreen(scene.nodes[node]!);
      ctx.beginPath();
      ctx.arc(sx, sy, (plain ? 2 : 4) * stageScale(), 0, 2 * Math.PI);
      ctx.fill();
    }
    if (frame.jockey) this.jockey(frame.jockey.at, frame.jockey.active);
    if (!plain) this.placeLabels(scene);
  }

  private element(element: ElementSpec, scene: CircuitSceneFile, voltage: number, current: number, plain: boolean): void {
    const { ctx } = this;
    const k = plain ? 0.55 : stageScale();
    const [a, b] = [this.toScreen(scene.nodes[element.a]!), this.toScreen(scene.nodes[element.b]!)];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-6) return;
    const kind = kindOf(element.kind);
    const spec = element.kind;
    const ink = cssVar('--canvas-rope');
    ctx.save();
    ctx.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 2 * k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const half = length / 2;
    const lead = (to: number) => {
      ctx.beginPath();
      ctx.moveTo(-half, 0);
      ctx.lineTo(-to, 0);
      ctx.moveTo(to, 0);
      ctx.lineTo(half, 0);
      ctx.stroke();
    };
    const resistanceWire = typeof spec !== 'string' && 'resistor' in spec && spec.resistor.length_of_wire;
    if (kind === 'wire') {
      lead(0);
    } else if (resistanceWire) {
      ctx.strokeStyle = cssVar('--bath');
      ctx.lineWidth = 4.5 * k;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(-half, 0);
      ctx.lineTo(half, 0);
      ctx.stroke();
    } else if (kind === 'resistor') {
      const s = Math.min(26 * k, 0.4 * half);
      lead(s);
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      const teeth = 6;
      for (let i = 0; i < teeth; i++) ctx.lineTo(-s + ((i + 0.5) * 2 * s) / teeth, (i % 2 ? 1 : -1) * 7.5 * k);
      ctx.lineTo(s, 0);
      ctx.stroke();
    } else if (kind === 'battery' || kind === 'capacitor') {
      const gap = (kind === 'battery' ? 4.5 : 5.5) * k;
      lead(gap);
      // A cell's positive plate is the long thin one, at its `a` end unless its EMF is given as negative.
      const flipped = typeof spec !== 'string' && 'battery' in spec && spec.battery.emf < 0;
      const long = flipped ? gap : -gap;
      ctx.beginPath();
      if (kind === 'battery') {
        ctx.moveTo(long, -15 * k);
        ctx.lineTo(long, 15 * k);
        ctx.stroke();
        ctx.lineWidth = 4.5 * k;
        ctx.beginPath();
        ctx.moveTo(-long, -8 * k);
        ctx.lineTo(-long, 8 * k);
      } else {
        ctx.moveTo(-gap, -14 * k);
        ctx.lineTo(-gap, 14 * k);
        ctx.moveTo(gap, -14 * k);
        ctx.lineTo(gap, 14 * k);
      }
      ctx.stroke();
    } else if (kind === 'inductor') {
      const s = Math.min(28 * k, 0.4 * half);
      lead(s);
      ctx.beginPath();
      const loops = 4;
      for (let i = 0; i < loops; i++) ctx.arc(-s + ((i + 0.5) * 2 * s) / loops, 0, s / loops, Math.PI, 0);
      ctx.stroke();
    } else if (kind === 'diode') {
      // An arrowhead pointing the way it conducts, against a bar; a Zener's bar has its ends bent.
      const s = 10 * k;
      lead(s);
      ctx.beginPath();
      ctx.moveTo(-s, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(-s, s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const zener = typeof spec !== 'string' && 'diode' in spec && typeof spec.diode.breakdown === 'number';
      ctx.lineWidth = 2.5 * k;
      ctx.beginPath();
      if (zener) ctx.moveTo(s + 5 * k, -s - 4 * k);
      else ctx.moveTo(s, -s);
      ctx.lineTo(s, -s);
      ctx.lineTo(s, s);
      if (zener) ctx.lineTo(s - 5 * k, s + 4 * k);
      ctx.stroke();
    } else if (kind === 'switch') {
      const s = 15 * k;
      lead(s);
      const closed = typeof spec !== 'string' && 'switch' in spec && spec.switch.closed === true;
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(closed ? s : s * 0.75, closed ? 0 : -s * 0.85);
      ctx.stroke();
      for (const x of [-s, s]) {
        ctx.beginPath();
        ctx.arc(x, 0, 3 * k, 0, 2 * Math.PI);
        ctx.fill();
      }
    } else {
      // Meters and the alternating source are circles with a mark inside.
      const r = 15 * k;
      lead(r);
      ctx.fillStyle = cssVar('--surface');
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      if (kind === 'source') {
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const x = -r * 0.6 + (i / 24) * r * 1.2;
          const y = -Math.sin((i / 24) * 2 * Math.PI) * r * 0.38;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    if (plain) return;

    const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const upright = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
    const letter = { ammeter: 'A', voltmeter: 'V', galvanometer: 'G' }[kind];
    if (letter) {
      ctx.fillStyle = ink;
      ctx.font = stageFont(15, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, mx, my + 1);
    }
    if (kind === 'wire' || resistanceWire) return;
    // Its name and what it is worth; for a meter, what it reads.
    const peak = this.peaks ? ' peak' : '';
    const reading = kind === 'ammeter' || kind === 'galvanometer' ? formatPrefixed(current, 'A') + peak : kind === 'voltmeter' ? formatPrefixed(voltage, 'V') + peak : valueOf(element);
    const name = letter ? '' : element.name;
    const text = [name, reading].filter(Boolean).join('  ');
    // Beside an upright component a long description goes on two lines, so as not to run into its neighbour.
    const [first, ...rest] = upright ? text.split(', ') : [text];
    this.labels.push({ lines: rest.length ? [first!, rest.join(', ')] : [text], colour: cssVar(letter ? '--accent' : '--text'), at: [mx, my], upright, off: 28 * k, part: [a, b] });
  }

  /** Whether meters read peaks, on alternating current. */
  private peaks = false;

  /** Labels waiting to be placed, once every part is drawn and the free spaces are known. */
  private labels: { lines: string[]; colour: string; at: Vec; upright: boolean; off: number; part: [Vec, Vec] }[] = [];

  /**
   * Places each part's label where it collides with nothing: beside an upright part on the right, or else the left;
   * above a level one, or else below. Labels already placed and every part's line count as taken. Where nothing is
   * free, the place least in the way, with a halo behind the text so it can still be read.
   */
  private placeLabels(scene: CircuitSceneFile): void {
    const { ctx } = this;
    const k = stageScale();
    const lineHeight = 17 * k;
    ctx.font = stageFont(13, 600);
    ctx.textBaseline = 'middle';
    const parts = scene.elements.map((e): [Vec, Vec] => [this.toScreen(scene.nodes[e.a]!), this.toScreen(scene.nodes[e.b]!)]);
    const taken: [number, number, number, number][] = [];
    /** How much of a box the parts' lines and the labels placed so far cover, in a rough count of points. */
    const clash = ([x0, y0, x1, y1]: [number, number, number, number], own: [Vec, Vec]): number => {
      let hits = 0;
      // A part is as wide as its symbol, not its line: a resistor's zigzag and a cell's plates stand out from it.
      const pad = 14 * k;
      for (const [a, b] of parts) {
        if (a[0] === own[0][0] && a[1] === own[0][1] && b[0] === own[1][0] && b[1] === own[1][1]) continue;
        for (let t = 0; t <= 1; t += 1 / 24) {
          const [x, y] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          if (x >= x0 - pad && x <= x1 + pad && y >= y0 - pad && y <= y1 + pad) hits++;
        }
      }
      for (const [u0, v0, u1, v1] of taken) {
        const w = Math.max(0, Math.min(x1, u1) - Math.max(x0, u0));
        const h = Math.max(0, Math.min(y1, v1) - Math.max(y0, v0));
        hits += (w * h) / 40;
      }
      return hits;
    };
    for (const label of this.labels) {
      const width = Math.max(...label.lines.map((l) => ctx.measureText(l).width));
      const height = lineHeight * label.lines.length;
      const [mx, my] = label.at;
      const gap = label.off * 0.75;
      // Each candidate: the box it would take, and where its text starts and how it is aligned.
      const spots: { box: [number, number, number, number]; x: number; align: CanvasTextAlign; y: number }[] = label.upright
        ? [
            { box: [mx + gap, my - height / 2, mx + gap + width, my + height / 2], x: mx + gap, align: 'left', y: my },
            { box: [mx - gap - width, my - height / 2, mx - gap, my + height / 2], x: mx - gap, align: 'right', y: my },
          ]
        : [
            { box: [mx - width / 2, my - label.off - height / 2, mx + width / 2, my - label.off + height / 2], x: mx, align: 'center', y: my - label.off },
            { box: [mx - width / 2, my + label.off - height / 2, mx + width / 2, my + label.off + height / 2], x: mx, align: 'center', y: my + label.off },
          ];
      let best = spots[0]!;
      let least = Infinity;
      for (const spot of spots) {
        const c = clash(spot.box, label.part);
        if (c < least) [best, least] = [spot, c];
        if (c === 0) break;
      }
      taken.push(best.box);
      ctx.textAlign = best.align;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = cssVar('--canvas-bg');
      ctx.lineWidth = 4 * k;
      ctx.fillStyle = label.colour;
      label.lines.forEach((text, i) => {
        const y = best.y + (i - (label.lines.length - 1) / 2) * lineHeight;
        if (least > 0) ctx.strokeText(text, best.x, y);
        ctx.fillText(text, best.x, y);
      });
    }
    this.labels = [];
  }

  /** How many pixels one square of the page is drawn as. */
  get unit(): number {
    return this.scale;
  }

  /** What a circuit being built has under it: the dots parts snap to, the part picked out, and one being drawn. */
  private grid(scene: CircuitSceneFile, edit: EditMarks): void {
    const { ctx } = this;
    const k = stageScale();
    // Dots over everything on screen, so a part can be placed wherever the view has been moved to. Too small to aim
    // at, they are left out.
    ctx.fillStyle = cssVar('--canvas-grid-major');
    if (this.scale >= 14) {
      const [left, top] = this.toPage([0, 0]);
      const [right, bottom] = this.toPage([this.width, this.height]);
      for (let x = Math.floor(left); x <= Math.ceil(right); x++) {
        for (let y = Math.floor(bottom); y <= Math.ceil(top); y++) {
          const [sx, sy] = this.toScreen([x, y]);
          ctx.beginPath();
          ctx.arc(sx, sy, 2.2 * k, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
    const line = (from: Vec, to: Vec) => {
      const [a, b] = [this.toScreen(from), this.toScreen(to)];
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    };
    // The parts that stop the circuit being solved, under a warm glow.
    for (const i of edit.culprits ?? []) {
      const part = scene.elements[i];
      if (!part) continue;
      ctx.strokeStyle = cssVar('--warning-soft');
      ctx.lineWidth = 22 * k;
      ctx.lineCap = 'round';
      line(scene.nodes[part.a]!, scene.nodes[part.b]!);
    }
    const chosen = edit.selected === undefined ? undefined : scene.elements[edit.selected];
    if (chosen) {
      ctx.strokeStyle = cssVar('--accent-soft');
      ctx.lineWidth = 30 * k;
      ctx.lineCap = 'round';
      line(scene.nodes[chosen.a]!, scene.nodes[chosen.b]!);
    }
    if (edit.preview) {
      ctx.strokeStyle = cssVar('--accent');
      ctx.lineWidth = 2.5 * k;
      ctx.setLineDash([7 * k, 6 * k]);
      line(edit.preview[0], edit.preview[1]);
      ctx.setLineDash([]);
    }
    // Every junction, so that it is plain where a new part will join on.
    ctx.strokeStyle = cssVar('--accent');
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.lineWidth = 2 * k;
    for (const node of scene.nodes) {
      const [sx, sy] = this.toScreen(node);
      ctx.beginPath();
      ctx.arc(sx, sy, 5 * k, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }

  /** Charges on their way round: dots that move the way conventional current flows, faster for more of it. */
  private charges(element: ElementSpec, scene: CircuitSceneFile, current: number, drift: number): void {
    if (Math.abs(current) < 1e-12) return;
    const { ctx } = this;
    const k = stageScale();
    const [a, b] = [this.toScreen(scene.nodes[element.a]!), this.toScreen(scene.nodes[element.b]!)];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const spacing = 26 * k;
    const kind = kindOf(element.kind);
    // Nothing passes between a capacitor's plates, and a meter's face is kept clear to read.
    const clear = kind === 'capacitor' ? 7 * k : kind === 'diode' ? 12 * k : ['ammeter', 'voltmeter', 'galvanometer', 'source'].includes(kind) ? 16 * k : 0;
    ctx.fillStyle = cssVar('--ray');
    const start = ((drift % spacing) + spacing) % spacing;
    for (let s = start; s < length; s += spacing) {
      if (Math.abs(s - length / 2) < clear) continue;
      ctx.beginPath();
      ctx.arc(a[0] + ((b[0] - a[0]) * s) / length, a[1] + ((b[1] - a[1]) * s) / length, 2.6 * k, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  /** The sliding contact of a bridge or potentiometer: an arrowhead pressed on the wire. */
  private jockey(at: Vec, active: boolean): void {
    const { ctx } = this;
    const k = stageScale();
    const [sx, sy] = this.toScreen(at);
    ctx.fillStyle = cssVar('--accent');
    ctx.beginPath();
    ctx.moveTo(sx, sy - 2 * k);
    ctx.lineTo(sx - 8 * k, sy - 17 * k);
    ctx.lineTo(sx + 8 * k, sy - 17 * k);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, (active ? 8 : 6.5) * k, 0, 2 * Math.PI);
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.fill();
    ctx.lineWidth = 2.5 * k;
    ctx.strokeStyle = cssVar('--accent');
    ctx.stroke();
  }
}
