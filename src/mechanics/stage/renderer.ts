import { clamp, cssVar, formatLength, formatNumber, paint, stageFont, stageScale } from '../../ui';
import { STATE_STRIDE, type BodyInfo, type ForceInfo, type GrabInfo, type SketchInfo } from '../types';
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
      const r = Math.max(shape.radius * this.camera.scale, isStatic ? 2 : 5);
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

  private drawForces(forces: ForceInfo[]): void {
    const steady = forces.filter((f) => !f.impulsive);
    const largest = Math.max(1e-9, ...steady.map((f) => Math.hypot(f.force[0], f.force[1])));
    const visible = this.camera.bounds;
    const scale = (0.16 * (visible.top - visible.bottom)) / largest;
    for (const f of steady) {
      const magnitude = Math.hypot(f.force[0], f.force[1]);
      if (magnitude < 1e-6 * largest) continue;
      this.arrow(f.point[0], f.point[1], f.force[0], f.force[1], scale, forceColor(f.label), `${f.label} ${formatNumber(magnitude)} N`);
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
