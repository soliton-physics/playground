import './landing.css';

/*
 * The hero is a small carousel of live scenes, each drawn from its exact solution frame by frame. The readouts are
 * worked out from the drawn motion itself, and stay put because the physics conserves or predicts them.
 */
const G = 9.80665;

interface Slide {
  title: string;
  caption: string;
  href: string;
  labels: [string, string];
  status: string;
  /** Seconds of the scene's own time shown before the carousel moves on. */
  length: number;
  /** Scene seconds per real second. */
  rate: number;
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, t: number): [string, string];
}

/*
 * Two solitons: the exact two-soliton solution of the KdV equation u_t + 6 u u_x + u_xxx = 0,
 * u = 2 (ln f)_xx with f = 1 + e^η1 + e^η2 + A e^(η1+η2), η_i = k_i x - k_i³ t, A = ((k1 - k2)/(k1 + k2))².
 * The tall soliton (k1) is faster, catches the short one, passes through it, and both come out as they went in.
 * The readouts are integrals of the drawn curve, worked out each frame: they stay put because KdV conserves them.
 */
function solitons(): Slide {
  const [k1, k2] = [1.25, 0.8];
  const lnA = Math.log(((k1 - k2) / (k1 + k2)) ** 2);
  const peak = (k1 * k1) / 2;
  const [x0, x1, t0, t1] = [-34, 34, -9, 14];
  const height = (x: number, t: number) => {
    const e1 = k1 * x - k1 ** 3 * t + 6;
    const e2 = k2 * x - k2 ** 3 * t;
    const e12 = e1 + e2 + lnA;
    // Every term is divided by the largest, so nothing overflows however far out the solitons are.
    const top = Math.max(0, e1, e2, e12);
    const [a0, a1, a2, a12] = [Math.exp(-top), Math.exp(e1 - top), Math.exp(e2 - top), Math.exp(e12 - top)];
    const f = a0 + a1 + a2 + a12;
    const f1 = k1 * a1 + k2 * a2 + (k1 + k2) * a12;
    const f2 = k1 * k1 * a1 + k2 * k2 * a2 + (k1 + k2) ** 2 * a12;
    return 2 * (f2 / f - (f1 / f) ** 2);
  };

  return {
    title: 'KdV equation · two solitons',
    caption: 'The tall soliton is faster. It passes straight through the short one, and both come out unchanged.',
    href: '/play?mode=waves&preset=kdv-collision',
    labels: ['mass ∫u dx', 'momentum ∫u² dx'],
    status: 'conserved',
    length: t1 - t0,
    rate: 1.5,
    draw(ctx, width, tall, time) {
      const t = t0 + time;
      const base = tall * 0.84;
      const scale = (tall * 0.66) / peak;
      const n = Math.max(240, Math.round(width / 2));
      const dx = (x1 - x0) / n;
      const points: [number, number][] = [];
      let m = 0;
      let p = 0;
      for (let i = 0; i <= n; i++) {
        const u = height(x0 + dx * i, t);
        const w = i === 0 || i === n ? 0.5 : 1;
        m += w * u * dx;
        p += w * u * u * dx;
        points.push([(width * i) / n, base - scale * u]);
      }

      // The axis the wave rests on.
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(0, base + 0.5);
      ctx.lineTo(width, base + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      const fill = ctx.createLinearGradient(0, base - scale * peak, 0, base);
      fill.addColorStop(0, 'rgba(96, 165, 250, 0.38)');
      fill.addColorStop(1, 'rgba(96, 165, 250, 0)');
      ctx.beginPath();
      ctx.moveTo(0, base);
      for (const [px, py] of points) ctx.lineTo(px, py);
      ctx.lineTo(width, base);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      const stroke = ctx.createLinearGradient(0, 0, width, 0);
      stroke.addColorStop(0, '#22d3ee');
      stroke.addColorStop(0.5, '#60a5fa');
      stroke.addColorStop(1, '#c084fc');
      ctx.beginPath();
      points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.strokeStyle = stroke;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(96, 165, 250, 0.9)';
      ctx.shadowBlur = 22;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.stroke();
      return [m.toFixed(3), p.toFixed(3)];
    },
  };
}

/*
 * The collision fountain: two inclines leaning 30° out from upright, and pairs of balls that meet over the middle at the
 * top of their arcs. Moving straight at each other, equal elastic balls swap velocities, so each goes back the way it
 * came; it falls to its incline, strikes it square on and returns. Each round trip is four falls of u tan θ / g, and
 * the pairs make 10, 11, 12 … meetings per cycle, so after one cycle every pair meets at once again.
 */
function fountain(): Slide {
  const lean = (30 * Math.PI) / 180;
  const [sin, cos, tan] = [Math.sin(lean), Math.cos(lean), Math.tan(lean)];
  const cycle = 30;
  const pairs = 8;
  const radius = 0.3;
  const arcs = Array.from({ length: pairs }, (_, k) => {
    const period = cycle / (10 + k);
    const u = (G * period) / (4 * tan);
    const x = -radius - (u * u * tan) / G;
    const y = (radius - x * cos) / sin;
    const height = y + (u * u * tan * tan) / (2 * G);
    return { period, u, height, fall: period / 4 };
  });
  const colours = Array.from({ length: 2 * pairs }, (_, k) => `hsl(${(k / (2 * pairs - 1)) * 300} 90% 62%)`);
  // Where the left ball of pair k is at time t; the right one is its mirror image.
  const place = (k: number, t: number): [number, number, number, number] => {
    const { u, height, fall } = arcs[k]!;
    const half = t % (2 * fall);
    const going = half < fall;
    const s = going ? half : 2 * fall - half;
    return [-(radius + u * s), height - 0.5 * G * s * s, going ? -u : u, going ? -G * s : G * s];
  };
  const top = arcs[0]!.height + 1.2;
  const bottom = 4.2;

  return {
    title: 'The collision fountain',
    caption: 'Each pair meets at the top of its arc, falls to an incline, strikes it square on and comes back. Every pair meets at once again after 30 s.',
    href: '/play?mode=mechanics&scenario=collision-fountain',
    labels: ['next time all meet', 'total energy'],
    status: 'conserved',
    length: cycle,
    rate: 2,
    draw(ctx, width, height, t) {
      // Fit the height, and on a narrow screen the widest arc.
      const widest = radius + (arcs[0]!.u ** 2 * tan) / G + 2 * radius;
      const scale = Math.min((height * 0.94) / (top - bottom), (width * 0.48) / widest);
      const sx = (x: number) => width / 2 + x * scale;
      const sy = (y: number) => height * 0.97 - (y - bottom) * scale;

      // The two inclines, filled outside the V and lit along their faces.
      const reach = top + 2;
      for (const side of [-1, 1]) {
        const edge: [number, number] = [side * reach * tan, reach];
        ctx.beginPath();
        ctx.moveTo(sx(0), sy(0));
        ctx.lineTo(sx(edge[0]), sy(edge[1]));
        ctx.lineTo(side * width * 2, sy(edge[1]));
        ctx.lineTo(side * width * 2, sy(0));
        ctx.closePath();
        const fill = ctx.createLinearGradient(sx(0), 0, side < 0 ? 0 : width, 0);
        fill.addColorStop(0, 'rgba(96, 165, 250, 0.10)');
        fill.addColorStop(1, 'rgba(96, 165, 250, 0.02)');
        ctx.fillStyle = fill;
        ctx.fill();
        const line = ctx.createLinearGradient(0, sy(bottom), 0, 0);
        line.addColorStop(0, side < 0 ? '#22d3ee' : '#c084fc');
        line.addColorStop(1, 'rgba(96, 165, 250, 0.25)');
        ctx.beginPath();
        ctx.moveTo(sx(0), sy(0));
        ctx.lineTo(sx(edge[0]), sy(edge[1]));
        ctx.strokeStyle = line;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      let energy = 0;
      const ball = Math.max(2.5, radius * scale);
      arcs.forEach((arc, k) => {
        for (const side of [-1, 1]) {
          const colour = colours[side < 0 ? k : 2 * pairs - 1 - k]!;
          // The whole arc, faintly, then a comet's tail of the last third of a second.
          ctx.globalAlpha = 0.13;
          ctx.strokeStyle = colour;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const [x, y] = place(k, (arc.fall * i) / 40);
            const px = sx(side * -x);
            i ? ctx.lineTo(px, sy(y)) : ctx.moveTo(px, sy(y));
          }
          ctx.stroke();
          const steps = 18;
          for (let i = steps; i > 0; i--) {
            const [x0, y0] = place(k, Math.max(0, t - (0.32 * i) / steps));
            const [x1, y1] = place(k, Math.max(0, t - (0.32 * (i - 1)) / steps));
            ctx.globalAlpha = 0.6 * (1 - i / steps);
            ctx.lineWidth = ball * 1.4 * (1 - i / steps) + 0.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(sx(side * -x0), sy(y0));
            ctx.lineTo(sx(side * -x1), sy(y1));
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          const [x, y, vx, vy] = place(k, t);
          energy += 0.5 * (vx * vx + vy * vy) + G * y;
          ctx.shadowColor = colour;
          ctx.shadowBlur = 16;
          ctx.fillStyle = colour;
          ctx.beginPath();
          ctx.arc(sx(side * -x), sy(y), ball, 0, 2 * Math.PI);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        // A ring where the pair has just met.
        const since = t % (2 * arc.fall);
        if (since < 0.35) {
          const k2 = since / 0.35;
          ctx.globalAlpha = 0.7 * (1 - k2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx(0), sy(arc.height), ball * (1.2 + 3 * k2), 0, 2 * Math.PI);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });
      const next = cycle - (t % cycle);
      return [`in ${next.toFixed(1)} s`, `${energy.toFixed(1)} J`];
    },
  };
}

/*
 * A block on a rough incline: 35° and μ = 0.3, so it slides with a = g (sin θ − μ cos θ). The acceleration shown is
 * measured from the drawn motion, by the change in its speed, and agrees with the textbook's.
 */
function incline(): Slide {
  const theta = (35 * Math.PI) / 180;
  const mu = 0.3;
  const a = G * (Math.sin(theta) - mu * Math.cos(theta));
  const length = 5;
  const rest = 0.7;
  const slide = Math.sqrt((2 * length) / a);
  const round = rest + slide + 0.9;
  const along = (t: number) => {
    const s = Math.min(Math.max(0, (t % round) - rest), slide);
    return 0.5 * a * s * s;
  };

  const arrow = (ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, colour: string, label: string) => {
    const size = Math.hypot(dx, dy);
    const [ux, uy] = [dx / size, dy / size];
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx - ux * 8, y + dy - uy * 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + dx, y + dy);
    ctx.lineTo(x + dx - ux * 11 - uy * 6, y + dy - uy * 11 + ux * 6);
    ctx.lineTo(x + dx - ux * 11 + uy * 6, y + dy - uy * 11 - ux * 6);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '600 12px "Space Grotesk Variable", system-ui, sans-serif';
    ctx.fillText(label, x + dx + ux * 8 + (uy > 0.5 ? 6 : 0), y + dy + uy * 8 + 4);
  };

  return {
    title: 'A block on a rough incline',
    caption: 'Gravity pulls it down the slope, friction holds it back. The acceleration measured from its motion matches g (sin θ − μ cos θ).',
    href: '/play?mode=mechanics&scenario=incline-friction',
    labels: ['acceleration, measured', 'textbook g(sin θ − μ cos θ)'],
    status: 'matches',
    length: 3 * round,
    rate: 1,
    draw(ctx, width, height, t) {
      const run = Math.min(width * 0.74, (height * 0.6) / Math.tan(theta));
      const rise = run * Math.tan(theta);
      const [x0, y0] = [(width - run) / 2, height * 0.88 - rise];
      const [x1, y1] = [x0 + run, height * 0.88];
      const slope = Math.hypot(run, rise);
      const [ux, uy] = [run / slope, rise / slope];
      const [nx, ny] = [uy, -ux];

      // The incline, its face lit.
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x0, y1);
      ctx.closePath();
      const fill = ctx.createLinearGradient(x0, y0, x0, y1);
      fill.addColorStop(0, 'rgba(96, 165, 250, 0.16)');
      fill.addColorStop(1, 'rgba(96, 165, 250, 0.03)');
      ctx.fillStyle = fill;
      ctx.fill();
      const face = ctx.createLinearGradient(x0, y0, x1, y1);
      face.addColorStop(0, '#22d3ee');
      face.addColorStop(1, '#c084fc');
      ctx.strokeStyle = face;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x1, y1, 44, Math.PI, Math.PI + theta);
      ctx.stroke();
      ctx.fillStyle = 'rgba(203, 213, 225, 0.8)';
      ctx.font = '500 12px ui-monospace, Menlo, monospace';
      ctx.fillText('35°', x1 - 80, y1 - 8);
      ctx.fillText('μ = 0.3', x0 + 10, y1 - 12);

      // The block, with where it has been.
      const box = Math.max(26, height * 0.11);
      const start = box * 0.7;
      const travel = slope - 2 * start;
      const pos = (s: number) => {
        const d = start + (s / length) * travel;
        return [x0 + ux * d + nx * (box / 2), y0 + uy * d + ny * (box / 2)] as const;
      };
      const s = along(t);
      for (let i = 6; i > 0; i--) {
        // Only this run's past: the last run ended at the bottom.
        const [px, py] = pos(along(Math.max(t - (t % round), t - i * 0.06)));
        ctx.globalAlpha = 0.07 * (7 - i);
        ctx.fillStyle = '#60a5fa';
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(theta);
        ctx.fillRect(-box / 2, -box / 2, box, box);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      const [bx, by] = pos(s);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(theta);
      const body = ctx.createLinearGradient(-box / 2, -box / 2, box / 2, box / 2);
      body.addColorStop(0, '#22d3ee');
      body.addColorStop(1, '#818cf8');
      ctx.shadowColor = 'rgba(96, 165, 250, 0.9)';
      ctx.shadowBlur = 22;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.roundRect(-box / 2, -box / 2, box, box, 5);
      ctx.fill();
      ctx.restore();

      // Its free-body diagram: weight, the normal force, and friction against the motion.
      const unit = box * 1.5;
      arrow(ctx, bx, by, 0, unit, '#fbbf24', 'mg');
      arrow(ctx, bx, by, nx * unit * Math.cos(theta), ny * unit * Math.cos(theta), '#34d399', 'N');
      arrow(ctx, bx, by, -ux * unit * mu * Math.cos(theta) * 1.6, -uy * unit * mu * Math.cos(theta) * 1.6, '#f472b6', 'f');

      // Measured: the change in speed over a short interval, while it slides.
      const h = 0.02;
      const moving = (t % round) - rest;
      const measured = moving > h && moving < slide - h ? (along(t + h) - 2 * along(t) + along(t - h)) / (h * h) : NaN;
      return [Number.isFinite(measured) ? `${measured.toFixed(2)} m/s²` : '— at rest', `${a.toFixed(2)} m/s²`];
    },
  };
}

/*
 * Three equal stars on a figure eight (Chenciner and Montgomery, 2000), in units where G = 1 and each mass is 1.
 * There is no formula for this one: the stars are stepped forward here with a symplectic leapfrog, as the engine
 * does, and the energy shown is worked out from where they are, so its staying put is the check.
 */
function threeStars(): Slide {
  const period = 6.325913985;
  const colours = ['#22d3ee', '#c084fc', '#fbbf24'];
  const h = 0.001;
  let p: number[][] = [];
  let v: number[][] = [];
  let time = 0;
  let tail: number[][][] = [];
  let path: number[][] = [];
  const reset = () => {
    const [x, y, vx, vy] = [0.97000436, -0.24308753, -0.93240737, -0.86473146];
    p = [[x, y], [-x, -y], [0, 0]];
    v = [[-vx / 2, -vy / 2], [-vx / 2, -vy / 2], [vx, vy]];
    time = 0;
    tail = [[], [], []];
    path = [];
  };
  const accelerations = () => {
    const a = [[0, 0], [0, 0], [0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const dx = p[j]![0]! - p[i]![0]!;
        const dy = p[j]![1]! - p[i]![1]!;
        const r3 = Math.hypot(dx, dy) ** 3;
        a[i]![0]! += dx / r3;
        a[i]![1]! += dy / r3;
        a[j]![0]! -= dx / r3;
        a[j]![1]! -= dy / r3;
      }
    }
    return a;
  };
  const energy = () => {
    let e = 0;
    for (let i = 0; i < 3; i++) {
      e += 0.5 * (v[i]![0]! ** 2 + v[i]![1]! ** 2);
      for (let j = i + 1; j < 3; j++) e -= 1 / Math.hypot(p[j]![0]! - p[i]![0]!, p[j]![1]! - p[i]![1]!);
    }
    return e;
  };
  let a: number[][] = [];
  reset();
  a = accelerations();
  let steps = 0;

  return {
    title: 'Three stars on a figure eight',
    caption: 'Three equal stars, each pulled by the other two, chase one another round a figure eight. One of the very few exact dances of three bodies, found in 1993.',
    href: '/play?mode=mechanics&scenario=figure-eight',
    labels: ['laps round the eight', 'total energy'],
    status: 'conserved',
    length: 2 * period,
    rate: 1,
    draw(ctx, width, height, t) {
      if (t < time) {
        reset();
        a = accelerations();
      }
      while (time < t) {
        for (let i = 0; i < 3; i++) {
          v[i]![0]! += 0.5 * h * a[i]![0]!;
          v[i]![1]! += 0.5 * h * a[i]![1]!;
          p[i]![0]! += h * v[i]![0]!;
          p[i]![1]! += h * v[i]![1]!;
        }
        a = accelerations();
        for (let i = 0; i < 3; i++) {
          v[i]![0]! += 0.5 * h * a[i]![0]!;
          v[i]![1]! += 0.5 * h * a[i]![1]!;
        }
        time += h;
        if (++steps % 8 === 0) {
          p.forEach((q, i) => {
            tail[i]!.push([q[0]!, q[1]!]);
            if (tail[i]!.length > 290) tail[i]!.shift();
          });
          if (time < period + 0.02) path.push([p[0]![0]!, p[0]![1]!]);
        }
      }
      const scale = Math.min((width * 0.43) / 1.1, (height * 0.42) / 0.42);
      const sx = (x: number) => width / 2 + x * scale;
      const sy = (y: number) => height / 2 - y * scale;

      // The eight itself, faintly, as the first star draws it on its first lap.
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      path.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x!), sy(y!)) : ctx.moveTo(sx(x!), sy(y!))));
      ctx.stroke();
      tail.forEach((points, i) => {
        const colour = colours[i]!;
        ctx.strokeStyle = colour;
        ctx.lineCap = 'round';
        for (let k = 1; k < points.length; k++) {
          const f = k / points.length;
          ctx.globalAlpha = 0.75 * f;
          ctx.lineWidth = 1 + 4 * f;
          ctx.beginPath();
          ctx.moveTo(sx(points[k - 1]![0]!), sy(points[k - 1]![1]!));
          ctx.lineTo(sx(points[k]![0]!), sy(points[k]![1]!));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowColor = colour;
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx(p[i]![0]!), sy(p[i]![1]!), Math.max(4, scale * 0.045), 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = colour;
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      });
      return [(time / period).toFixed(2), energy().toFixed(5)];
    },
  };
}

