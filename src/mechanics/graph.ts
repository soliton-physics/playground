import { cssVar } from '../ui';

export interface GraphSeries {
  label: string;
  color: string;
  values: Float64Array;
}

/** A small time-series chart that autoscales and keeps zero visible when it is nearby. */
export class Graph {
  private readonly context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  constructor(private readonly canvas: HTMLCanvasElement, readonly title: string, readonly unit: string) {
    this.context = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  draw(time: Float64Array, series: GraphSeries[]): void {
    const ctx = this.context;
    const theme = { bg: cssVar('--canvas-bg'), grid: cssVar('--canvas-grid'), text: cssVar('--canvas-text'), axis: cssVar('--canvas-axis') };
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, this.width, this.height);
    const margin = { left: 44, right: 10, top: 36, bottom: 20 };
    const w = this.width - margin.left - margin.right;
    const h = this.height - margin.top - margin.bottom;
    const n = time.length;
    if (n < 1) return;
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) for (let i = 0; i < n; i++) {
      const v = s.values[i]!;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min)) return;
    if (min > 0 && min < 0.3 * max) min = 0;
    if (max < 0 && max > 0.3 * min) max = 0;
    if (max - min < 1e-9) {
      max += 1;
      min -= 1;
    }
    const pad = 0.08 * (max - min);
    min -= pad;
    max += pad;
    const t0 = time[0]!;
    const t1 = Math.max(time[n - 1]!, t0 + 1);
    const toX = (t: number) => margin.left + ((t - t0) / Math.max(t1 - t0, 1e-9)) * w;
    const toY = (v: number) => margin.top + ((max - v) / (max - min)) * h;

    ctx.strokeStyle = theme.grid;
    ctx.fillStyle = theme.text;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (const tick of ticks(min, max, 4)) {
      const y = toY(tick);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(this.width - margin.right, y);
      ctx.strokeStyle = Math.abs(tick) < 1e-12 ? theme.axis : theme.grid;
      ctx.stroke();
      ctx.fillText(format(tick), margin.left - 4, y + 4);
    }
    ctx.textAlign = 'center';
    for (const tick of ticks(t0, t1, 5)) ctx.fillText(`${tick.toFixed(1)}`, toX(tick), this.height - 5);

    for (const s of series) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = toX(time[i]!);
        const y = toY(s.values[i]!);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(toX(time[n - 1]!), toY(s.values[n - 1]!), 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = s.color;
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = theme.text;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${this.title}${this.unit ? ` (${this.unit})` : ''}`, margin.left, 14);
    let legendX = this.width - margin.right;
    ctx.textAlign = 'right';
    for (const s of [...series].reverse()) {
      ctx.fillStyle = s.color;
      ctx.fillText(s.label, legendX, 28);
      legendX -= ctx.measureText(s.label).width + 12;
    }
  }

  private resize(): void {
    const ratio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
}

function ticks(min: number, max: number, count: number): number[] {
  const raw = (max - min) / count;
  if (!(raw > 0)) return [min];
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.abs(v) < 1e-12 ? 0 : v);
  return out;
}

function format(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return v.toExponential(1);
  if (a >= 10) return v.toFixed(0);
  if (a >= 1) return v.toFixed(1);
  return v.toFixed(2);
}
