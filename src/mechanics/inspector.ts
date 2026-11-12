import { iconButton } from '../controls';
import { el, formatNumber, formatQuantity, formatTime } from '../ui';
import { Graph, type GraphSeries } from './graph';
import type { Session } from './session';
import { forceColor } from './stage/renderer';
import { STATE_STRIDE, type EnergyInfo, type ForceInfo } from './types';

type Tab = 'forces' | 'energy' | 'graphs' | 'events';
type Plot = 'position' | 'velocity' | 'acceleration' | 'energy' | 'forces';

const TABS: [Tab, string][] = [
  ['forces', 'Forces'],
  ['energy', 'Energy'],
  ['graphs', 'Graphs'],
  ['events', 'Events'],
];

const PLOTS: [Plot, string, string][] = [
  ['position', 'Position', 'm'],
  ['velocity', 'Velocity', 'm/s'],
  ['acceleration', 'Acceleration', 'm/s²'],
  ['energy', 'Energy', 'J'],
  ['forces', 'Forces', 'N'],
];

const ENERGY_COLORS = { kinetic: '#38bdf8', potential: '#f59e0b', dissipated: '#f43f5e', total: '#94a3b8' };

/** The one place for detail: the selected body, then forces, energy, graphs or events on demand. */
export class Inspector {
  readonly root: HTMLElement;
  private readonly select = el('select', { 'aria-label': 'Selected body' });
  private readonly summary = el('small');
  private readonly body = el('div', { class: 'inspector-body' });
  private readonly tabButtons = new Map<Tab, HTMLButtonElement>();
  private tab: Tab = 'forces';
  private plot: Plot = 'position';
  private graph: Graph | undefined;
  private potentialFloor = 0;
  private built: Tab | undefined;

  constructor(private readonly onFocus: (body: number) => void) {
    const tabs = el('div', { class: 'tabs', role: 'tablist' });
    for (const [id, label] of TABS) {
      const button = el('button', { type: 'button', class: 'tab', role: 'tab', text: label });
      button.addEventListener('click', () => this.show(id));
      this.tabButtons.set(id, button);
      tabs.append(button);
    }
    this.select.addEventListener('change', () => onFocus(Number(this.select.value)));
    this.root = el('aside', { class: 'inspector glass overlay' }, [
      el('div', { class: 'inspector-head' }, [
        el('div', { class: 'body-select' }, [this.select, this.summary]),
        iconButton('panel', 'Show or hide the inspector', () => this.root.classList.toggle('collapsed')),
      ]),
      tabs,
      this.body,
    ]);
    if (matchMedia('(max-width: 700px)').matches) this.root.classList.add('collapsed');
    this.show('forces');
  }

  private show(tab: Tab): void {
    this.tab = tab;
    this.built = undefined;
    for (const [id, button] of this.tabButtons) button.setAttribute('aria-selected', String(id === tab));
  }

  /** Called when a new world is loaded. */
  reset(session: Session): void {
    this.select.replaceChildren(
      ...session.bodies.map((b, i) => new Option(b.label, String(i))).filter((_, i) => session.bodies[i]!.kind !== 'static'),
    );
    this.select.value = String(session.focus);
    this.potentialFloor = Infinity;
    this.built = undefined;
  }

  setFocus(body: number): void {
    this.select.value = String(body);
  }

  get collapsed(): boolean {
    return this.root.classList.contains('collapsed');
  }

  update(session: Session, forces: ForceInfo[], state: Float64Array): void {
    const body = session.bodies[session.focus];
    if (!body) return;
    const i = session.focus * STATE_STRIDE;
    const speed = Math.hypot(state[i + 3]!, state[i + 4]!);
    this.summary.textContent = `${formatQuantity(body.mass, 'kg')} · ${formatQuantity(speed, 'm/s')}`;
    if (this.collapsed) return;
    if (this.tab === 'forces') this.renderForces(session, forces, state);
    else if (this.tab === 'energy') this.renderEnergy(session);
    else if (this.tab === 'graphs') this.renderGraphs(session);
    else this.renderEvents(session);
  }

