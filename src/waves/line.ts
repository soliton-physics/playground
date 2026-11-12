import { cssVar } from '../ui';

export interface Series {
  values: Float64Array;
  color: string;
  width: number;
  fill?: string;
}

const MARGIN = { left: 46, top: 16 };

/** The field against position, with a fixed vertical range so a soliton's height can be read off. */
export class LinePlot {
  private readonly context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private x0 = 0;
  private x1 = 1;
  private y0 = 0;
  private y1 = 1;
  /** Pixels kept clear on the right, for the panel that floats there. */
  right = 16;
  /** Pixels kept clear below, for the dock and whatever sits above it. */
  bottom = 92;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  /** The field coordinates under a canvas pixel, for drawing a profile by hand. */
  toField(px: number, py: number): [number, number] {
    const w = this.width - MARGIN.left - this.right;
    const h = this.height - MARGIN.top - this.bottom;
    return [this.x0 + ((px - MARGIN.left) / w) * (this.x1 - this.x0), this.y1 - ((py - MARGIN.top) / h) * (this.y1 - this.y0)];
  }

  draw(x: Float64Array, series: Series[], range: [number, number]): void {
    const { context, width, height } = this;
    const plotWidth = width - MARGIN.left - this.right;
    const plotHeight = height - MARGIN.top - this.bottom;
    [this.x0, this.x1] = [x[0] ?? 0, x[x.length - 1] ?? 1];
    [this.y0, this.y1] = range;
    const { x0, x1, y0, y1 } = this;
    const toX = (v: number) => MARGIN.left + ((v - x0) / (x1 - x0)) * plotWidth;
    const toY = (v: number) => MARGIN.top + ((y1 - v) / (y1 - y0)) * plotHeight;

    context.fillStyle = cssVar('--canvas-bg');
    context.fillRect(0, 0, width, height);
    context.lineWidth = 1;
    context.fillStyle = cssVar('--canvas-text');
    context.font = '11px Inter, ui-sans-serif, system-ui, sans-serif';
    context.textAlign = 'right';
    for (const tick of ticks(y0, y1, 6)) {
      const y = Math.round(toY(tick)) + 0.5;
      context.strokeStyle = tick === 0 ? cssVar('--canvas-axis') : cssVar('--canvas-grid-major');
      context.beginPath();
      context.moveTo(MARGIN.left, y);
      context.lineTo(width - this.right, y);
      context.stroke();
      context.fillText(tick.toFixed(1), MARGIN.left - 8, y + 4);
    }
    context.textAlign = 'center';
    for (const tick of ticks(x0, x1, 10)) {
      const px = Math.round(toX(tick)) + 0.5;
      context.strokeStyle = cssVar('--canvas-grid');
      context.beginPath();
      context.moveTo(px, MARGIN.top);
      context.lineTo(px, height - this.bottom);
      context.stroke();
      context.fillText(tick.toFixed(0), px, height - this.bottom + 16);
    }

    for (const { values, color, width: lineWidth, fill } of series) {
      const trace = () => {
        context.beginPath();
        for (let i = 0; i < values.length; i++) {
          const px = toX(x[i]!);
          const py = toY(values[i]!);
          i === 0 ? context.moveTo(px, py) : context.lineTo(px, py);
        }
      };
      if (fill) {
        trace();
        context.lineTo(toX(x1), toY(0));
        context.lineTo(toX(x0), toY(0));
        context.closePath();
        context.fillStyle = fill;
        context.fill();
      }
      trace();
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.lineJoin = 'round';
      context.stroke();
    }
  }

  private resize(): void {
    const scale = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * scale);
    this.canvas.height = Math.round(rect.height * scale);
    this.context.setTransform(scale, 0, 0, scale, 0, 0);
  }
}

function ticks(min: number, max: number, count: number): number[] {
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const result: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) result.push(Math.abs(v) < 1e-12 ? 0 : v);
  return result;
}
