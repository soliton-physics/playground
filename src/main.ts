import './style.css';
import { loadEngine, WaveSimulation } from './engine';
import { findPreset, presets, type Preset } from './presets';
import { LinePlot, type Series } from './render/line';

const query = new URLSearchParams(location.search);
const embedded = query.has('embed');
document.body.classList.toggle('embed', embedded);

const elements = {
  canvas: document.querySelector<HTMLCanvasElement>('#plot')!,
  preset: document.querySelector<HTMLSelectElement>('#preset')!,
  description: document.querySelector<HTMLParagraphElement>('#description')!,
  toggle: document.querySelector<HTMLButtonElement>('#toggle')!,
  reset: document.querySelector<HTMLButtonElement>('#reset')!,
  speed: document.querySelector<HTMLInputElement>('#speed')!,
  speedValue: document.querySelector<HTMLOutputElement>('#speed-value')!,
  readout: document.querySelector<HTMLDListElement>('#readout')!,
};

for (const preset of presets) {
  elements.preset.add(new Option(preset.title, preset.id));
}

const plot = new LinePlot(elements.canvas);

class Session {
  readonly sim: WaveSimulation;
  readonly x: Float64Array;
  readonly initial: Record<string, number>;
  running = true;

  constructor(readonly preset: Preset) {
    this.sim = new WaveSimulation(preset.model, preset.points, preset.length, preset.dt);
    this.x = this.sim.positions();
    preset.setup(this.sim, this.x);
    this.initial = { ...this.sim.invariants() };
  }

  frame(steps: number): void {
    if (this.running) this.sim.step(steps);
    plot.draw(this.x, this.series(), this.preset.range, this.sim.time());
  }

  series(): Series[] {
    if (this.preset.model === 'kdv') {
      return [{ values: this.sim.real(), color: '#22d3ee', width: 2.5, fill: 'rgba(34, 211, 238, 0.12)' }];
    }
    return [
      { values: this.sim.real(), color: 'rgba(192, 132, 252, 0.45)', width: 1.25 },
      { values: this.sim.magnitude(), color: '#22d3ee', width: 2.5, fill: 'rgba(34, 211, 238, 0.12)' },
    ];
  }

  readout(): [string, string][] {
    const rows: [string, string][] = [['time', this.sim.time().toFixed(3)]];
    for (const [name, value] of Object.entries(this.sim.invariants())) {
      const drift = Math.abs(value - this.initial[name]!) / Math.max(Math.abs(this.initial[name]!), 1);
      rows.push([name, `${value.toFixed(6)}  (drift ${drift.toExponential(1)})`]);
    }
    return rows;
  }

  dispose(): void {
    this.sim.free();
  }
}

let session: Session | undefined;

function start(preset: Preset): void {
  session?.dispose();
  session = new Session(preset);
  elements.preset.value = preset.id;
  elements.description.textContent = preset.description;
  elements.speed.value = String(preset.stepsPerFrame);
  elements.speedValue.value = elements.speed.value;
  elements.toggle.textContent = 'Pause';
  if (!embedded) history.replaceState(null, '', `?preset=${preset.id}`);
}

elements.preset.addEventListener('change', () => start(findPreset(elements.preset.value)));
elements.reset.addEventListener('click', () => session && start(session.preset));
elements.toggle.addEventListener('click', () => {
  if (!session) return;
  session.running = !session.running;
  elements.toggle.textContent = session.running ? 'Pause' : 'Play';
});
elements.speed.addEventListener('input', () => (elements.speedValue.value = elements.speed.value));

let lastReadout = 0;
function loop(now: number): void {
  if (session) {
    session.frame(Number(elements.speed.value));
    if (now - lastReadout > 250) {
      lastReadout = now;
      elements.readout.replaceChildren(
        ...session.readout().flatMap(([name, value]) => {
          const dt = document.createElement('dt');
          const dd = document.createElement('dd');
          dt.textContent = name;
          dd.textContent = value;
          return [dt, dd];
        }),
      );
    }
  }
  requestAnimationFrame(loop);
}

await loadEngine();
start(findPreset(query.get('preset')));
requestAnimationFrame(loop);
