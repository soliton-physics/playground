import { cssVar, formatNumber, stageFont, stageScale } from '../ui';

/** The visible part of the plane: its centre and how many pixels one unit takes. Both axes share the scale. */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export const HOME: Camera = { x: 0, y: 0, scale: 60 };

export interface Bounds {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export interface Curve {
  /** `[x0, y0, x1, y1, …]` with a NaN pair where the line is cut. */
  points: Float64Array | number[];
  colour: string;
  width?: number;
  dashed?: boolean;
}

export interface Area {
  from: number;
  to: number;
  /** The curve between the limits, same form as `Curve.points`. */
  points: Float64Array | number[];
  colour: string;
  /** Strips of a Riemann sum: rectangles, or straight tops for the trapezium rule. */
  strips?: { edges: number[]; heights: number[]; rule: string };
}

export interface Marker {
  x: number;
  y: number;
  slope?: number;
  colour: string;
  label?: string;
}

export interface Scene {
  curves: Curve[];
  areas: Area[];
  markers: Marker[];
}

export class Plane {
  camera: Camera = { ...HOME };
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(): void {
    const ratio = devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  get pixels(): number {
    return Math.max(16, Math.round(this.width));
  }

  bounds(): Bounds {
    const { x, y, scale } = this.camera;
    return { left: x - this.width / 2 / scale, right: x + this.width / 2 / scale, bottom: y - this.height / 2 / scale, top: y + this.height / 2 / scale };
  }

  toScreen(x: number, y: number): [number, number] {
    const { camera: c } = this;
    return [this.width / 2 + (x - c.x) * c.scale, this.height / 2 - (y - c.y) * c.scale];
  }

  toPlane(px: number, py: number): [number, number] {
    const { camera: c } = this;
    return [c.x + (px - this.width / 2) / c.scale, c.y - (py - this.height / 2) / c.scale];
  }

  /** Zoom by `factor` keeping the plane point under the pixel `(px, py)` where it is. */
  zoom(factor: number, px: number, py: number): void {
    const [x, y] = this.toPlane(px, py);
    const scale = Math.min(1e7, Math.max(1e-4, this.camera.scale * factor));
    this.camera = { scale, x: x - (px - this.width / 2) / scale, y: y + (py - this.height / 2) / scale };
  }

  pan(dx: number, dy: number): void {
    this.camera = { ...this.camera, x: this.camera.x - dx / this.camera.scale, y: this.camera.y + dy / this.camera.scale };
  }

  draw(scene: Scene): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    this.grid();
    for (const area of scene.areas) this.area(area);
    for (const curve of scene.curves) this.curve(curve);
    for (const marker of scene.markers) this.marker(marker);
  }

  private step(): number {
    // grid lines about 80 px apart, on 1, 2, 5 × 10ⁿ
    const raw = 80 / this.camera.scale;
    const power = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw)!;
  }