function scope(figure: HTMLElement): void {
  const canvas = figure.querySelector<HTMLCanvasElement>('.scope-wave')!;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const slides = [solitons(), fountain(), incline(), threeStars()];
  const pick = <T extends Element>(selector: string) => figure.querySelector<T>(selector);
  const clock = pick<HTMLElement>('[data-read="t"]');
  const reads = [pick<HTMLElement>('[data-read="0"]'), pick<HTMLElement>('[data-read="1"]')];
  const labels = [pick<HTMLElement>('[data-label="0"]'), pick<HTMLElement>('[data-label="1"]')];
  const status = pick<HTMLElement>('[data-read="status"]');
  const title = pick<HTMLElement>('[data-slide="title"]');
  const caption = pick<HTMLElement>('[data-slide="caption"]');
  const open = pick<HTMLAnchorElement>('[data-slide="href"]');
  const dots = [...figure.querySelectorAll<HTMLButtonElement>('.slide-dot')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 0;
  let t = 0;
  let last = performance.now();
  let width = 0;
  let tall = 0;
  let visible = true;

  const resize = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    tall = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(tall * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const draw = () => {
    const slide = slides[current]!;
    ctx.clearRect(0, 0, width, tall);
    const values = slide.draw(ctx, width, tall, t);
    if (clock) clock.textContent = t.toFixed(2);
    values.forEach((value, i) => reads[i] && (reads[i]!.textContent = value));
    dots.forEach((dot, i) => {
      const bar = dot.firstElementChild as HTMLElement | null;
      if (bar) bar.style.transform = `scaleX(${i === current ? Math.min(1, t / slide.length) : 0})`;
    });
  };

  const show = (index: number) => {
    current = index;
    t = still ? 4.3 : 0;
    const slide = slides[current]!;
    if (title) title.textContent = slide.title;
    if (caption) caption.textContent = slide.caption;
    if (open) open.href = slide.href;
    if (status) status.textContent = slide.status;
    slide.labels.forEach((label, i) => labels[i] && (labels[i]!.textContent = label));
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
    canvas.classList.remove('fade');
    void canvas.offsetWidth;
    canvas.classList.add('fade');
    draw();
  };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible) {
      t += dt * slides[current]!.rate;
      if (t >= slides[current]!.length) show((current + 1) % slides.length);
      else draw();
    }
    requestAnimationFrame(frame);
  };

  dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
  resize();
  addEventListener('resize', () => {
    resize();
    draw();
  });
  // Off screen, the scope stops drawing.
  new IntersectionObserver(([entry]) => (visible = entry!.isIntersecting)).observe(canvas);
  show(0);
  if (!still) requestAnimationFrame(frame);
}

