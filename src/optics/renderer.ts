import { Camera } from '../mechanics/stage/camera';
import { cssVar, formatLength, formatNumber, stageFont, stageScale } from '../ui';
import type { BenchFrame, ElementInfo, ObjectInfo, RayInfo, Vec } from './types';

export interface Knob {
  at: Vec;
  label: string;
  active: boolean;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Draws an optical bench: what is on it, the rays through it, objects and their images. */
export class BenchRenderer {
  readonly camera = new Camera();
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private taken: Box[] = [];

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
    this.camera.resize(rect.width, rect.height);
  }

  gridStep(): number {
    const { left, right } = this.camera.bounds;
    const raw = (right - left) / 26;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  }

  draw(frame: BenchFrame, knobs: Knob[] = [], plain = false): void {
    const { ctx } = this;
    this.taken = [];
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.fillRect(0, 0, this.width, this.height);
    if (!plain) this.grid();
    for (const element of frame.elements) if (element.kind === 'glass') this.glass(element, plain);
    if (frame.axis) this.axis(frame.axis);
    for (const ray of frame.rays) this.ray(ray, frame.objects, plain);
    for (const element of frame.elements) if (element.kind !== 'glass') this.element(element);
    for (const object of frame.objects) this.object(object, plain);
    if (!plain) {
      for (const ray of frame.rays) if (ray.angles) this.angles(ray);
      for (const mark of frame.marks) this.mark(mark.at, mark.label);
      this.scaleLabels();
    }
    for (const knob of knobs) this.knob(knob);
  }

