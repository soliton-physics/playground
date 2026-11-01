export interface Series {
  values: Float64Array;
  color: string;
  width: number;
  fill?: string;
}

const palette = {
  background: '#0b1020',
  grid: '#1e293b',
  axis: '#334155',
  text: '#94a3b8',
};

export class LinePlot {
  private readonly context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  draw(x: Float64Array, series: Series[], range: [number, number], time: number): void {
    const { context, width, height } = this;
    const margin = { left: 44, right: 12, top: 12, bottom: 28 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const [x0, x1] = [x[0] ?? 0, x[x.length - 1] ?? 1];
    const [y0, y1] = range;
    const toX = (v: number) => margin.left + ((v - x0) / (x1 - x0)) * plotWidth;
    const toY = (v: number) => margin.top + ((y1 - v) / (y1 - y0)) * plotHeight;

    context.fillStyle = palette.background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = palette.grid;
    context.lineWidth = 1;
    context.fillStyle = palette.text;
    context.font = '12px system-ui, sans-serif';
    context.textAlign = 'right';
    for (const tick of ticks(y0, y1, 5)) {
      const y = toY(tick);
      context.beginPath();
      context.moveTo(margin.left, y);
      context.lineTo(width - margin.right, y);
      context.stroke();
      context.fillText(tick.toFixed(1), margin.left - 6, y + 4);
    }
    context.textAlign = 'center';
    for (const tick of ticks(x0, x1, 8)) {
      context.fillText(tick.toFixed(0), toX(tick), height - 8);
    }

    context.strokeStyle = palette.axis;
    context.beginPath();
    context.moveTo(margin.left, toY(0));
    context.lineTo(width - margin.right, toY(0));
    context.stroke();

    for (const { values, color, width: lineWidth, fill } of series) {
      context.beginPath();
      for (let i = 0; i < values.length; i++) {
        const px = toX(x[i]!);
        const py = toY(values[i]!);
        i === 0 ? context.moveTo(px, py) : context.lineTo(px, py);
      }
      if (fill) {
        context.save();
        context.lineTo(toX(x1), toY(0));
        context.lineTo(toX(x0), toY(0));
        context.closePath();
        context.fillStyle = fill;
        context.fill();
        context.restore();
        context.beginPath();
        for (let i = 0; i < values.length; i++) {
          const px = toX(x[i]!);
          const py = toY(values[i]!);
          i === 0 ? context.moveTo(px, py) : context.lineTo(px, py);
        }
      }
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.lineJoin = 'round';
      context.stroke();
    }

    context.fillStyle = palette.text;
    context.textAlign = 'left';
    context.fillText(`t = ${time.toFixed(2)}`, margin.left + 8, margin.top + 16);
  }

  private resize(): void {
    const scale = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
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
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    result.push(Math.abs(v) < 1e-12 ? 0 : v);
  }
  return result;
}