  private grid(): void {
    const { ctx } = this;
    const b = this.bounds();
    const step = this.step();
    const minor = step / 5;
    const line = (colour: string, width: number, every: number) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let x = Math.ceil(b.left / every) * every; x <= b.right; x += every) {
        const [px] = this.toScreen(x, 0);
        ctx.moveTo(Math.round(px) + 0.5, 0);
        ctx.lineTo(Math.round(px) + 0.5, this.height);
      }
      for (let y = Math.ceil(b.bottom / every) * every; y <= b.top; y += every) {
        const [, py] = this.toScreen(0, y);
        ctx.moveTo(0, Math.round(py) + 0.5);
        ctx.lineTo(this.width, Math.round(py) + 0.5);
      }
      ctx.stroke();
    };
    line(cssVar('--canvas-grid'), 1, minor);
    line(cssVar('--canvas-grid-major'), 1, step);

    const [ox, oy] = this.toScreen(0, 0);
    ctx.strokeStyle = cssVar('--canvas-axis');
    ctx.lineWidth = 1.5 * stageScale();
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(this.width, oy);
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, this.height);
    ctx.stroke();

    // numbers along the axes, kept on screen when an axis is off it
    ctx.fillStyle = cssVar('--canvas-text');
    ctx.font = stageFont(12);
    const pad = 4 * stageScale();
    const labelY = Math.min(Math.max(oy + pad, pad), this.height - 18 * stageScale());
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = Math.ceil(b.left / step) * step; x <= b.right; x += step) {
      if (Math.abs(x) < step / 2) continue;
      const [px] = this.toScreen(x, 0);
      ctx.fillText(axisNumber(x, step), px, labelY);
    }
    const labelX = Math.min(Math.max(ox - pad, 30 * stageScale()), this.width - pad);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(b.bottom / step) * step; y <= b.top; y += step) {
      if (Math.abs(y) < step / 2) continue;
      const [, py] = this.toScreen(0, y);
      ctx.fillText(axisNumber(y, step), labelX, py);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('0', ox - pad, oy + pad);
  }

  private path(points: Float64Array | number[]): void {
    const { ctx } = this;
    let pen = false;
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i]!;
      const y = points[i + 1]!;
      if (Number.isNaN(x)) {
        pen = false;
        continue;
      }
      const [px, py] = this.toScreen(x, y);
      if (pen) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
      pen = true;
    }
  }

  private curve(curve: Curve): void {
    const { ctx } = this;
    ctx.beginPath();
    this.path(curve.points);
    ctx.strokeStyle = curve.colour;
    ctx.lineWidth = (curve.width ?? 2.5) * stageScale();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(curve.dashed ? [8 * stageScale(), 6 * stageScale()] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private area(area: Area): void {
    const { ctx } = this;
    const [, zero] = this.toScreen(0, 0);
    // each unbroken piece of the curve is closed down to the x-axis
    ctx.fillStyle = area.colour;
    ctx.globalAlpha = 0.18;
    let piece: [number, number][] = [];
    const fill = () => {
      if (piece.length > 1) {
        ctx.beginPath();
        ctx.moveTo(piece[0]![0], zero);
        for (const [px, py] of piece) ctx.lineTo(px, py);
        ctx.lineTo(piece[piece.length - 1]![0], zero);
        ctx.closePath();
        ctx.fill();
      }
      piece = [];
    };
    for (let i = 0; i < area.points.length; i += 2) {
      const x = area.points[i]!;
      if (Number.isNaN(x)) fill();
      else piece.push(this.toScreen(x, area.points[i + 1]!));
    }
    fill();
    ctx.globalAlpha = 1;

    if (area.strips) {
      const { edges, heights, rule } = area.strips;
      ctx.strokeStyle = area.colour;
      ctx.lineWidth = 1.2 * stageScale();
      ctx.fillStyle = area.colour;
      const top = (i: number): [number, number] => {
        // rectangles take one height per strip; the trapezium (and Simpson, drawn as such) one per edge
        if (rule === 'trapezium' || rule === 'simpson') return [heights[i]!, heights[i + 1]!];
        return [heights[i]!, heights[i]!];
      };
      for (let i = 0; i + 1 < edges.length; i++) {
        const [h0, h1] = top(i);
        if (!Number.isFinite(h0) || !Number.isFinite(h1)) continue;
        const [x0, y0] = this.toScreen(edges[i]!, h0);
        const [x1, y1] = this.toScreen(edges[i + 1]!, h1);
        ctx.beginPath();
        ctx.moveTo(x0, zero);
        ctx.lineTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1, zero);
        ctx.closePath();
        ctx.globalAlpha = 0.14;
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // the limits, as thin uprights
    ctx.strokeStyle = area.colour;
    ctx.lineWidth = 1.5 * stageScale();
    ctx.setLineDash([4 * stageScale(), 4 * stageScale()]);
    ctx.beginPath();
    for (const x of [area.from, area.to]) {
      const [px] = this.toScreen(x, 0);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, this.height);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private marker(m: Marker): void {
    const { ctx } = this;
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
    const [px, py] = this.toScreen(m.x, m.y);
    const s = stageScale();
    if (m.slope !== undefined && Number.isFinite(m.slope)) {
      // the tangent, across the whole view
      const b = this.bounds();
      const [ax, ay] = this.toScreen(b.left, m.y + m.slope * (b.left - m.x));
      const [bx, by] = this.toScreen(b.right, m.y + m.slope * (b.right - m.x));
      ctx.strokeStyle = cssVar('--text');
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = cssVar('--surface');
    ctx.strokeStyle = m.colour;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(px, py, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (m.label) {
      ctx.font = stageFont(13, 600);
      const w = ctx.measureText(m.label).width + 12 * s;
      const h = 22 * s;
      const lx = Math.min(px + 12 * s, this.width - w - 4);
      const ly = Math.max(py - h - 10 * s, 4);
      ctx.fillStyle = cssVar('--surface');
      ctx.strokeStyle = cssVar('--border-strong');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx, ly, w, h, 6 * s);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = cssVar('--text');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.label, lx + 6 * s, ly + h / 2);
    }
  }
}

/** An axis number with as many decimals as the grid step needs, and a true minus sign. */
function axisNumber(value: number, step: number): string {
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  if (Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-4 && value !== 0)) return formatNumber(value);
  return value.toFixed(Math.min(decimals, 8)).replace(/^-/, '−');
}