  private path(points: Vec[]): void {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const [sx, sy] = this.camera.toScreen(x, y);
      i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    });
  }

  private grid(): void {
    const { ctx } = this;
    const { left, right, top, bottom } = this.camera.bounds;
    const step = this.gridStep();
    ctx.lineWidth = 1;
    const style = (value: number) => (Math.round(value / step) % 5 === 0 ? cssVar('--canvas-grid-major') : cssVar('--canvas-grid'));
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

  /** Distances along the bottom edge, in centimetres: an optical bench has a scale. */
  private scaleLabels(): void {
    const { ctx } = this;
    const { left, right } = this.camera.bounds;
    const step = this.gridStep() * 5;
    const { insets } = this.camera;
    ctx.font = stageFont(11.5);
    ctx.fillStyle = cssVar('--canvas-text');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
      const [sx] = this.camera.toScreen(x, 0);
      const text = step < 1 ? `${formatNumber(Math.abs(x) < step * 1e-6 ? 0 : x * 100)} cm` : formatLength(x, step);
      if (sx > insets.left + 30 && sx < this.width - insets.right - 20) ctx.fillText(text, sx, this.height - Math.max(6, insets.bottom - 2));
    }
  }

  private glass(element: ElementInfo, plain: boolean): void {
    const { ctx } = this;
    this.path(element.points);
    ctx.closePath();
    ctx.fillStyle = cssVar('--glass-fill');
    ctx.fill();
    ctx.strokeStyle = cssVar('--glass-edge');
    ctx.lineWidth = 1.5 * stageScale();
    ctx.stroke();
    if (plain) return;
    // The index is written inside the glass, near the top of whatever part of it is on screen.
    const inside = element.points.map(([x, y]) => this.camera.toScreen(x, y));
    const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
    const xs = inside.map((p) => clamp(p[0], this.camera.insets.left, this.width - this.camera.insets.right));
    const ys = inside.map((p) => clamp(p[1], this.camera.insets.top, this.height - this.camera.insets.bottom));
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    if (x1 - x0 < 40 * stageScale() || y1 - y0 < 18 * stageScale()) return;
    const wide = x1 - x0 > 0.6 * this.width;
    this.text(`n = ${formatNumber(element.index)}`, wide ? x1 - 14 * stageScale() : (x0 + x1) / 2, wide ? y0 + 22 * stageScale() : y1 - 10 * stageScale(), wide ? 'right' : 'center', cssVar('--glass-edge'), true);
  }

  private element(element: ElementInfo): void {
    const { ctx } = this;
    const k = stageScale();
    ctx.lineCap = 'round';
    if (element.kind === 'lens') {
      // The textbook's sign for a thin lens: a line with arrowheads, pointing out for a converging lens and in
      // for a diverging one.
      const [a, b] = [this.camera.toScreen(...element.points[0]!), this.camera.toScreen(...element.points[1]!)];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const [ux, uy] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      const head = 9 * k;
      const way = element.focal > 0 ? 1 : -1;
      ctx.strokeStyle = cssVar('--glass-edge');
      ctx.lineWidth = 2.5 * k;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      for (const [tip, sign] of [[a, -1], [b, 1]] as const) {
        const back = sign * way;
        ctx.moveTo(tip[0] - ux * head * back - uy * head * 0.6, tip[1] - uy * head * back + ux * head * 0.6);
        ctx.lineTo(tip[0], tip[1]);
        ctx.lineTo(tip[0] - ux * head * back + uy * head * 0.6, tip[1] - uy * head * back - ux * head * 0.6);
      }
      ctx.stroke();
      return;
    }
    this.path(element.points);
    ctx.strokeStyle = cssVar(element.kind === 'mirror' ? '--mirror' : '--canvas-static-edge');
    ctx.lineWidth = (element.kind === 'mirror' ? 3.5 : 3) * k;
    ctx.stroke();
  }

  private axis([from, to]: [Vec, Vec]): void {
    const { ctx } = this;
    ctx.save();
    this.path([from, to]);
    ctx.strokeStyle = cssVar('--canvas-axis');
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 4, 2, 4]);
    ctx.stroke();
    ctx.restore();
  }

  /** A ray: solid where light really goes, with an arrowhead on each long stretch, and dashed back to a virtual image. */
  private ray(ray: RayInfo, objects: ObjectInfo[], plain: boolean): void {
    const { ctx } = this;
    const k = stageScale();
    const color = cssVar('--ray');
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = (plain || ray.faint ? 1.25 : 1.75) * k;
    if (ray.faint) ctx.globalAlpha = 0.4;
    this.path(ray.points);
    ctx.stroke();
    if (!plain && !ray.faint) {
      for (let i = 1; i < ray.points.length; i++) {
        const [a, b] = [this.camera.toScreen(...ray.points[i - 1]!), this.camera.toScreen(...ray.points[i]!)];
        // Only the part of a stretch that is on screen gets a head, placed in its middle.
        const clipped = this.clip(a, b);
        if (!clipped) continue;
        const [p, q] = clipped;
        const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (length < 46 * k) continue;
        const [ux, uy] = [(q[0] - p[0]) / length, (q[1] - p[1]) / length];
        const [mx, my] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        ctx.beginPath();
        ctx.moveTo(mx + ux * 6 * k, my + uy * 6 * k);
        ctx.lineTo(mx - ux * 5 * k - uy * 4.5 * k, my - uy * 5 * k + ux * 4.5 * k);
        ctx.lineTo(mx - ux * 5 * k + uy * 4.5 * k, my - uy * 5 * k - ux * 4.5 * k);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Produced backwards, the last stretch of a ray points at the virtual image it seems to come from.
    const n = ray.points.length;
    if (n >= 3 && ray.events.length) {
      const [turn, end] = [ray.points[n - 2]!, ray.points[n - 1]!];
      const length = Math.hypot(end[0] - turn[0], end[1] - turn[1]) || 1;
      const [dx, dy] = [(end[0] - turn[0]) / length, (end[1] - turn[1]) / length];
      for (const object of objects) {
        if (!object.image || object.image.real) continue;
        for (const point of [object.image.tip, object.image.base]) {
          const along = (point[0] - turn[0]) * dx + (point[1] - turn[1]) * dy;
          const off = Math.abs((point[0] - turn[0]) * dy - (point[1] - turn[1]) * dx);
          if (along < 0 && off < 0.03 * Math.abs(along) + 1e-6) {
            ctx.globalAlpha = 0.7;
            ctx.lineWidth = 1.25 * k;
            ctx.setLineDash([6 * k, 5 * k]);
            this.path([turn, [turn[0] + dx * along, turn[1] + dy * along]]);
            ctx.stroke();
            break;
          }
        }
      }
    }
    ctx.restore();
  }

  /** The part of a screen segment inside the canvas, or nothing. */
  private clip(a: Vec, b: Vec): [Vec, Vec] | undefined {
    let [t0, t1] = [0, 1];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    for (const [p, q] of [[-dx, a[0]], [dx, this.width - a[0]], [-dy, a[1]], [dy, this.height - a[1]]] as const) {
      if (p === 0) {
        if (q < 0) return undefined;
        continue;
      }
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
    return t0 < t1 ? [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]] : undefined;
  }

  private arrow(from: Vec, to: Vec, color: string, dashed: boolean): void {
    const { ctx } = this;
    const k = stageScale();
    const [a, b] = [this.camera.toScreen(...from), this.camera.toScreen(...to)];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3 * k;
    ctx.lineCap = 'round';
    if (dashed) ctx.setLineDash([7 * k, 6 * k]);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (length > 5 * k) {
      const head = Math.min(11 * k, 0.6 * length);
      const [ux, uy] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - ux * head - uy * head * 0.55, b[1] - uy * head + ux * head * 0.55);
      ctx.lineTo(b[0] - ux * head + uy * head * 0.55, b[1] - uy * head - ux * head * 0.55);
      ctx.closePath();
      dashed ? ctx.stroke() : ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(b[0], b[1], 3.5 * k, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }

  private object(object: ObjectInfo, plain: boolean): void {
    const k = stageScale();
    this.arrow(object.base, object.tip, cssVar('--canvas-body'), false);
    const image = object.image;
    if (image) this.arrow(image.base, image.tip, cssVar('--accent'), !image.real);
    if (plain) return;
    const label = (text: string, base: Vec, tip: Vec, color: string) => {
      const [sx, sy] = this.camera.toScreen(...base);
      // Under the axis for an upright arrow, above it for one hanging down, so the words are clear of it.
      const upright = this.camera.toScreen(...tip)[1] <= sy;
      this.text(text, sx, sy + (upright ? 18 : -9) * k, 'center', color, true);
    };
    label('object', object.base, object.tip, cssVar('--canvas-body'));
    if (image) label(image.real ? 'image' : 'image (virtual)', image.base, image.tip, cssVar('--accent'));
  }

  /** The normal where a ray meets a surface, and the angles it makes with it either side. */
  private angles(ray: RayInfo): void {
    const { ctx } = this;
    const k = stageScale();
    ray.events.forEach((event, index) => {
      if (event.kind === 'lens' || event.kind === 'absorbed') return;
      const [sx, sy] = this.camera.toScreen(...event.at);
      if (sx < -50 || sx > this.width + 50 || sy < -50 || sy > this.height + 50) return;
      // A fibre makes dozens of these, crowded together; only where the ray goes in is worth reading there.
      if (index > (ray.events.length > 4 ? 0 : 2)) return;
      const [nx, ny] = [event.normal[0], -event.normal[1]];
      const reach = 74 * k;
      ctx.save();
      ctx.strokeStyle = cssVar('--canvas-text');
      ctx.lineWidth = 1.25 * k;
      ctx.setLineDash([5 * k, 4 * k]);
      ctx.beginPath();
      ctx.moveTo(sx - nx * reach, sy - ny * reach);
      ctx.lineTo(sx + nx * reach, sy + ny * reach);
      ctx.stroke();
      ctx.restore();
      const before = ray.points[index]!;
      const after = ray.points[index + 2] ?? ray.points[index + 1]!;
      const angleTo = (p: Vec) => {
        const [px, py] = this.camera.toScreen(...p);
        return Math.atan2(py - sy, px - sx);
      };
      const normalIn = Math.atan2(ny, nx);
      const arc = (toward: number, from: number, text: string, radius: number) => {
        let turn = toward - from;
        while (turn > Math.PI) turn -= 2 * Math.PI;
        while (turn < -Math.PI) turn += 2 * Math.PI;
        ctx.strokeStyle = cssVar('--text');
        ctx.lineWidth = 1.5 * k;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, from, from + turn, turn < 0);
        ctx.stroke();
        const middle = from + turn / 2;
        const out = radius + 22 * k;
        this.text(text, sx + Math.cos(middle) * out, sy + Math.sin(middle) * out + 4 * k, 'center', cssVar('--text'), true);
      };
      arc(angleTo(before), normalIn, `${formatNumber(event.incidence)}°`, 30 * k);
      // The ray leaves on the side of the normal it arrived from if it was reflected, and on the far side if not.
      const leaves = event.kind === 'refraction' ? normalIn + Math.PI : normalIn;
      if (after !== before) arc(angleTo(after), leaves, `${formatNumber(event.emergence)}°`, 38 * k);
    });
  }

  private mark(at: Vec, label: string): void {
    const { ctx } = this;
    const k = stageScale();
    const [sx, sy] = this.camera.toScreen(...at);
    if (sx < 0 || sx > this.width) return;
    ctx.fillStyle = cssVar('--text');
    ctx.beginPath();
    ctx.arc(sx, sy, 3 * k, 0, 2 * Math.PI);
    ctx.fill();
    this.text(label, sx, sy + 19 * k, 'center', cssVar('--text'), true);
  }

  /** Words on the stage, on a patch of the background so that rays behind them do not cross them out. */
  private text(text: string, x: number, y: number, align: CanvasTextAlign, color: string, avoid: boolean): void {
    const { ctx } = this;
    const k = stageScale();
    ctx.font = stageFont(13, 600);
    const width = ctx.measureText(text).width;
    const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    const box = { x: left - 4 * k, y: y - 14 * k, w: width + 8 * k, h: 19 * k };
    if (avoid) {
      // Labels on the axis crowd one another; a later one steps down until it is clear.
      for (let tries = 0; tries < 4 && this.taken.some((o) => box.x < o.x + o.w && o.x < box.x + box.w && box.y < o.y + o.h && o.y < box.y + box.h); tries++) {
        box.y += 18 * k;
        y += 18 * k;
      }
      this.taken.push(box);
    }
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 4 * k);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }

  private knob(knob: Knob): void {
    const { ctx } = this;
    const k = stageScale();
    const [sx, sy] = this.camera.toScreen(...knob.at);
    ctx.beginPath();
    ctx.arc(sx, sy, (knob.active ? 8 : 6.5) * k, 0, Math.PI * 2);
    ctx.fillStyle = cssVar('--canvas-bg');
    ctx.fill();
    ctx.lineWidth = 2.5 * k;
    ctx.strokeStyle = cssVar('--accent');
    ctx.stroke();
    if (knob.active) this.text(knob.label, sx, sy - 16 * k, 'center', cssVar('--accent'), false);
  }
}
