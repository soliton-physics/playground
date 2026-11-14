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
  return '';
}

/** Draws a circuit diagram with the textbook's symbols, and charges drifting round it with the current. */
export class Schematic {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  /** Screen pixels the floating panels cover on each side. */
  insets = { left: 16, right: 16, top: 16, bottom: 16 };
  private scale = 1;
  private origin: Vec = [0, 0];
  private centre: Vec = [0, 0];

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
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const { left, right, top, bottom } = this.insets;
    const margin = plain ? 10 : 64 * stageScale();
    // A component standing upright has its name to its right, so that side is given more room.
    const aside = plain ? 0 : 96 * stageScale();
    const [w, h] = [Math.max(60, this.width - left - right - 2 * margin - aside), Math.max(60, this.height - top - bottom - 2 * margin)];
    this.scale = Math.min(w / Math.max(x1 - x0, 1e-9), h / Math.max(y1 - y0, 1e-9), plain ? 1e9 : 150 * stageScale());
    this.centre = [(x0 + x1) / 2, (y0 + y1) / 2];
    this.origin = [left + margin + w / 2, top + margin + h / 2];
  }

  draw(frame: SchematicFrame, plain = false): void {
    const { ctx } = this;
    const { scene } = frame;
    this.fit(scene, plain);
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.fillRect(0, 0, this.width, this.height);
    scene.elements.forEach((element, i) => this.element(element, scene, frame.readings[2 * i] ?? 0, frame.readings[2 * i + 1] ?? 0, plain));
    if (!plain) scene.elements.forEach((element, i) => this.charges(element, scene, frame.readings[2 * i + 1] ?? 0, frame.drift[i] ?? 0));
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
    const reading = kind === 'ammeter' || kind === 'galvanometer' ? formatPrefixed(current, 'A') : kind === 'voltmeter' ? formatPrefixed(voltage, 'V') : valueOf(element);
    const name = letter ? '' : element.name;
    const text = [name, reading].filter(Boolean).join('  ');
    const off = 28 * k;
    ctx.font = stageFont(13, 600);
    ctx.fillStyle = cssVar(letter ? '--accent' : '--text');
    ctx.textBaseline = 'middle';
    ctx.textAlign = upright ? 'left' : 'center';
    ctx.fillText(text, upright ? mx + off * 0.75 : mx, upright ? my : my - off);
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
    const clear = kind === 'capacitor' ? 7 * k : ['ammeter', 'voltmeter', 'galvanometer', 'source'].includes(kind) ? 16 * k : 0;
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
