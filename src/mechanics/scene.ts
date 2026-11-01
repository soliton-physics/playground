import { Camera } from './camera';
import { cssVar } from '../ui';
import { STATE_STRIDE, type BodyInfo, type ForceInfo, type SketchInfo } from './types';

export interface SceneOptions {
  showVelocity: boolean;
  showAcceleration: boolean;
  showForces: boolean;
  showTrail: boolean;
  focus: number;
}

const FORCE_COLORS: Record<string, string> = {
  gravity: '#f59e0b',
  normal: '#22c55e',
  friction: '#ef4444',
  tension: '#a855f7',
  applied: '#3b82f6',
  spring: '#ec4899',
  reaction: '#64748b',
  drag: '#64748b',
  driving: '#3b82f6',
  torque: '#64748b',
};

export function forceColor(label: string): string {
  return FORCE_COLORS[label] ?? '#64748b';
}

/** Draws the world: grid, bodies, ropes and springs, motion vectors and the free-body diagram. */
export class SceneView {
  readonly camera = new Camera();
  private readonly context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private trail: [number, number][] = [];
  private dragging: { x: number; y: number } | undefined;
  onSelect: ((body: number) => void) | undefined;
  private lastState: Float64Array | undefined;
  private lastBodies: BodyInfo[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      this.camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    });
    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.camera.pan(e.clientX - this.dragging.x, e.clientY - this.dragging.y);
      this.dragging = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!this.dragging) return;
      const moved = Math.hypot(e.clientX - this.dragging.x, e.clientY - this.dragging.y);
      this.dragging = undefined;
      if (moved < 3) this.pick(e);
    });
  }

  clearTrail(): void {
    this.trail = [];
  }

  private pick(e: PointerEvent): void {
    if (!this.lastState) return;
    const rect = this.canvas.getBoundingClientRect();
    const [wx, wy] = this.camera.toWorld(e.clientX - rect.left, e.clientY - rect.top);
    let best = -1;
    let bestDistance = 0.6 / Math.sqrt(this.camera.scale / 50);
    this.lastBodies.forEach((body, i) => {
      if (body.kind === 'static') return;
      const x = this.lastState![i * STATE_STRIDE]!;
      const y = this.lastState![i * STATE_STRIDE + 1]!;
      const distance = Math.hypot(wx - x, wy - y);
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    if (best >= 0) this.onSelect?.(best);
  }

  draw(
    bodies: BodyInfo[],
    state: Float64Array,
    sketches: SketchInfo[],
    forces: ForceInfo[],
    options: SceneOptions,
    time: number,
  ): void {
    this.lastState = state;
    this.lastBodies = bodies;
    const ctx = this.context;
    const theme = {
      background: cssVar('--canvas-bg'),
      grid: cssVar('--canvas-grid'),
      axis: cssVar('--canvas-axis'),
      text: cssVar('--canvas-text'),
      staticFill: cssVar('--canvas-static'),
      body: cssVar('--accent'),
      bodyFill: cssVar('--accent-soft'),
      rope: cssVar('--canvas-rope'),
    };
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawGrid(theme);

    for (const s of sketches) this.drawSketch(s, theme);

    if (options.showTrail && options.focus >= 0) {
      const i = options.focus * STATE_STRIDE;
      this.trail.push([state[i]!, state[i + 1]!]);
      if (this.trail.length > 600) this.trail.shift();
      ctx.beginPath();
      this.trail.forEach(([x, y], k) => {
        const [sx, sy] = this.camera.toScreen(x, y);
        k === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
      ctx.strokeStyle = theme.body;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    bodies.forEach((body, i) => this.drawBody(body, state, i, i === options.focus, theme));

    if (options.focus >= 0) {
      const i = options.focus * STATE_STRIDE;
      const [x, y, , vx, vy, , ax, ay] = Array.from(state.slice(i, i + STATE_STRIDE)) as number[];
      if (options.showVelocity) this.arrow(x!, y!, vx!, vy!, 0.25, '#0ea5e9', `v = ${Math.hypot(vx!, vy!).toFixed(2)} m/s`);
      if (options.showAcceleration) this.arrow(x!, y!, ax!, ay!, 0.12, '#f97316', `a = ${Math.hypot(ax!, ay!).toFixed(2)} m/s²`);
      if (options.showForces) this.drawForces(forces, theme);
    }

    const stamp = `t = ${time.toFixed(2)} s`;
    ctx.font = '13px system-ui, sans-serif';
    const stampWidth = ctx.measureText(stamp).width + 16;
    ctx.fillStyle = theme.background;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(this.width - stampWidth - 10, 8, stampWidth, 22);
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'right';
    ctx.fillText(stamp, this.width - 18, 23);
  }

  private drawGrid(theme: { grid: string; axis: string; text: string }): void {
    const ctx = this.context;
    const { left, right, top, bottom } = this.camera.bounds;
    const span = right - left;
    const step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].find((s) => span / s <= 24) ?? 100;
    ctx.lineWidth = 1;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = theme.text;
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
      const [sx] = this.camera.toScreen(x, 0);
      ctx.strokeStyle = Math.abs(x) < 1e-9 ? theme.axis : theme.grid;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, this.height);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(`${+x.toFixed(2)}`, sx, this.height - 6);
    }
    for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) {
      const [, sy] = this.camera.toScreen(0, y);
      ctx.strokeStyle = Math.abs(y) < 1e-9 ? theme.axis : theme.grid;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(this.width, sy);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillText(`${+y.toFixed(2)}`, 4, sy - 3);
    }
  }

  private drawBody(
    body: BodyInfo,
    state: Float64Array,
    index: number,
    focused: boolean,
    theme: { staticFill: string; body: string; bodyFill: string; axis: string },
  ): void {
    const ctx = this.context;
    const i = index * STATE_STRIDE;
    const [x, y, angle] = [state[i]!, state[i + 1]!, state[i + 2]!];
    const isStatic = body.kind === 'static';
    ctx.lineWidth = focused ? 3 : 2;
    ctx.strokeStyle = isStatic ? theme.axis : theme.body;
    ctx.fillStyle = isStatic ? theme.staticFill : theme.bodyFill;
    const shape = body.shape;
    if (shape.kind === 'halfplane') {
      const [nx, ny] = shape.normal;
      const [tx, ty] = [-ny, nx];
      const far = 1e4;
      const ox = nx * shape.offset;
      const oy = ny * shape.offset;
      const points: [number, number][] = [
        [ox + tx * far, oy + ty * far],
        [ox - tx * far, oy - ty * far],
        [ox - tx * far - nx * far, oy - ty * far - ny * far],
        [ox + tx * far - nx * far, oy + ty * far - ny * far],
      ];
      this.path(points);
      ctx.fill();
      const [ax, ay] = this.camera.toScreen(ox + tx * far, oy + ty * far);
      const [bx, by] = this.camera.toScreen(ox - tx * far, oy - ty * far);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      return;
    }
    if (shape.kind === 'circle') {
      const [sx, sy] = this.camera.toScreen(x, y);
      const r = Math.max(shape.radius * this.camera.scale, isStatic ? 2 : 5);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (body.kind === 'rigid') {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + r * Math.cos(-angle), sy + r * Math.sin(-angle));
        ctx.stroke();
      }
      return;
    }
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const points = shape.vertices.map(([vx, vy]) => [x + vx * cos - vy * sin, y + vx * sin + vy * cos] as [number, number]);
    this.path(points);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawSketch(sketch: SketchInfo, theme: { rope: string; axis: string }): void {
    const ctx = this.context;
    ctx.strokeStyle = theme.rope;
    ctx.lineWidth = 2;
    switch (sketch.kind) {
      case 'line':
      case 'polyline': {
        this.path(sketch.points);
        ctx.stroke();
        break;
      }
      case 'circle': {
        const [sx, sy] = this.camera.toScreen(sketch.center[0], sketch.center[1]);
        const r = sketch.radius * this.camera.scale;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(r * 0.15, 2), 0, Math.PI * 2);
        ctx.fillStyle = theme.axis;
        ctx.fill();
        break;
      }
      case 'spring': {
        const [a, b] = sketch.points;
        const [ax, ay] = this.camera.toScreen(a[0], a[1]);
        const [bx, by] = this.camera.toScreen(b[0], b[1]);
        const length = Math.hypot(bx - ax, by - ay);
        const coils = 10;
        const ux = (bx - ax) / length;
        const uy = (by - ay) / length;
        const amplitude = 7;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        for (let k = 1; k < coils * 2; k++) {
          const t = k / (coils * 2);
          const side = k % 2 === 0 ? 0 : k % 4 === 1 ? 1 : -1;
          ctx.lineTo(ax + ux * length * t - uy * amplitude * side, ay + uy * length * t + ux * amplitude * side);
        }
        ctx.lineTo(bx, by);
        ctx.stroke();
        break;
      }
      case 'pivot': {
        const [sx, sy] = this.camera.toScreen(sketch.point[0], sketch.point[1]);
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = theme.axis;
        ctx.fill();
        break;
      }
    }
  }

  private drawForces(forces: ForceInfo[], theme: { text: string }): void {
    const largest = Math.max(1e-9, ...forces.map((f) => Math.hypot(f.force[0], f.force[1])));
    const visible = this.camera.bounds;
    const scale = (0.18 * (visible.top - visible.bottom)) / largest;
    for (const f of forces) {
      const magnitude = Math.hypot(f.force[0], f.force[1]);
      if (magnitude < 1e-9 * largest) continue;
      this.arrow(f.point[0], f.point[1], f.force[0], f.force[1], scale, forceColor(f.label), `${f.label} ${magnitude.toFixed(1)} N`);
    }
    void theme;
  }

  /** Arrow from a world point along a world vector scaled by `scale` metres per unit. */
  private arrow(x: number, y: number, vx: number, vy: number, scale: number, color: string, label: string): void {
    const magnitude = Math.hypot(vx, vy);
    if (magnitude < 1e-9) return;
    const ctx = this.context;
    const [sx, sy] = this.camera.toScreen(x, y);
    const [ex, ey] = this.camera.toScreen(x + vx * scale, y + vy * scale);
    const angle = Math.atan2(ey - sy, ex - sx);
    const head = 9;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - head * Math.cos(angle - 0.5), ey - head * Math.sin(angle - 0.5));
    ctx.lineTo(ex - head * Math.cos(angle + 0.5), ey - head * Math.sin(angle + 0.5));
    ctx.closePath();
    ctx.fill();
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, ex + 6, ey + 4);
  }

  private path(points: [number, number][]): void {
    const ctx = this.context;
    ctx.beginPath();
    points.forEach(([x, y], k) => {
      const [sx, sy] = this.camera.toScreen(x, y);
      k === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    });
  }

  private resize(): void {
    const ratio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.camera.resize(rect.width, rect.height);
  }
}