const hero = document.querySelector<HTMLElement>('.scope');
if (hero) scope(hero);

// The feature cards light up where the pointer is.
for (const card of document.querySelectorAll<HTMLElement>('.card, .builder')) {
  card.addEventListener('pointermove', (e) => {
    const box = card.getBoundingClientRect();
    card.style.setProperty('--x', `${e.clientX - box.left}px`);
    card.style.setProperty('--y', `${e.clientY - box.top}px`);
  });
}

// Sections rise into view as they are reached.
const rising = document.querySelectorAll<HTMLElement>('.section-head, .screen, .card, .builder, .class, .package, .faq details, .teachers-box, .stats');
const watcher = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('shown');
      // Once in place, a card answers the pointer at once.
      setTimeout(() => ((entry.target as HTMLElement).style.transitionDelay = ''), 1000);
      watcher.unobserve(entry.target);
    }
  },
  { rootMargin: '0px 0px -8% 0px' },
);
rising.forEach((node, i) => {
  node.classList.add('reveal');
  if (node.classList.contains('card')) node.style.transitionDelay = `${(i % 4) * 80}ms`;
  watcher.observe(node);
});

/*
 * Download counts: the page carries the last known figures, then asks the registries for today's: npm directly,
 * PyPI through the site's own /stats route. Every count rolls up from zero the first time it comes into view.
 */