  private renderForces(session: Session, forces: ForceInfo[], state: Float64Array): void {
    const i = session.focus * STATE_STRIDE;
    const dt = session.dt;
    const net = forces.filter((f) => !f.impulsive).reduce<[number, number]>((acc, f) => [acc[0] + f.force[0], acc[1] + f.force[1]], [0, 0]);
    const row = (label: Node | string, magnitude: string, components: string, total = false) =>
      el('tr', total ? { class: 'total' } : {}, [el('td', {}, [label]), el('td', { class: 'num', text: magnitude }), el('td', { class: 'num muted', text: components })]);
    const pair = (x: number, y: number) => `(${formatNumber(x, 2)}, ${formatNumber(y, 2)})`;
    const table = el('table', { class: 'table' }, [
      // An impact delivers an impulse, not a force: shown in N·s so a landing does not read as a 14 kN push.
      ...forces.map((f) => {
        const scale = f.impulsive ? dt : 1;
        const name = el('span', {}, [el('span', { class: 'swatch', style: `background:${forceColor(f.label)}` }), f.impulsive ? `${f.label} impulse` : f.label]);
        return row(name, formatQuantity(Math.hypot(f.force[0], f.force[1]) * scale, f.impulsive ? 'N·s' : 'N'), pair(f.force[0] * scale, f.force[1] * scale));
      }),
      row('net force', formatQuantity(Math.hypot(net[0], net[1]), 'N'), pair(net[0], net[1]), true),
    ]);
    const rows: [string, string][] = [
      ['position', `${pair(state[i]!, state[i + 1]!)} m`],
      ['velocity', `${pair(state[i + 3]!, state[i + 4]!)} m/s`],
      ['acceleration', formatQuantity(Math.hypot(state[i + 6]!, state[i + 7]!), 'm/s²')],
    ];
    if (session.bodies[session.focus]!.kind === 'rigid') {
      rows.push(['angle', `${formatNumber((state[i + 2]! * 180) / Math.PI)}°`], ['spin', formatQuantity(state[i + 5]!, 'rad/s')]);
    }
    this.body.replaceChildren(
      el('h4', { class: 'panel-title', text: 'Free-body diagram' }),
      table,
      el('h4', { class: 'panel-title', text: 'Motion' }),
      el('dl', { class: 'readout' }, rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])),
    );
  }

  private renderEnergy(session: Session): void {
    const e = session.world.energy() as EnergyInfo;
    // Potential energy has no natural zero; measuring it from the lowest value seen keeps the bar readable.
    this.potentialFloor = Math.min(this.potentialFloor, e.potential);
    const potential = e.potential - this.potentialFloor;
    const parts = [
      ['kinetic', e.kinetic, ENERGY_COLORS.kinetic],
      ['potential', potential, ENERGY_COLORS.potential],
      ['dissipated', e.dissipated, ENERGY_COLORS.dissipated],
    ] as const;
    const total = Math.max(1e-9, parts.reduce((sum, [, v]) => sum + Math.max(0, v), 0));
    const bar = el('div', { class: 'energy-bar' }, parts.map(([name, value, color]) =>
      el('div', { class: 'energy-segment', title: name, style: `width:${(Math.max(0, value) / total) * 100}%;background:${color}` }),
    ));
    const rows: [string, number, string?][] = [
      ['kinetic', e.kinetic, ENERGY_COLORS.kinetic],
      ['potential', potential, ENERGY_COLORS.potential],
      ['dissipated', e.dissipated, ENERGY_COLORS.dissipated],
      ['work done on it', e.external_work],
    ];
    const table = el('table', { class: 'table' }, [
      ...rows.map(([name, value, color]) =>
        el('tr', {}, [el('td', {}, [color ? el('span', { class: 'swatch', style: `background:${color}` }) : '', name]), el('td', { class: 'num', text: formatQuantity(value, 'J') })]),
      ),
      el('tr', { class: 'total' }, [el('td', { text: 'conserved total' }), el('td', { class: 'num', text: formatQuantity(e.conserved - this.potentialFloor, 'J') })]),
    ]);
    this.body.replaceChildren(
      el('h4', { class: 'panel-title', text: 'Where the energy is' }),
      bar,
      table,
      el('p', { class: 'empty', text: 'Kinetic + potential + dissipated − work done stays constant. Its drift is how accurate the run is.' }),
    );
  }

  private renderGraphs(session: Session): void {
    if (this.built !== 'graphs') {
      this.built = 'graphs';
      const chooser = el('div', { class: 'segmented' });
      for (const [id, label] of PLOTS) {
        const button = el('button', { type: 'button', text: label, 'aria-pressed': String(id === this.plot) });
        button.addEventListener('click', () => {
          this.plot = id;
          this.built = undefined;
        });
        chooser.append(button);
      }
      const canvas = el('canvas', { class: 'graph-canvas' });
      this.body.replaceChildren(chooser, canvas);
      const [, title, unit] = PLOTS.find(([id]) => id === this.plot)!;
      this.graph = new Graph(canvas, title, unit);
    }
    const world = session.world;
    const b = session.focus;
    const pick = (flat: Float64Array, offset: number) => flat.filter((_, k) => k % 2 === offset);
    let series: GraphSeries[];
    if (this.plot === 'position') {
      series = [{ label: 'x', color: '#38bdf8', values: world.series(b, 'x') }, { label: 'y', color: '#a78bfa', values: world.series(b, 'y') }];
    } else if (this.plot === 'velocity') {
      series = [{ label: 'vx', color: '#38bdf8', values: world.series(b, 'vx') }, { label: 'vy', color: '#a78bfa', values: world.series(b, 'vy') }];
    } else if (this.plot === 'acceleration') {
      series = [{ label: 'ax', color: '#38bdf8', values: world.series(b, 'ax') }, { label: 'ay', color: '#a78bfa', values: world.series(b, 'ay') }];
    } else if (this.plot === 'energy') {
      const floor = Number.isFinite(this.potentialFloor) ? this.potentialFloor : 0;
      series = [
        { label: 'kinetic', color: ENERGY_COLORS.kinetic, values: world.series_energy('kinetic') },
        { label: 'potential', color: ENERGY_COLORS.potential, values: world.series_energy('potential').map((v) => v - floor) },
        { label: 'dissipated', color: ENERGY_COLORS.dissipated, values: world.series_energy('dissipated') },
      ];
    } else {
      series = ['normal', 'friction', 'tension', 'spring', 'applied']
        .map((label) => {
          const flat = world.series_force(b, label);
          const x = pick(flat, 0);
          const y = pick(flat, 1);
          return { label, color: forceColor(label), values: x.map((v, k) => Math.hypot(v, y[k]!)) };
        })
        .filter((s) => s.values.some((v) => v > 1e-9));
      if (series.length === 0) series = [{ label: 'no contact or constraint forces yet', color: '#94a3b8', values: new Float64Array(world.series_time().length) }];
    }
    this.graph?.draw(world.series_time(), series, session.horizon);
  }

  private renderEvents(session: Session): void {
    const finish = session.lastFinish();
    const items = session.events.slice(-40).reverse().map((event) => el('li', {}, [el('time', { text: formatTime(event.time) }), el('span', { text: session.describe(event) })]));
    if (finish) items.unshift(el('li', {}, [el('time', { text: formatTime(finish.time) }), el('b', { text: finish.reason })]));
    this.body.replaceChildren(
      items.length
        ? el('ol', { class: 'events' }, items)
        : el('p', { class: 'empty', text: 'Nothing has happened yet. Contacts, a string going slack and a block starting to slide all show up here.' }),
    );
  }
}
