import { MechanicsWorld, mechanics_catalogue } from '../engine';
import { el, formatNumber, query as q } from '../ui';
import { Graph } from './graph';
import { ScenarioPicker } from './picker';
import { SceneView, forceColor, type SceneOptions } from './scene';
import type { BodyInfo, EnergyInfo, EventInfo, ExactInfo, ForceInfo, ScenarioSpec, SketchInfo, View } from './types';
import { STATE_STRIDE } from './types';

/** Sums same-labelled forces, as a textbook free-body diagram shows one normal force even for two contact points. */
export function aggregateForces(forces: ForceInfo[]): ForceInfo[] {
  const byLabel = new Map<string, ForceInfo & { weight: number }>();
  for (const f of forces) {
    const magnitude = Math.hypot(f.force[0], f.force[1]) + 1e-12;
    const current = byLabel.get(f.label);
    if (!current) {
      byLabel.set(f.label, { ...f, force: [...f.force], point: [f.point[0] * magnitude, f.point[1] * magnitude], weight: magnitude });
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

const MAX_STEPS_PER_FRAME = 4000;

export type Source =
  | { kind: 'scenario'; spec: ScenarioSpec; params: Record<string, number> }
  | { kind: 'scene'; json: string; dt: number };

class Session {
  readonly world: MechanicsWorld;
  readonly bodies: BodyInfo[];
  readonly view: View;
  readonly exact: ExactInfo[];
  readonly events: EventInfo[] = [];
  readonly title: string;
  focus: number;
  running = true;
  speed = 1;
  private accumulator = 0;

  constructor(readonly source: Source) {
    const dt = source.kind === 'scenario' ? source.spec.dt : source.dt;
    const recordEvery = Math.max(1, Math.round(0.005 / dt));
    this.world =
      source.kind === 'scenario'
        ? new MechanicsWorld(source.spec.id, source.params, recordEvery)
        : MechanicsWorld.from_scene(source.json, recordEvery);
    this.title = this.world.title();
    this.bodies = this.world.bodies() as BodyInfo[];
    this.view = this.world.view() as View;
    this.exact = this.world.exact() as ExactInfo[];
    this.focus = this.world.focus();
    this.drainEvents();
  }

  advance(seconds: number): void {
    if (!this.running) return;
    this.accumulator += seconds * this.speed;
    const steps = Math.min(MAX_STEPS_PER_FRAME, Math.floor(this.accumulator / this.world.dt()));
    if (steps > 0) {
      this.world.step(steps);
      this.accumulator -= steps * this.world.dt();
      this.drainEvents();
    }
  }

  stepOnce(): void {
    this.world.step(Math.max(1, Math.round(0.01 / this.world.dt())));
    this.drainEvents();
  }

  private drainEvents(): void {
    this.events.push(...(this.world.events() as EventInfo[]));
  }

  describe(event: EventInfo): string {
    const name = (i: number) => this.bodies[i]?.label ?? `body ${i}`;
    switch (event.kind) {
      case 'contact_begin':
        return `${name(event.bodies[0]!)} touches ${name(event.bodies[1]!)}`;
      case 'contact_end':
        return `${name(event.bodies[0]!)} leaves ${name(event.bodies[1]!)}`;
      case 'friction_slip':
        return `${name(event.bodies[1]!)} starts sliding on ${name(event.bodies[0]!)}`;
      case 'friction_stick':
        return `${name(event.bodies[1]!)} stops sliding on ${name(event.bodies[0]!)}`;
      case 'rope_slack':
        return 'the string goes slack';
      case 'rope_taut':
        return 'the string becomes taut';
      default:
        return event.kind;
    }
  }

  dispose(): void {
    this.world.free();
  }
}

export function mountMechanics(main: HTMLElement, params: URLSearchParams, embedded: boolean): void {
  const catalogue = mechanics_catalogue() as ScenarioSpec[];
  main.innerHTML = `
    <aside class="sidebar">
      <div class="field"><span>Scenario</span><div id="scenario-picker"></div></div>
      <p id="description" class="description"></p>
      <div id="params" class="params"></div>
      <button id="defaults" type="button" class="subtle">Reset parameters</button>
      <section class="card">
        <h3>Textbook answers</h3>
        <table id="exact" class="table"></table>
      </section>
      <section class="card">
        <h3>Scene as JSON</h3>
        <p class="description">Every scenario is a JSON scene. Download it, edit it, load it back, or open it in a notebook.</p>
        <div class="buttons">
          <button id="export" type="button" class="subtle">Download</button>
          <button id="load" type="button" class="subtle">Load file</button>
        </div>
        <input id="file" type="file" accept="application/json,.json" hidden />
        <p id="scene-error" class="error"></p>
      </section>
    </aside>
    <section class="stage-column">
      <div class="toolbar">
        <button id="toggle" type="button" title="Space">Play</button>
        <button id="step" type="button">Step</button>
        <button id="reset" type="button">Restart</button>
        <label class="inline"><span>Speed</span><input id="speed" type="range" min="-2" max="1.5" step="0.1" value="0" /><output id="speed-value">×1.0</output></label>
        <label class="check"><input id="show-forces" type="checkbox" checked />Forces</label>
        <label class="check"><input id="show-velocity" type="checkbox" checked />Velocity</label>
        <label class="check"><input id="show-acceleration" type="checkbox" />Acceleration</label>
        <label class="check"><input id="show-trail" type="checkbox" checked />Trail</label>
        <button id="fit" type="button" class="subtle">Fit view</button>
      </div>
      <div class="stage"><canvas id="scene"></canvas></div>
      <div class="graphs">
        <canvas id="graph-position"></canvas>
        <canvas id="graph-velocity"></canvas>
        <canvas id="graph-energy"></canvas>
      </div>
    </section>
    <aside class="inspector">
      <section class="card">
        <h3>Selected body <select id="focus"></select></h3>
        <dl id="readout" class="readout"></dl>
      </section>
      <section class="card">
        <h3>Free-body diagram</h3>
        <table id="forces" class="table"></table>
      </section>
      <section class="card">
        <h3>Energy</h3>
        <div id="energy-bar" class="energy-bar"></div>
        <dl id="energy" class="readout"></dl>
      </section>
      <section class="card">
        <h3>Events</h3>
        <ol id="events" class="events"></ol>
      </section>
    </aside>`;

  const ui = {
    pickerMount: q<HTMLDivElement>(main, '#scenario-picker'),
    description: q<HTMLParagraphElement>(main, '#description'),
    params: q<HTMLDivElement>(main, '#params'),
    defaults: q<HTMLButtonElement>(main, '#defaults'),
    exact: q<HTMLTableElement>(main, '#exact'),
    exportButton: q<HTMLButtonElement>(main, '#export'),
    loadButton: q<HTMLButtonElement>(main, '#load'),
    file: q<HTMLInputElement>(main, '#file'),
    sceneError: q<HTMLParagraphElement>(main, '#scene-error'),
    toggle: q<HTMLButtonElement>(main, '#toggle'),
    step: q<HTMLButtonElement>(main, '#step'),
    reset: q<HTMLButtonElement>(main, '#reset'),
    speed: q<HTMLInputElement>(main, '#speed'),
    speedValue: q<HTMLOutputElement>(main, '#speed-value'),
    showForces: q<HTMLInputElement>(main, '#show-forces'),
    showVelocity: q<HTMLInputElement>(main, '#show-velocity'),
    showAcceleration: q<HTMLInputElement>(main, '#show-acceleration'),
    showTrail: q<HTMLInputElement>(main, '#show-trail'),
    fit: q<HTMLButtonElement>(main, '#fit'),
    canvas: q<HTMLCanvasElement>(main, '#scene'),
    focus: q<HTMLSelectElement>(main, '#focus'),
    readout: q<HTMLDListElement>(main, '#readout'),
    forces: q<HTMLTableElement>(main, '#forces'),
    energyBar: q<HTMLDivElement>(main, '#energy-bar'),
    energy: q<HTMLDListElement>(main, '#energy'),
    events: q<HTMLOListElement>(main, '#events'),
  };

  const picker = new ScenarioPicker(
    catalogue.map((spec) => ({ id: spec.id, title: spec.title, group: `Class ${spec.syllabus.class} · ${spec.syllabus.chapter}` })),
    (id) => startScenario(catalogue.find((s) => s.id === id)!, true),
  );
  ui.pickerMount.replaceWith(picker.root);

  const view = new SceneView(ui.canvas);
  const graphs = {
    position: new Graph(q<HTMLCanvasElement>(main, '#graph-position'), 'Position', 'm'),
    velocity: new Graph(q<HTMLCanvasElement>(main, '#graph-velocity'), 'Velocity', 'm/s'),
    energy: new Graph(q<HTMLCanvasElement>(main, '#graph-energy'), 'Energy', 'J'),
  };

  let session: Session | undefined;
  let paramValues: Record<string, number> = {};
  let rebuildTimer: number | undefined;

  function currentSpec(): ScenarioSpec {
    return catalogue.find((s) => s.id === picker.value) ?? catalogue[0]!;
  }

  function buildParamControls(spec: ScenarioSpec): void {
    ui.params.replaceChildren(
      ...spec.params.map((p) => {
        const value = paramValues[p.name] ?? p.default;
        const output = el('output', { text: `${formatNumber(value, 2)} ${p.unit}` });
        const input = el('input', { type: 'range', min: p.min, max: p.max, step: p.step, value }) as HTMLInputElement;
        input.addEventListener('input', () => {
          paramValues[p.name] = Number(input.value);
          output.textContent = `${formatNumber(Number(input.value), 2)} ${p.unit}`;
          clearTimeout(rebuildTimer);
          rebuildTimer = window.setTimeout(() => startScenario(spec, false, session?.running ?? false), 120);
        });
        return el('label', { class: 'field' }, [el('span', {}, [el('b', { text: p.label }), output]), input]);
      }),
    );
  }

  function setRunning(running: boolean): void {
    if (!session) return;
    session.running = running;
    ui.toggle.textContent = running ? 'Pause' : 'Play';
  }

  function start(source: Source, resetParams: boolean, running: boolean): void {
    const speed = session?.speed ?? 1;
    try {
      const next = new Session(source);
      session?.dispose();
      session = next;
      ui.sceneError.textContent = '';
    } catch (error) {
      ui.sceneError.textContent = String(error instanceof Error ? error.message : error);
      return;
    }
    session.speed = speed;
    setRunning(running);
    if (source.kind === 'scenario') {
      picker.value = source.spec.id;
      ui.description.textContent = source.spec.description;
      if (resetParams) buildParamControls(source.spec);
      if (!embedded) history.replaceState(null, '', `?mode=mechanics&scenario=${source.spec.id}`);
    } else {
      ui.description.textContent = `Loaded scene: ${session.title}`;
      ui.params.replaceChildren(el('p', { class: 'muted', text: 'Parameters live in the JSON for a loaded scene.' }));
    }
    ui.exact.replaceChildren(
      ...session.exact.map((e) => el('tr', {}, [el('td', { text: e.name }), el('td', { class: 'num', text: formatNumber(e.value) })])),
    );
    ui.focus.replaceChildren(
      ...session.bodies.map((b, i) => new Option(b.label, String(i), false, i === session!.focus)).filter((_, i) => session!.bodies[i]!.kind !== 'static'),
    );
    ui.focus.value = String(session.focus);
    ui.events.replaceChildren();
    view.camera.fit(session.view);
    view.clearTrail();
  }

  function startScenario(spec: ScenarioSpec, resetParams: boolean, running = false): void {
    if (resetParams) paramValues = {};
    start({ kind: 'scenario', spec, params: paramValues }, resetParams, running);
  }

  function restart(): void {
    if (!session) return;
    start(session.source, false, session.running);
  }

  ui.exportButton.addEventListener('click', () => {
    if (!session) return;
    const blob = new Blob([session.world.scene_json()], { type: 'application/json' });
    const link = el('a', { href: URL.createObjectURL(blob), download: `${session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json` });
    link.click();
    URL.revokeObjectURL(link.href);
  });
  ui.loadButton.addEventListener('click', () => ui.file.click());
  ui.file.addEventListener('change', async () => {
    const file = ui.file.files?.[0];
    if (!file) return;
    const json = await file.text();
    let dt = 1e-3;
    try {
      dt = Number(JSON.parse(json)?.world?.dt) || dt;
    } catch {
      /* the engine reports the parse error */
    }
    start({ kind: 'scene', json, dt }, false, false);
    ui.file.value = '';
  });

  ui.defaults.addEventListener('click', () => startScenario(currentSpec(), true));
  ui.reset.addEventListener('click', restart);
  ui.toggle.addEventListener('click', () => setRunning(!session?.running));
  ui.step.addEventListener('click', () => {
    if (!session) return;
    setRunning(false);
    session.stepOnce();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target.closest('input:not([type=range]), select, textarea, [contenteditable], .picker')) return;
    e.preventDefault();
    setRunning(!session?.running);
  });
  ui.speed.addEventListener('input', () => {
    const speed = 10 ** Number(ui.speed.value);
    if (session) session.speed = speed;
    ui.speedValue.value = `×${speed.toFixed(speed < 1 ? 2 : 1)}`;
  });
  ui.fit.addEventListener('click', () => session && view.camera.fit(session.view));
  ui.focus.addEventListener('change', () => {
    if (!session) return;
    session.focus = Number(ui.focus.value);
    view.clearTrail();
  });
  view.onSelect = (body) => {
    if (!session) return;
    session.focus = body;
    ui.focus.value = String(body);
    view.clearTrail();
  };

  function renderPanels(s: Session, forces: ForceInfo[], state: Float64Array): void {
    const i = s.focus * STATE_STRIDE;
    const rows: [string, string][] = [
      ['time', `${s.world.time().toFixed(3)} s`],
      ['position', `(${formatNumber(state[i]!, 2)}, ${formatNumber(state[i + 1]!, 2)}) m`],
      ['velocity', `(${formatNumber(state[i + 3]!, 2)}, ${formatNumber(state[i + 4]!, 2)}) m/s`],
      ['speed', `${formatNumber(Math.hypot(state[i + 3]!, state[i + 4]!), 3)} m/s`],
      ['acceleration', `${formatNumber(Math.hypot(state[i + 6]!, state[i + 7]!), 3)} m/s²`],
    ];
    if (s.bodies[s.focus]!.kind === 'rigid') {
      rows.push(['angle', `${formatNumber((state[i + 2]! * 180) / Math.PI, 1)}°`], ['angular velocity', `${formatNumber(state[i + 5]!, 3)} rad/s`]);
    }
    ui.readout.replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));

    const net = forces.reduce<[number, number]>((acc, f) => [acc[0] + f.force[0], acc[1] + f.force[1]], [0, 0]);
    ui.forces.replaceChildren(
      ...forces.map((f) =>
        el('tr', {}, [
          el('td', {}, [el('span', { class: 'swatch', style: `background:${forceColor(f.label)}` }), f.label]),
          el('td', { class: 'num', text: `${formatNumber(Math.hypot(f.force[0], f.force[1]), 2)} N` }),
          el('td', { class: 'num muted', text: `(${formatNumber(f.force[0], 1)}, ${formatNumber(f.force[1], 1)})` }),
        ]),
      ),
      el('tr', { class: 'total' }, [el('td', { text: 'net' }), el('td', { class: 'num', text: `${formatNumber(Math.hypot(net[0], net[1]), 2)} N` }), el('td', { class: 'num muted', text: `(${formatNumber(net[0], 1)}, ${formatNumber(net[1], 1)})` })]),
    );

    const e = s.world.energy() as EnergyInfo;
    const parts = [
      ['kinetic', e.kinetic, '#0ea5e9'],
      ['potential', e.potential, '#f59e0b'],
      ['dissipated', e.dissipated, '#ef4444'],
    ] as const;
    const total = Math.max(1e-9, ...parts.map(([, v]) => Math.abs(v)), Math.abs(e.conserved));
    const datum = Math.min(0, e.potential);
    ui.energyBar.replaceChildren(
      ...parts.map(([name, value, color]) =>
        el('div', { class: 'energy-segment', style: `width:${Math.max(0, ((value - (name === 'potential' ? datum : 0)) / (total - datum)) * 100)}%;background:${color}`, title: name }),
      ),
    );
    ui.energy.replaceChildren(
      ...[
        ['kinetic', e.kinetic],
        ['potential', e.potential],
        ['dissipated', e.dissipated],
        ['external work', e.external_work],
        ['conserved total', e.conserved],
      ].flatMap(([k, v]) => [el('dt', { text: String(k) }), el('dd', { text: `${formatNumber(Number(v), 3)} J` })]),
    );

    const recent = s.events.slice(-12).reverse();
    ui.events.replaceChildren(
      ...recent.map((ev) => el('li', {}, [el('span', { class: 'muted', text: `t = ${ev.time.toFixed(3)} s` }), ` ${s.describe(ev)}`])),
    );
  }

  function renderGraphs(s: Session): void {
    const t = s.world.series_time();
    const b = s.focus;
    graphs.position.draw(t, [
      { label: 'x', color: '#0ea5e9', values: s.world.series(b, 'x') },
      { label: 'y', color: '#a855f7', values: s.world.series(b, 'y') },
    ]);
    graphs.velocity.draw(t, [
      { label: 'vx', color: '#0ea5e9', values: s.world.series(b, 'vx') },
      { label: 'vy', color: '#a855f7', values: s.world.series(b, 'vy') },
    ]);
    graphs.energy.draw(t, [
      { label: 'kinetic', color: '#0ea5e9', values: s.world.series_energy('kinetic') },
      { label: 'potential', color: '#f59e0b', values: s.world.series_energy('potential') },
      { label: 'dissipated', color: '#ef4444', values: s.world.series_energy('dissipated') },
      { label: 'total', color: '#64748b', values: s.world.series_energy('conserved') },
    ]);
  }

  let last = performance.now();
  let lastPanels = 0;
  function loop(now: number): void {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (session) {
      session.advance(elapsed);
      const state = session.world.state();
      const forces = aggregateForces(session.world.forces(session.focus) as ForceInfo[]);
      const options: SceneOptions = {
        showForces: ui.showForces.checked,
        showVelocity: ui.showVelocity.checked,
        showAcceleration: ui.showAcceleration.checked,
        showTrail: ui.showTrail.checked,
        focus: session.focus,
      };
      view.draw(session.bodies, state, session.world.sketches() as SketchInfo[], forces, options, session.world.time());
      if (now - lastPanels > 120) {
        lastPanels = now;
        renderPanels(session, forces, state);
        renderGraphs(session);
      }
    }
    requestAnimationFrame(loop);
  }

  const initial = catalogue.find((s) => s.id === params.get('scenario')) ?? catalogue[0]!;
  startScenario(initial, true);
  requestAnimationFrame(loop);
}
