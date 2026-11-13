import { clamp, cssVar, formatLength, formatNumber, formatPrefixed, paint, stageFont, stageScale } from '../../ui';
import { STATE_STRIDE, type BodyInfo, type DistributionInfo, type FieldInfo, type ForceInfo, type GrabInfo, type SketchInfo, type SurfaceSpec } from '../types';
import { Camera, type Box } from './camera';

export interface Frame {
  bodies: BodyInfo[];
  state: Float64Array;
  sketches: SketchInfo[];
  forces: ForceInfo[];
  time: number;
  focus: number;
  showForces: boolean;
  showVelocity: boolean;
  showAcceleration: boolean;
  showTrail: boolean;
  /** Uniform electric and magnetic fields to draw behind everything. */
  fields?: FieldInfo[];
  /** Field lines of the charges: `x, y` pairs, each line closed by a pair of NaNs. */
  fieldLines?: Float64Array;
  /** Lines of the magnetic field of bar magnets, in the same form. */
  magneticLines?: Float64Array;
  /** The magnetic field in the plane at a point, T: a lattice of compass needles is drawn from it. */
  needles?: (x: number, y: number) => [number, number];
  /** Fixed wires, sheets and shells of charge. */
  distributions?: DistributionInfo[];
  /** A closed surface the flux is totalled through. */
  surface?: SurfaceSpec;
  grab?: GrabInfo | null;
  /** Bodies drawn with a selection ring, for the sandbox. */
  selected?: number[];
  /** No metre labels: for thumbnails. */
  plain?: boolean;
  /** Extra drawing in world space after the bodies: handles, a rope being placed. */
  overlay?: (painter: Painter) => void;
}

const FORCE_TOKENS: Record<string, string> = {
  gravity: '--force-gravity',
  normal: '--force-normal',
  friction: '--force-friction',
  tension: '--force-tension',
  applied: '--force-applied',
  driving: '--force-applied',
  spring: '--force-spring',
  electric: '--force-electric',
  magnetic: '--force-magnetic',
};

/** The theme token for a force's colour: the same one wherever that force is drawn or listed. */
export function forceColor(label: string): string {
  return FORCE_TOKENS[label] ?? '--force-other';
}

/** Velocity and acceleration are drawn in ink and told apart by their heads, which leaves colour to the forces. */
export const MOTION_COLOR = '--motion';
/** Anything on the stage that can be dragged. */
export const KNOB_COLOR = '--accent';

/** A force has a solid head, a velocity an open one, an acceleration two. */
export type ArrowStyle = 'force' | 'velocity' | 'acceleration';

/**
 * The length an arrow is drawn at, in pixels, for one that would be `length` to scale. Below `least` it is held
 * there so a small force beside a large one can still be seen and told apart; its label carries the real size.
 * It shrinks to nothing over the last few pixels so an arrow does not pop in as a body starts to move.
 */
function legible(length: number, least: number): number {
  const fade = 3;
  return length >= least ? length : least * Math.min(1, length / fade);
}

/**
 * Metres of arrow per m/s and per m/s². Shared with the knobs that set a launch velocity. The defaults suit a
 * scene a few metres across; `fitArrows` changes them for one that is not.
 */
export const scales = { velocity: 0.25, acceleration: 0.12 };

/**
 * Chooses arrow lengths for a scene `extent` metres from centre to edge, given the fastest speed and largest
 * acceleration in it at the start. The usual lengths are kept whenever they are visible and fit; a satellite at
 * 7 km/s in a view 16 000 km across needs something else.
 */
