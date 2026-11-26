import './landing.css';

/*
 * The scope shows the exact two-soliton solution of the KdV equation u_t + 6 u u_x + u_xxx = 0:
 * u = 2 (ln f)_xx with f = 1 + e^η1 + e^η2 + A e^(η1+η2), η_i = k_i x - k_i³ t, A = ((k1 - k2)/(k1 + k2))².
 * The tall soliton (k1) is faster, catches the short one, passes through it, and both come out as they went in.
 * The readouts are integrals of the drawn curve, worked out each frame: they stay put because KdV conserves them.
 */
const K1 = 1.25;
const K2 = 0.8;
const A = ((K1 - K2) / (K1 + K2)) ** 2;
const LN_A = Math.log(A);
const PEAK = (K1 * K1) / 2;
const X0 = -34;
const X1 = 34;
const T0 = -9;
const T1 = 14;

function height(x: number, t: number): number {
  const e1 = K1 * x - K1 ** 3 * t + 6;
  const e2 = K2 * x - K2 ** 3 * t;
  const e12 = e1 + e2 + LN_A;
  // Every term is divided by the largest, so nothing overflows however far out the solitons are.
  const top = Math.max(0, e1, e2, e12);
  const a0 = Math.exp(-top);
  const a1 = Math.exp(e1 - top);
  const a2 = Math.exp(e2 - top);
  const a12 = Math.exp(e12 - top);
  const f = a0 + a1 + a2 + a12;
  const f1 = K1 * a1 + K2 * a2 + (K1 + K2) * a12;
  const f2 = K1 * K1 * a1 + K2 * K2 * a2 + (K1 + K2) ** 2 * a12;
  return 2 * (f2 / f - (f1 / f) ** 2);
}

function scope(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const read = (name: string) => document.querySelector<HTMLElement>(`[data-read="${name}"]`);
  const clock = read('t');
  const mass = read('mass');
  const momentum = read('momentum');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = still ? 1.2 : T0;
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
    ctx.clearRect(0, 0, width, tall);
    const base = tall * 0.84;
    const scale = (tall * 0.66) / PEAK;
    const n = Math.max(240, Math.round(width / 2));
    const dx = (X1 - X0) / n;
    const points: [number, number][] = [];
    let m = 0;
    let p = 0;
    for (let i = 0; i <= n; i++) {
      const u = height(X0 + dx * i, t);
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

    const fill = ctx.createLinearGradient(0, base - scale * PEAK, 0, base);
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

    if (clock) clock.textContent = (t - T0).toFixed(2);
    if (mass) mass.textContent = m.toFixed(3);
    if (momentum) momentum.textContent = p.toFixed(3);
  };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible) {
      t += dt * 1.5;
      if (t > T1) t = T0;
      draw();
    }
    requestAnimationFrame(frame);
  };

  resize();
  addEventListener('resize', () => {
    resize();
    draw();
  });
  // Off screen, the scope stops drawing.
  new IntersectionObserver(([entry]) => (visible = entry!.isIntersecting)).observe(canvas);
  draw();
  if (!still) requestAnimationFrame(frame);
}

const canvas = document.querySelector<HTMLCanvasElement>('.scope-wave');
if (canvas) scope(canvas);

// The feature cards light up where the pointer is.
for (const card of document.querySelectorAll<HTMLElement>('.card')) {
  card.addEventListener('pointermove', (e) => {
    const box = card.getBoundingClientRect();
    card.style.setProperty('--x', `${e.clientX - box.left}px`);
    card.style.setProperty('--y', `${e.clientY - box.top}px`);
  });
}

// Sections rise into view as they are reached.
const rising = document.querySelectorAll<HTMLElement>('.section-head, .screen, .card, .class, .package, .faq details, .teachers-box, .stats');
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