const counts = new Map<string, number>();
for (const node of document.querySelectorAll<HTMLElement>('[data-count]')) {
  counts.set(node.dataset.count!, Number(node.textContent!.replace(/\D/g, '')));
}
const show = (name: string, value: number) => {
  for (const node of document.querySelectorAll<HTMLElement>(`[data-count="${name}"]`)) {
    node.textContent = value.toLocaleString('en-IN');
  }
};
const roll = (node: HTMLElement) => {
  const start = performance.now();
  const step = (now: number) => {
    // Read afresh each frame, so figures that arrive mid-roll are where it ends.
    const target = counts.get(node.dataset.count!) ?? 0;
    const k = Math.min(1, (now - start) / 1400);
    node.textContent = Math.round(target * (1 - (1 - k) ** 3)).toLocaleString('en-IN');
    if (k < 1) requestAnimationFrame(step);
  };
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(step);
};
const counter = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    roll(entry.target as HTMLElement);
    counter.unobserve(entry.target);
  }
});
document.querySelectorAll<HTMLElement>('[data-count]').forEach((node) => counter.observe(node));

async function fetchCounts(): Promise<void> {
  const [npm, pypi] = await Promise.all([
    fetch('https://api.npmjs.org/downloads/point/2020-01-01:2100-01-01/@soliton-physics/engine')
      .then((r) => r.json())
      .then((d: { downloads?: number }) => d.downloads)
      .catch(() => undefined),
    fetch('/stats/pypi')
      .then((r) => r.json())
      .then((d: { data?: { downloads: number }[] }) => d.data?.reduce((sum, day) => sum + day.downloads, 0))
      .catch(() => undefined),
  ]);
  if (npm && npm > (counts.get('npm') ?? 0)) counts.set('npm', npm);
  if (pypi && pypi > (counts.get('pypi') ?? 0)) counts.set('pypi', pypi);
  counts.set('downloads', (counts.get('npm') ?? 0) + (counts.get('pypi') ?? 0));
  for (const name of ['npm', 'pypi', 'downloads']) show(name, counts.get(name)!);
}
void fetchCounts();

// The install commands copy themselves.
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  button.addEventListener('click', async () => {
    const label = button.querySelector('.copy')!;
    try {
      await navigator.clipboard.writeText(button.dataset.copy!);
      label.textContent = 'Copied';
    } catch {
      label.textContent = 'Select it';
    }
    setTimeout(() => (label.textContent = 'Copy'), 1600);
  });
}