export function fitArrows(extent: number, speed: number, acceleration: number): void {
  const fit = (usual: number, largest: number) => {
    const length = usual * largest;
    return largest > 0 && (length < 0.05 * extent || length > 0.6 * extent) ? (0.3 * extent) / largest : usual;
  };
  scales.velocity = fit(0.25, speed);
  scales.acceleration = fit(0.12, acceleration);
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What overlays draw with: the context, the camera and a few shapes in world coordinates. */
export interface Painter {
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  knob(x: number, y: number, color: string, active?: boolean): void;
  arrow(x: number, y: number, vx: number, vy: number, scale: number, color: string, label: string, style?: ArrowStyle): void;
  dashed(points: [number, number][], color: string): void;
  label(text: string, x: number, y: number, color: string): void;
}

/** Draws the world: grid, bodies, ropes and springs, motion vectors and the free-body diagram. */
export class Renderer implements Painter {
  readonly camera = new Camera();
  readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private trail: [number, number][] = [];
  private labels: Rect[] = [];
  /** The largest each electric field has been, for drawing one that alternates. */
  private strongest = new Map<string, number>();
  /** Where the metre labels down the left edge go, and the height below which they are clear of the panels. */
  axis = { left: 8, clearTop: 0 };

  constructor(readonly canvas: HTMLCanvasElement, observe = true) {
    this.ctx = canvas.getContext('2d')!;
    if (observe) new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  /**
   * How a body appears at the current zoom. A ball under five pixels in radius is drawn as a dot of that size so it
   * can still be seen and picked, which means its drawn size no longer says anything about its real one.
   */
  drawnAsDot(body: BodyInfo): boolean {
    const shape = body.shape;
    if (shape.kind === 'circle') return shape.radius * this.camera.scale < 5;
    if (shape.kind === 'polygon') return Math.max(...shape.vertices.map(([x, y]) => Math.hypot(x, y))) * this.camera.scale < 2.5;
    return false;
  }

  clearTrail(): void {
    this.trail = [];
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
    this.camera.resize(rect.width, rect.height);
  }

  draw(frame: Frame, follow = true): void {
    const { ctx } = this;
    const { bodies, state } = frame;
    if (follow) this.camera.follow([...footprints(bodies, state), ...anchors(frame.sketches)]);
    this.labels = [];
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawGrid();
    for (const field of frame.fields ?? []) this.drawField(field);
    if (frame.needles) this.drawNeedles(frame.needles);
    if (frame.fieldLines) this.drawFieldLines(frame.fieldLines, '--force-electric');
    if (frame.magneticLines) this.drawFieldLines(frame.magneticLines, '--force-magnetic');
    for (const distribution of frame.distributions ?? []) this.drawDistribution(distribution);

    bodies.forEach((body, i) => body.kind === 'static' && this.drawBody(body, state, i, false, frame.selected?.includes(i)));
    for (const sketch of frame.sketches) this.drawSketch(sketch);

    if (frame.showTrail && frame.focus >= 0 && bodies[frame.focus]) {
      const i = frame.focus * STATE_STRIDE;
      const last = this.trail[this.trail.length - 1];
      const point: [number, number] = [state[i]!, state[i + 1]!];
      if (!last || Math.hypot(last[0] - point[0], last[1] - point[1]) > 2 / this.camera.scale) this.trail.push(point);
      if (this.trail.length > 2400) this.trail.shift();
      this.dashed(this.trail, KNOB_COLOR);
    }

    bodies.forEach((body, i) => body.kind !== 'static' && this.drawBody(body, state, i, i === frame.focus, frame.selected?.includes(i)));

    if (frame.focus >= 0 && bodies[frame.focus]) {
      const i = frame.focus * STATE_STRIDE;
      const [x, y, vx, vy, ax, ay] = [state[i]!, state[i + 1]!, state[i + 3]!, state[i + 4]!, state[i + 6]!, state[i + 7]!];
      if (frame.showForces) this.drawForces(frame.forces);
      if (frame.showAcceleration) this.arrow(x, y, ax, ay, scales.acceleration, MOTION_COLOR, `a ${formatNumber(Math.hypot(ax, ay))} m/s²`, 'acceleration');
      if (frame.showVelocity) this.arrow(x, y, vx, vy, scales.velocity, MOTION_COLOR, `v ${formatNumber(Math.hypot(vx, vy))} m/s`, 'velocity');
    }

    if (frame.grab) {
      const { point, target } = frame.grab;
      this.dashed([point, target], forceColor('applied'));
      this.knob(target[0], target[1], forceColor('applied'), true);
    }
    if (frame.surface) this.drawSurface(frame.surface);
    frame.overlay?.(this);
    if (!frame.plain) this.drawAxisLabels();
  }

  // ---- painter ----

  knob(x: number, y: number, color: string, active = false): void {
    const { ctx } = this;
    const k = stageScale();
    const [sx, sy] = this.camera.toScreen(x, y);
    ctx.beginPath();
    ctx.arc(sx, sy, (active ? 8 : 6.5) * k, 0, Math.PI * 2);
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.fill();
    ctx.lineWidth = 2.5 * k;
    ctx.strokeStyle = paint(color);
    ctx.stroke();
    if (active) {
      ctx.beginPath();
      ctx.arc(sx, sy, 3 * k, 0, Math.PI * 2);
      ctx.fillStyle = paint(color);
      ctx.fill();
    }
  }

  dashed(points: [number, number][], color: string): void {
    if (points.length < 2) return;
    const { ctx } = this;
    ctx.save();
    this.path(points);
    ctx.strokeStyle = paint(color);
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5 * stageScale();
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.restore();
  }

  /** Arrow from a world point along a world vector scaled by `scale` metres per unit. */
  arrow(x: number, y: number, vx: number, vy: number, scale: number, color: string, label: string, style: ArrowStyle = 'force'): void {
    if (Math.hypot(vx, vy) < 1e-9) return;
    const { ctx } = this;
    const k = stageScale();
    let [sx, sy] = this.camera.toScreen(x, y);
    const [tx, ty] = this.camera.toScreen(x + vx * scale, y + vy * scale);
    const trueLength = Math.hypot(tx - sx, ty - sy);
    if (trueLength < 1e-6) return;
    const length = legible(trueLength, 30 * k);
    if (length < 4) return;
    const ux = (tx - sx) / trueLength;
    const uy = (ty - sy) / trueLength;
    // Velocity and acceleration often point the same way as each other and as the net force: each is drawn
    // a little to its own side of the body's centre so the three never lie on top of one another.
    const aside = style === 'velocity' ? -9 * k : style === 'acceleration' ? 9 * k : 0;
    sx += -uy * aside;
    sy += ux * aside;
    const [ex, ey] = [sx + ux * length, sy + uy * length];
    const head = Math.min(13 * k, length * 0.5);
    const width = (style === 'force' ? 3 : 2.25) * k;
    const chevron = (back: number) => {
      const [cx, cy] = [ex - ux * back, ey - uy * back];
      ctx.moveTo(cx - ux * head - uy * head * 0.5, cy - uy * head + ux * head * 0.5);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx - ux * head + uy * head * 0.5, cy - uy * head - ux * head * 0.5);
    };
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      if (style === 'force') {
        ctx.lineTo(ex - ux * head * 0.8, ey - uy * head * 0.8);
      } else {
        ctx.lineTo(ex, ey);
        chevron(0);
        if (style === 'acceleration') chevron(head * 0.7);
      }
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // A rim in the background colour keeps an arrow readable where it crosses a body or another arrow.
    ctx.strokeStyle = cssVar('--canvas-bg');
    ctx.lineWidth = width + 3 * k;
    trace();
    ctx.stroke();
    ctx.strokeStyle = paint(color);
    ctx.fillStyle = paint(color);
    ctx.lineWidth = width;
    trace();
    ctx.stroke();
    if (style === 'force') {
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - ux * head - uy * head * 0.5, ey - uy * head + ux * head * 0.5);
      ctx.lineTo(ex - ux * head + uy * head * 0.5, ey - uy * head - ux * head * 0.5);
      ctx.closePath();
      ctx.strokeStyle = cssVar('--canvas-bg');
      ctx.lineWidth = 1.5 * k;
      ctx.stroke();
      ctx.fill();
    }
    if (label) this.placeLabel(label, ex, ey, ux, uy, color);
  }

  label(text: string, x: number, y: number, color: string): void {
    const [sx, sy] = this.camera.toScreen(x, y);
    this.placeLabel(text, sx, sy, 0, -1, color);
  }

  /**
   * Puts a label near a point, trying a few sides until it overlaps nothing already placed. The words are in
   * ink on a plate, with a bar of the arrow's colour: coloured text is too faint to read from the back of a room.
   */
  private placeLabel(text: string, x: number, y: number, ux: number, uy: number, color: string): void {
    const { ctx } = this;
    const k = stageScale();
    ctx.font = stageFont(12.5, 600);
    const bar = 4 * k;
    const w = ctx.measureText(text).width + bar + 13 * k;
    const h = 21 * k;
    const gap = 8 * k;
    const side = 15 * k;
    const candidates: [number, number][] = [
      [x + ux * gap + (ux >= 0 ? 0 : -w), y + uy * gap - h / 2],
      [x - uy * side - w / 2, y + ux * side - h / 2],
      [x + uy * side - w / 2, y - ux * side - h / 2],
      [x + ux * (gap + 16 * k) + (ux >= 0 ? 0 : -w), y + uy * (gap + 16 * k) - h / 2],
      [x - w / 2, y - h - gap - side],
      [x - w / 2, y + gap + side],
    ];
    const fits = (r: Rect) =>
      r.x >= 2 && r.y >= 2 && r.x + r.w <= this.width - 2 && r.y + r.h <= this.height - 2 && !this.labels.some((o) => r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h);
    let rect: Rect | undefined;
    for (const [cx, cy] of candidates) {
      const candidate = { x: cx, y: cy, w, h };
      if (fits(candidate)) {
        rect = candidate;
        break;
      }
    }
    // Nowhere free: overlap something rather than run off the edge of the stage.
    rect ??= { x: clamp(candidates[0]![0], 2, this.width - w - 2), y: clamp(candidates[0]![1], 2, this.height - h - 2), w, h };
    this.labels.push(rect);
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = cssVar('--surface');
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 5 * k);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = paint(color);
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, bar, rect.h, [5 * k, 0, 0, 5 * k]);
    ctx.fill();
    ctx.fillStyle = cssVar('--text');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, rect.x + bar + 6 * k, rect.y + h / 2 + 0.5);
    ctx.textBaseline = 'alphabetic';
  }

  // ---- world ----

  /** Metres between neighbouring grid lines at the current zoom. */
  gridStep(): number {
    const { left, right } = this.camera.bounds;
    // The smallest of 1, 2, 5 times a power of ten that puts at most 26 lines across, at any scale.
    const raw = (right - left) / 26;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  }

  private drawGrid(): void {
    const { ctx } = this;
    const { left, right, top, bottom } = this.camera.bounds;
    const step = this.gridStep();
    const style = (value: number) => {
      const k = Math.round(value / step);
      return Math.abs(value) < step * 1e-6 ? cssVar('--canvas-axis') : k % 5 === 0 ? cssVar('--canvas-grid-major') : cssVar('--canvas-grid');
    };
    ctx.lineWidth = 1;
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
      const sx = Math.round(this.camera.toScreen(x, 0)[0]) + 0.5;
      ctx.strokeStyle = style(x);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, this.height);
      ctx.stroke();
    }
    for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) {
      const sy = Math.round(this.camera.toScreen(0, y)[1]) + 0.5;
      ctx.strokeStyle = style(y);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(this.width, sy);
      ctx.stroke();
    }
  }

  /** Metre labels along the bottom and left edges, on every fifth line, drawn last so nothing covers them. */
  private drawAxisLabels(): void {
    const { ctx } = this;
    const { left, right, top, bottom } = this.camera.bounds;
    const step = this.gridStep() * 5;
    const { insets } = this.camera;
    ctx.font = stageFont(11.5);
    ctx.fillStyle = cssVar('--canvas-text');
    ctx.textAlign = 'center';
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
      const [sx] = this.camera.toScreen(x, 0);
      if (sx > insets.left + 30 && sx < this.width - insets.right - 20) ctx.fillText(formatLength(x, step), sx, this.height - Math.max(6, insets.bottom - 2));
    }
    ctx.textAlign = 'left';
    for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) {
      const [, sy] = this.camera.toScreen(0, y);
      if (sy > this.axis.clearTop + 14 && sy < this.height - insets.bottom - 24) ctx.fillText(formatLength(y, step), this.axis.left, sy - 4);
    }
  }

  private drawBody(body: BodyInfo, state: Float64Array, index: number, focused: boolean, selected = false): void {
    const { ctx } = this;
    const i = index * STATE_STRIDE;
    const [x, y, angle] = [state[i]!, state[i + 1]!, state[i + 2]!];
    const isStatic = body.kind === 'static';
    const edge = isStatic ? cssVar('--canvas-static-edge') : cssVar('--canvas-body');
    ctx.lineWidth = (focused ? 3 : 1.75) * stageScale();
    ctx.strokeStyle = edge;
    ctx.fillStyle = isStatic ? cssVar('--canvas-static') : cssVar('--canvas-body-fill');
    const charge = body.charge ? cssVar(body.charge > 0 ? '--charge-positive' : '--charge-negative') : undefined;
    if (charge) {
      ctx.strokeStyle = charge;
      ctx.fillStyle = cssVar('--canvas-bg');
      ctx.lineWidth = (focused ? 3.5 : 2.5) * stageScale();
    }
    const shape = body.shape;

    if (shape.kind === 'halfplane') {
      const [nx, ny] = shape.normal;
      const [tx, ty] = [-ny, nx];
      const far = 4 * (this.width + this.height) / this.camera.scale + Math.hypot(this.camera.centerX, this.camera.centerY);
      const ox = nx * shape.offset;
      const oy = ny * shape.offset;
      this.path([
        [ox + tx * far, oy + ty * far],
        [ox - tx * far, oy - ty * far],
        [ox - tx * far - nx * far, oy - ty * far - ny * far],
        [ox + tx * far - nx * far, oy + ty * far - ny * far],
      ]);
      ctx.fill();
      // The textbook's hatched ground: short strokes hanging below the surface line.
      const [ax, ay] = this.camera.toScreen(ox + tx * far, oy + ty * far);
      const [bx, by] = this.camera.toScreen(ox - tx * far, oy - ty * far);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (Math.abs(ny) > 0.99) {
        const sy = this.camera.toScreen(0, oy)[1];
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let sx = -12 + ((this.camera.toScreen(0, 0)[0] % 14) + 14) % 14; sx < this.width + 12; sx += 14) {
          ctx.moveTo(sx, sy + 1);
          ctx.lineTo(sx - 7, sy + 9);
        }
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    let ringRadius = 0;
    const [sx, sy] = this.camera.toScreen(x, y);
    if (shape.kind === 'circle') {
      // A charge is drawn large enough to carry its sign, whatever its real size.
      const r = Math.max(shape.radius * this.camera.scale, charge ? 9 * stageScale() : isStatic ? 2 : 5);
      ringRadius = r;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (body.kind === 'rigid' && r > 7) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + r * Math.cos(-angle), sy + r * Math.sin(-angle));
        ctx.stroke();
      }
    } else {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const points = shape.vertices.map(([vx, vy]) => [x + vx * cos - vy * sin, y + vx * sin + vy * cos] as [number, number]);
      ringRadius = Math.max(...shape.vertices.map(([vx, vy]) => Math.hypot(vx, vy))) * this.camera.scale;
      this.path(points);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (body.magnet) this.drawPoles(shape.vertices, [x, y], angle, body.magnet[0] >= 0, focused);
    }
    if (charge) {
      // The sign, so that the colour is never the only thing that tells the two kinds apart.
      const arm = Math.min(Math.max(ringRadius * 0.5, 4 * stageScale()), 12 * stageScale());
      ctx.strokeStyle = charge;
      ctx.lineWidth = 2.25 * stageScale();
      ctx.beginPath();
      ctx.moveTo(sx - arm, sy);
      ctx.lineTo(sx + arm, sy);
      if (body.charge > 0) {
        ctx.moveTo(sx, sy - arm);
        ctx.lineTo(sx, sy + arm);
      }
      ctx.stroke();
    }
    if (selected) {
      // A ring round a ball; for a box or a platform, a dashed outline just outside its own edges.
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = cssVar('--text');
      ctx.beginPath();
      if (shape.kind === 'circle') {
        ctx.arc(sx, sy, ringRadius + 7, 0, Math.PI * 2);
      } else {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        shape.vertices.forEach(([vx, vy], k) => {
          const grow = 1 + 7 / Math.max(Math.hypot(vx, vy) * this.camera.scale, 1);
          const [px, py] = this.camera.toScreen(x + (vx * cos - vy * sin) * grow, y + (vx * sin + vy * cos) * grow);
          k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.closePath();
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawSketch(sketch: SketchInfo): void {
    const { ctx } = this;
    ctx.strokeStyle = cssVar('--canvas-rope');
    ctx.lineWidth = 2 * stageScale();
    ctx.lineJoin = 'round';
    switch (sketch.kind) {
      case 'line':
      case 'polyline':
        this.path(sketch.points);
        ctx.stroke();
        break;
      case 'circle': {
        const [sx, sy] = this.camera.toScreen(sketch.center[0], sketch.center[1]);
        const r = sketch.radius * this.camera.scale;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = cssVar('--canvas-static');
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(r * 0.16, 2), 0, Math.PI * 2);
        ctx.fillStyle = cssVar('--canvas-rope');
        ctx.fill();
        break;
      }
      case 'spring': {
        const [a, b] = sketch.points;
        const [ax, ay] = this.camera.toScreen(a[0], a[1]);
        const [bx, by] = this.camera.toScreen(b[0], b[1]);
        const length = Math.hypot(bx - ax, by - ay) || 1;
        const ux = (bx - ax) / length;
        const uy = (by - ay) / length;
        const coils = 11;
        const lead = Math.min(10, length * 0.12);
        const amplitude = Math.min(9, Math.max(4, this.camera.scale * 0.09));
        ctx.strokeStyle = paint(forceColor('spring'));
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + ux * lead, ay + uy * lead);
        for (let k = 0; k <= coils * 2; k++) {
          const along = lead + ((length - 2 * lead) * (k + 0.5)) / (coils * 2 + 1);
          const side = k % 2 === 0 ? 1 : -1;
          ctx.lineTo(ax + ux * along - uy * amplitude * side, ay + uy * along + ux * amplitude * side);
        }
        ctx.lineTo(bx - ux * lead, by - uy * lead);
        ctx.lineTo(bx, by);
        ctx.stroke();
        break;
      }
      case 'pivot': {
        const [sx, sy] = this.camera.toScreen(sketch.point[0], sketch.point[1]);
        ctx.beginPath();
        ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = cssVar('--canvas-bg');
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
  }

  /**
   * A uniform field. Electric: faint arrows along it and, when it is confined, the pair of plates that hold it,
   * positive where the arrows start. Magnetic: the tips of arrows coming out of the page as dots, their tails
   * going in as crosses.
   */
  private drawField(field: FieldInfo): void {
    const { ctx } = this;
    const k = stageScale();
    const bounds = this.camera.bounds;
    const [min, max] = field.region ?? [[bounds.left, bounds.bottom], [bounds.right, bounds.top]];
    const [x0, y1] = this.camera.toScreen(min[0], min[1]);
    const [x1, y0] = this.camera.toScreen(max[0], max[1]);
    const color = cssVar(field.kind === 'electric' ? '--force-electric' : '--force-magnetic');
    ctx.save();
    if (field.region) {
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = color;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    // Marks sit on a lattice fixed to the world, so they stay put as the view pans.
    // A field that fills the plane is drawn sparsely, as a backdrop; one between plates is the subject.
    const spacing = (field.region ? 52 : 84) * k;
    const step = spacing / this.camera.scale;
    // Magnetic marks sit between the electric arrows where the two fields cross.
    const shift = field.kind === 'magnetic' ? 0 : 0.5;
    const marks: [number, number][] = [];
    for (let x = (Math.floor(Math.max(min[0], bounds.left) / step) + shift) * step; x < Math.min(max[0], bounds.right); x += step) {
      for (let y = (Math.floor(Math.max(min[1], bounds.bottom) / step) + shift) * step; y < Math.min(max[1], bounds.top); y += step) {
        marks.push(this.camera.toScreen(x, y));
      }
    }
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5 * k;
    ctx.lineCap = 'round';
    if (field.kind === 'magnetic') {
      ctx.globalAlpha = 0.6;
      const r = 5 * k;
      for (const [sx, sy] of marks) {
        ctx.beginPath();
        if (field.magnetic > 0) {
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sx, sy, 1.6 * k, 0, Math.PI * 2);
          ctx.fill();
        } else if (field.magnetic < 0) {
          ctx.moveTo(sx - r * 0.7, sy - r * 0.7);
          ctx.lineTo(sx + r * 0.7, sy + r * 0.7);
          ctx.moveTo(sx + r * 0.7, sy - r * 0.7);
          ctx.lineTo(sx - r * 0.7, sy + r * 0.7);
          ctx.stroke();
        }
      }
    } else {
      const [ex, ey] = field.electric;
      const size = Math.hypot(ex, ey);
      // An alternating field is drawn against the largest it has been, so the arrows swell and reverse.
      const key = JSON.stringify(field.region);
      const largest = Math.max(this.strongest.get(key) ?? 0, size);
      this.strongest.set(key, largest);
      if (size > 1e-9 * largest && largest > 0) {
        const [ux, uy] = [ex / size, -ey / size];
        const half = 0.36 * spacing * Math.max(size / largest, 0.25);
        ctx.globalAlpha = (field.region ? 0.25 : 0.15) + 0.4 * (size / largest);
        ctx.beginPath();
        for (const [sx, sy] of marks) {
          const [tx, ty] = [sx + ux * half, sy + uy * half];
          ctx.moveTo(sx - ux * half, sy - uy * half);
          ctx.lineTo(tx, ty);
          ctx.moveTo(tx - ux * 6 * k - uy * 3.5 * k, ty - uy * 6 * k + ux * 3.5 * k);
          ctx.lineTo(tx, ty);
          ctx.lineTo(tx - ux * 6 * k + uy * 3.5 * k, ty - uy * 6 * k - ux * 3.5 * k);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    if (field.kind === 'electric' && field.region) this.drawPlates(field, [x0, y0, x1, y1]);
  }

  /** The plates either side of a confined electric field, the positive one where the field starts. */
  private drawPlates(field: FieldInfo, [x0, y0, x1, y1]: [number, number, number, number]): void {
    const { ctx } = this;
    const k = stageScale();
    const [ex, ey] = field.electric;
    const upright = Math.abs(ey) >= Math.abs(ex);
    // Screen y runs downward: a field pointing up the page starts at the lower plate.
    const startsAtFirst = upright ? ey < 0 : ex > 0;
    const plates: [number, number, number, number][] = upright ? [[x0, y0, x1, y0], [x0, y1, x1, y1]] : [[x0, y0, x0, y1], [x1, y0, x1, y1]];
    const alive = Math.hypot(ex, ey) > 0;
    plates.forEach(([ax, ay, bx, by], index) => {
      const positive = (index === 0) === startsAtFirst;
      ctx.strokeStyle = alive ? cssVar(positive ? '--charge-positive' : '--charge-negative') : cssVar('--canvas-static-edge');
      ctx.lineWidth = 4 * k;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (!alive) return;
      const outward = index === 0 ? -1 : 1;
      const [mx, my] = [(ax + bx) / 2 + (upright ? 0 : outward * 13 * k), (ay + by) / 2 + (upright ? outward * 13 * k : 0)];
      ctx.font = stageFont(15, 700);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(positive ? '+' : '−', mx, my);
      ctx.textBaseline = 'alphabetic';
    });
  }

  /**
   * A bar magnet, painted the way magnets are: the north half one colour and the south the other, each with its
   * letter when there is room. A compass needle is the same thing, too small for letters.
   */
  private drawPoles(vertices: [number, number][], [x, y]: [number, number], angle: number, northAhead: boolean, focused: boolean): void {
    const { ctx } = this;
    const k = stageScale();
    const halfLength = Math.max(...vertices.map(([vx]) => Math.abs(vx)));
    const halfWidth = Math.max(...vertices.map(([, vy]) => Math.abs(vy)));
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const place = (lx: number, ly: number): [number, number] => this.camera.toScreen(x + lx * cos - ly * sin, y + lx * sin + ly * cos);
    const half = (from: number, to: number, north: boolean) => {
      ctx.fillStyle = cssVar(north ? '--pole-north' : '--pole-south');
      ctx.beginPath();
      [[from, -halfWidth], [to, -halfWidth], [to, halfWidth], [from, halfWidth]].forEach(([lx, ly], i) => {
        const [sx, sy] = place(lx!, ly!);
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fill();
      const size = Math.min(2 * halfWidth * this.camera.scale * 0.72, halfLength * this.camera.scale * 0.8, 17 * k);
      if (size < 9 * k) return;
      const [sx, sy] = place((from + to) / 2, 0);
      ctx.fillStyle = cssVar('--pole-ink');
      ctx.font = stageFont(size / k, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(north ? 'N' : 'S', sx, sy + size * 0.04);
      ctx.textBaseline = 'alphabetic';
    };
    half(0, halfLength, northAhead);
    half(-halfLength, 0, !northAhead);
    ctx.strokeStyle = cssVar('--canvas-body');
    ctx.lineWidth = (focused ? 2.5 : 1.25) * k;
    this.path(vertices.map(([vx, vy]) => [x + vx * cos - vy * sin, y + vx * sin + vy * cos] as [number, number]));
    ctx.closePath();
    ctx.stroke();
  }

  /**
   * A lattice of small compass needles, each lying along the field where it sits. Where the field is weak beside
   * the rest the needle is drawn short and faint: at a neutral point there is nothing to turn it.
   */
  private drawNeedles(field: (x: number, y: number) => [number, number]): void {
    const { ctx } = this;
    const k = stageScale();
    const bounds = this.camera.bounds;
    const spacing = 62 * k;
    const step = spacing / this.camera.scale;
    const needles: { at: [number, number]; b: [number, number]; size: number }[] = [];
    for (let x = (Math.floor(bounds.left / step) + 0.5) * step; x < bounds.right; x += step) {
      for (let y = (Math.floor(bounds.bottom / step) + 0.5) * step; y < bounds.top; y += step) {
        const b = field(x, y);
        needles.push({ at: this.camera.toScreen(x, y), b, size: Math.hypot(b[0], b[1]) });
      }
    }
    const sizes = needles.map((n) => n.size).sort((a, b) => a - b);
    const typical = sizes[sizes.length >> 1] ?? 0;
    if (!(typical > 0)) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.4 * k;
    for (const { at, b, size } of needles) {
      if (!(size > 0)) continue;
      const strength = Math.min(1, size / typical);
      const half = 0.3 * spacing * (0.3 + 0.7 * strength);
      const [ux, uy] = [(b[0] / size) * half, (-b[1] / size) * half];
      ctx.globalAlpha = 0.12 + 0.4 * strength;
      ctx.strokeStyle = cssVar('--pole-south');
      ctx.beginPath();
      ctx.moveTo(at[0] - ux, at[1] - uy);
      ctx.lineTo(at[0], at[1]);
      ctx.stroke();
      ctx.strokeStyle = cssVar('--pole-north');
      ctx.beginPath();
      ctx.moveTo(at[0], at[1]);
      ctx.lineTo(at[0] + ux, at[1] + uy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A fixed spread of charge: a wire seen end on, a sheet seen edge on with the field either side, or a shell. */
  private drawDistribution(d: DistributionInfo): void {
    const { ctx } = this;
    const k = stageScale();
    const positive = d.amount >= 0;
    const color = cssVar(positive ? '--charge-positive' : '--charge-negative');
    const [sx, sy] = this.camera.toScreen(d.at[0], d.at[1]);
    const sign = (x: number, y: number, arm: number) => {
      ctx.beginPath();
      ctx.moveTo(x - arm, y);
      ctx.lineTo(x + arm, y);
      if (positive) {
        ctx.moveTo(x, y - arm);
        ctx.lineTo(x, y + arm);
      }
      ctx.stroke();
    };
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.lineCap = 'round';
    if (d.kind === 'wire') {
      const r = 11 * k;
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 2.25 * k;
      sign(sx, sy, 5.5 * k);
      this.caption('wire, seen end on', sx, sy + r + 15 * k);
      // Arrow labels keep clear of the wire and its caption.
      this.labels.push({ x: sx - 62 * k, y: sy - r - 4 * k, w: 124 * k, h: 2 * r + 26 * k });
    } else if (d.kind === 'shell') {
      const r = d.radius * this.camera.scale;
      ctx.lineWidth = 3.5 * k;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2 * k;
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * (i + 0.5)) / 12;
        sign(sx + (r + 12 * k) * Math.cos(a), sy + (r + 12 * k) * Math.sin(a), 4.5 * k);
      }
    } else {
      const bounds = this.camera.bounds;
      const reach = Math.hypot(bounds.right - bounds.left, bounds.top - bounds.bottom);
      const [nx, ny] = d.normal;
      const [tx, ty] = [-ny, nx];
      const spacing = 84 * k;
      const step = spacing / this.camera.scale;
      // The field either side: the same everywhere, away from a positive sheet.
      ctx.save();
      ctx.strokeStyle = cssVar('--force-electric');
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5 * k;
      const half = 0.3 * spacing;
      ctx.beginPath();
      for (let x = (Math.floor(bounds.left / step) + 0.5) * step; x < bounds.right; x += step) {
        for (let y = (Math.floor(bounds.bottom / step) + 0.5) * step; y < bounds.top; y += step) {
          const side = (x - d.at[0]) * nx + (y - d.at[1]) * ny;
          if (Math.abs(side) < 0.45 * step) continue;
          const way = Math.sign(side) * (positive ? 1 : -1);
          const [ux, uy] = [nx * way, -ny * way];
          const [mx, my] = this.camera.toScreen(x, y);
          const [hx, hy] = [mx + ux * half, my + uy * half];
          ctx.moveTo(mx - ux * half, my - uy * half);
          ctx.lineTo(hx, hy);
          ctx.moveTo(hx - ux * 6 * k - uy * 3.5 * k, hy - uy * 6 * k + ux * 3.5 * k);
          ctx.lineTo(hx, hy);
          ctx.lineTo(hx - ux * 6 * k + uy * 3.5 * k, hy - uy * 6 * k - ux * 3.5 * k);
        }
      }
      ctx.stroke();
      ctx.restore();
      const [ax, ay] = this.camera.toScreen(d.at[0] - tx * reach, d.at[1] - ty * reach);
      const [bx, by] = this.camera.toScreen(d.at[0] + tx * reach, d.at[1] + ty * reach);
      ctx.lineCap = 'butt';
      ctx.lineWidth = 5 * k;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.lineWidth = 2 * k;
      const gap = 46 * k;
      for (let along = -Math.ceil((reach * this.camera.scale) / gap) * gap; along < reach * this.camera.scale; along += gap) {
        // Screen y runs downward, so the tangent's y turns over; the signs sit just off the sheet.
        sign(sx + tx * along + nx * 12 * k, sy - ty * along - ny * 12 * k, 4 * k);
      }
    }
    ctx.restore();
  }

  /** A closed surface for Gauss's law: a sphere, of which the page shows the circle. */
  private drawSurface(surface: SurfaceSpec): void {
    const { ctx } = this;
    const k = stageScale();
    const [sx, sy] = this.camera.toScreen(surface.centre[0], surface.centre[1]);
    const r = surface.radius * this.camera.scale;
    ctx.save();
    ctx.strokeStyle = cssVar('--text');
    ctx.fillStyle = cssVar('--text');
    ctx.globalAlpha = 0.06;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2 * k;
    ctx.setLineDash([8 * k, 6 * k]);
    ctx.stroke();
    ctx.restore();
    this.caption('closed surface', sx, sy - r - 8 * k);
  }

  /** A few words naming something drawn on the stage. */
  private caption(text: string, sx: number, sy: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = stageFont(12.5, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 4 * stageScale();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = cssVar('--canvas-bg');
    ctx.strokeText(text, sx, sy);
    ctx.fillStyle = cssVar('--canvas-text');
    ctx.fillText(text, sx, sy);
    ctx.restore();
  }

  private drawFieldLines(flat: Float64Array, token: string): void {
    const { ctx } = this;
    const k = stageScale();
    ctx.save();
    ctx.strokeStyle = cssVar(token);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4 * k;
    ctx.lineJoin = 'round';
    let start = 0;
    for (let i = 0; i <= flat.length; i += 2) {
      if (i < flat.length && !Number.isNaN(flat[i]!)) continue;
      const count = (i - start) / 2;
      if (count >= 2) {
        ctx.beginPath();
        for (let j = 0; j < count; j++) {
          const [sx, sy] = this.camera.toScreen(flat[start + 2 * j]!, flat[start + 2 * j + 1]!);
          j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        // One arrowhead a third of the way along says which way the field points.
        const at = Math.max(1, Math.floor(count * 0.35));
        const [ax, ay] = this.camera.toScreen(flat[start + 2 * at - 2]!, flat[start + 2 * at - 1]!);
        const [bx, by] = this.camera.toScreen(flat[start + 2 * at]!, flat[start + 2 * at + 1]!);
        const length = Math.hypot(bx - ax, by - ay);
        if (length > 0) {
          const [ux, uy] = [(bx - ax) / length, (by - ay) / length];
          ctx.beginPath();
          ctx.moveTo(bx + ux * 5 * k, by + uy * 5 * k);
          ctx.lineTo(bx - ux * 5 * k - uy * 4.5 * k, by - uy * 5 * k + ux * 4.5 * k);
          ctx.lineTo(bx - ux * 5 * k + uy * 4.5 * k, by - uy * 5 * k - ux * 4.5 * k);
          ctx.closePath();
          ctx.fill();
        }
      }
      start = i + 2;
    }
    ctx.restore();
  }

  private drawForces(forces: ForceInfo[]): void {
    const steady = forces.filter((f) => !f.impulsive);
    const largest = Math.max(1e-9, ...steady.map((f) => Math.hypot(f.force[0], f.force[1])));
    const visible = this.camera.bounds;
    const scale = (0.16 * (visible.top - visible.bottom)) / largest;
    for (const f of steady) {
      const magnitude = Math.hypot(f.force[0], f.force[1]);
      if (magnitude < 1e-6 * largest) continue;
      this.arrow(f.point[0], f.point[1], f.force[0], f.force[1], scale, forceColor(f.label), `${f.label} ${magnitude < 0.1 ? formatPrefixed(magnitude, 'N') : `${formatNumber(magnitude)} N`}`);
    }
  }

  private path(points: [number, number][]): void {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach(([x, y], k) => {
      const [sx, sy] = this.camera.toScreen(x, y);
      k === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    });
  }
}

/** Moving bodies only; the ground and walls are not something the camera has to chase. */
export function footprints(bodies: BodyInfo[], state: Float64Array): Box[] {
  const out: Box[] = [];
  bodies.forEach((body, i) => {
    if (body.kind === 'static') return;
    const shape = body.shape;
    const radius =
      shape.kind === 'circle' ? shape.radius : shape.kind === 'polygon' ? Math.max(...shape.vertices.map(([x, y]) => Math.hypot(x, y))) : 0;
    out.push({ x: state[i * STATE_STRIDE]!, y: state[i * STATE_STRIDE + 1]!, radius: Math.max(radius, 0.1) });
  });
  return out;
}

/** What the moving bodies hang from or are tied to: a pendulum's pivot belongs in the frame as much as its bob. */
function anchors(sketches: SketchInfo[]): Box[] {
  const out: Box[] = [];
  for (const sketch of sketches) {
    if (sketch.kind === 'pivot') out.push({ x: sketch.point[0], y: sketch.point[1], radius: 0.1 });
    else if (sketch.kind === 'circle') out.push({ x: sketch.center[0], y: sketch.center[1], radius: sketch.radius });
    else for (const [x, y] of sketch.points) out.push({ x, y, radius: 0.1 });
  }
  return out;
}

/** Sums same-labelled forces, as a textbook free-body diagram shows one normal force even for two contact points. */
export function aggregateForces(forces: ForceInfo[]): ForceInfo[] {
  const byLabel = new Map<string, ForceInfo & { weight: number }>();
  for (const f of forces) {
    const key = `${f.label}${f.impulsive ? '!' : ''}`;
    const magnitude = Math.hypot(f.force[0], f.force[1]) + 1e-12;
    const current = byLabel.get(key);
    if (!current) {
      byLabel.set(key, { ...f, force: [...f.force], point: [f.point[0] * magnitude, f.point[1] * magnitude], weight: magnitude });
    } else {
      current.force[0] += f.force[0];
      current.force[1] += f.force[1];
      current.torque += f.torque;
      current.point[0] += f.point[0] * magnitude;
      current.point[1] += f.point[1] * magnitude;
      current.weight += magnitude;
    }
  }
  return [...byLabel.values()].map(({ weight, ...f }) => ({ ...f, point: [f.point[0] / weight, f.point[1] / weight] }));
}
