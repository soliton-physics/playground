import { iconButton, slider } from '../controls';
import type { IconName } from '../icons';
import { el, formatNumber } from '../ui';
import { VELOCITY_COLOR, VELOCITY_SCALE, type Painter } from './stage/renderer';
import type { AnchorSpec, BodySpec, ConstraintSpec, RopeNodeSpec, SceneFile, Vec } from './types';

export type Tool = 'select' | 'ball' | 'box' | 'platform' | 'rope' | 'rod' | 'spring' | 'pin' | 'erase';

const TOOLS: [Tool, IconName, string][] = [
  ['select', 'cursor', 'Select and move (V)'],
  ['ball', 'ball', 'Ball (B)'],
  ['box', 'box', 'Box (X)'],
  ['platform', 'platform', 'Fixed platform (P)'],
  ['rope', 'rope', 'Rope: click two ends (O)'],
  ['rod', 'rod', 'Rigid rod: click two ends (D)'],
  ['spring', 'spring', 'Spring: click two ends (S)'],
  ['pin', 'pin', 'Pin a body to the page (N)'],
  ['erase', 'erase', 'Erase (E)'],
];

export const TOOL_KEYS: Record<string, Tool> = { v: 'select', b: 'ball', x: 'box', p: 'platform', o: 'rope', d: 'rod', s: 'spring', n: 'pin', e: 'erase' };

const HINTS: Record<Tool, string> = {
  select: 'Drag a body to move it. Drag its arrow to give it a velocity.',
  ball: 'Click to drop a ball.',
  box: 'Click to place a box.',
  platform: 'Click to place a fixed platform.',
  rope: 'Click a body, then another body or an empty point.',
  rod: 'Click a body, then another body or an empty point.',
  spring: 'Click a body, then another body or an empty point.',
  pin: 'Click a point on a body to pin it there.',
  erase: 'Click a body, the ground, a rope, rod, spring, pin or track to remove it.',
};

export function emptySandbox(): SceneFile {
  return {
    schema: 1,
    title: 'My sandbox',
    world: { gravity: [0, -9.8], dt: 0.001 },
    bodies: [{ id: 'ground', kind: 'static', shape: { halfplane: { normal: [0, 1], offset: 0 } }, friction: [0.6, 0.5] }],
    view: { center: [0, 2.6], half_height: 4.2 },
  };
}

/** What a pointer press landed on. */
export interface Hit {
  at: Vec;
  /** Index of the body under the pointer, if any. */
  body?: number;
  /** How near, in metres, counts as on a rope, rod or spring. */
  reach?: number;
}

function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

const round = (value: number, step = 0.05) => Math.round(value / step) * step;

function mentions(value: unknown, id: string): boolean {
  if (Array.isArray(value)) return value.some((v) => mentions(v, id));
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, v]) => ((key === 'body' || key === 'id') && v === id) || mentions(v, id));
  }
  return false;
}

/** The sandbox: a scene as data, the tools that change it, and its undo history. */
export class Editor {
  readonly rail: HTMLDivElement;
  scene: SceneFile = emptySandbox();
  tool: Tool = 'select';
  selected: number | undefined;
  private pending: { tool: Tool; anchor: AnchorSpec; at: Vec } | undefined;
  private history: string[] = [];
  private future: string[] = [];
  private lastEdit = { key: '', time: 0 };
  private readonly buttons = new Map<Tool, HTMLButtonElement>();

  /** `changed` rebuilds the world from `scene`; `hint` shows a line of guidance on the stage. */
  constructor(private readonly changed: () => void, private readonly hint: (text: string) => void) {
    this.rail = el('div', { class: 'rail glass overlay', role: 'toolbar', 'aria-label': 'Sandbox tools' });
    for (const [tool, name, label] of TOOLS) {
      const button = iconButton(name, label, () => this.setTool(tool));
      this.buttons.set(tool, button);
      this.rail.append(button);
    }
    this.rail.append(el('div', { class: 'rail-divider' }), iconButton('undo', 'Undo (Ctrl+Z)', () => this.undo()), iconButton('redo', 'Redo (Ctrl+Shift+Z)', () => this.redo()));
    this.setTool('select');
  }

  get json(): string {
    return JSON.stringify(this.scene, null, 2);
  }

  load(json: string): void {
    this.scene = JSON.parse(json) as SceneFile;
    this.history = [];
    this.future = [];
    this.selected = undefined;
    this.pending = undefined;
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.pending = undefined;
    for (const [id, button] of this.buttons) button.setAttribute('aria-pressed', String(id === tool));
    this.hint(HINTS[tool]);
  }

  /** Records the scene before a change. Changes to the same thing in quick succession undo as one. */
  private checkpoint(key: string): void {
    const now = performance.now();
    if (key && key === this.lastEdit.key && now - this.lastEdit.time < 600) {
      this.lastEdit.time = now;
      return;
    }
    this.lastEdit = { key, time: now };
    this.history.push(JSON.stringify(this.scene));
    if (this.history.length > 100) this.history.shift();
    this.future = [];
  }

  /** Replaces the scene with the world as it stands, before an edit made part-way through a run. */
  adopt(json: string): void {
    this.checkpoint('');
    this.scene = JSON.parse(json) as SceneFile;
  }

  undo(): void {
    const previous = this.history.pop();
    if (!previous) return;
    this.future.push(JSON.stringify(this.scene));
    this.scene = JSON.parse(previous) as SceneFile;
    this.selected = undefined;
    this.changed();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.history.push(JSON.stringify(this.scene));
    this.scene = JSON.parse(next) as SceneFile;
    this.selected = undefined;
    this.changed();
  }

  private uniqueId(base: string): string {
    const taken = new Set(this.scene.bodies.map((b) => b.id));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }

  private anchorAt(hit: Hit): AnchorSpec {
    if (hit.body === undefined) return { fixed: [round(hit.at[0]), round(hit.at[1])] };
    const spec = this.scene.bodies[hit.body]!;
    const [px, py] = spec.position ?? [0, 0];
    const angle = spec.angle ?? 0;
    const [dx, dy] = [hit.at[0] - px, hit.at[1] - py];
    const local: Vec = [dx * Math.cos(angle) + dy * Math.sin(angle), -dx * Math.sin(angle) + dy * Math.cos(angle)];
    const offCentre = 'rectangle' in spec.shape && Math.hypot(local[0], local[1]) > 0.08;
    return { body: offCentre ? { id: spec.id, local: [round(local[0], 0.01), round(local[1], 0.01)] } : { id: spec.id } };
  }

  /** A press on the stage with a placing tool. Returns true when the tool used it. */
  press(hit: Hit): boolean {
    const [x, y] = [round(hit.at[0]), round(hit.at[1])];
    switch (this.tool) {
      case 'select':
        return false;
      case 'ball':
        return this.add({ id: this.uniqueId('ball'), kind: 'rigid', shape: { circle: 0.3 }, mass: 1, position: [x, y], restitution: 0.5, friction: [0.5, 0.4] });
      case 'box':
        return this.add({ id: this.uniqueId('box'), kind: 'rigid', shape: { rectangle: [0.8, 0.5] }, mass: 2, position: [x, y], restitution: 0.2, friction: [0.5, 0.4] });
      case 'platform':
        return this.add({ id: this.uniqueId('platform'), kind: 'static', shape: { rectangle: [3, 0.3] }, position: [x, y], friction: [0.6, 0.5] });
      case 'erase':
        // A rope in front of a wall or over the ground is what the click was aimed at, not what is behind it.
        if (hit.body !== undefined && this.scene.bodies[hit.body]?.kind === 'static' && this.removeLinkAt(hit.at, hit.reach ?? 0.15)) return true;
        if (hit.body !== undefined) this.remove(hit.body);
        else if (!this.removeLinkAt(hit.at, hit.reach ?? 0.15)) this.hint('Nothing there. Click a body, the ground, a rope, rod, spring, pin or track.');
        return true;
      case 'pin': {
        if (hit.body === undefined) {
          this.hint('A pin needs a body: click on one.');
          return true;
        }
        this.checkpoint('');
        this.constraints().push({ pin: { a: this.anchorAt(hit), b: { fixed: hit.at } } });
        this.changed();
        return true;
      }
      default:
        return this.link(hit);
    }
  }

  private add(body: BodySpec): boolean {
    this.checkpoint('');
    this.scene.bodies.push(body);
    this.selected = this.scene.bodies.length - 1;
    this.changed();
    return true;
  }

  private constraints(): ConstraintSpec[] {
    return (this.scene.constraints ??= []);
  }

  /** Rope, rod and spring: the first press chooses one end, the second the other. */
  private link(hit: Hit): boolean {
    const anchor = this.anchorAt(hit);
    if (!this.pending) {
      if ('fixed' in anchor) {
        this.hint('Start on a body, then click where the other end goes.');
        return true;
      }
      this.pending = { tool: this.tool, anchor, at: hit.at };
      this.hint('Now click the other end: a body or an empty point.');
      return true;
    }
    const first = this.pending.anchor;
    this.pending = undefined;
    if ('body' in first && 'body' in anchor && first.body.id === anchor.body.id) {
      this.hint('Both ends are on the same body. Pick another body or an empty point.');
      return true;
    }
    this.checkpoint('');
    if (this.tool === 'rope') {
      const node = (a: AnchorSpec): RopeNodeSpec => ('fixed' in a ? { peg: a.fixed } : { attach: { body: a.body.id, ...(a.body.local ? { local: a.body.local } : {}) } });
      this.constraints().push({ rope: { nodes: [node(first), node(anchor)] } });
    } else if (this.tool === 'rod') {
      this.constraints().push({ rod: { a: first, b: anchor } });
    } else {
      (this.scene.forces ??= []).push({ spring: { a: first, b: anchor, stiffness: 60 } });
    }
    this.hint(HINTS[this.tool]);
    this.changed();
    return true;
  }

  remove(index: number): void {
    const spec = this.scene.bodies[index];
    if (!spec) return;
    this.checkpoint('');
    const id = spec.id;
    this.scene.bodies.splice(index, 1);
    this.scene.constraints = this.scene.constraints?.filter((c) => !mentions(c, id));
    this.scene.forces = this.scene.forces?.filter((f) => !mentions(f, id));
    this.scene.finish = this.scene.finish?.filter((f) => !JSON.stringify(f.when).includes(`"${id}"`));
    this.scene.ignore_collisions = this.scene.ignore_collisions?.filter((pair) => !pair.includes(id));
    if (this.scene.focus === id) delete this.scene.focus;
    this.selected = undefined;
    this.changed();
  }

  private bodyPoint(id: string, local: Vec = [0, 0]): Vec | undefined {
    const spec = this.scene.bodies.find((b) => b.id === id);
    if (!spec) return undefined;
    const [x, y] = spec.position ?? [0, 0];
    const angle = spec.angle ?? 0;
    return [x + local[0] * Math.cos(angle) - local[1] * Math.sin(angle), y + local[0] * Math.sin(angle) + local[1] * Math.cos(angle)];
  }

  private anchorPoint(anchor: AnchorSpec): Vec | undefined {
    return 'fixed' in anchor ? anchor.fixed : this.bodyPoint(anchor.body.id, anchor.body.local);
  }

  /** The points a rope, rod, pin or spring runs through, and how fat it is where it wraps a pulley. */
  private linkPath(link: ConstraintSpec | { spring: { a: AnchorSpec; b: AnchorSpec } }): { points: Vec[]; discs: { center: Vec; radius: number }[] } {
    const points: (Vec | undefined)[] = [];
    const discs: { center: Vec; radius: number }[] = [];
    if ('rope' in link) {
      for (const node of link.rope.nodes) {
        if ('attach' in node) points.push(this.bodyPoint(node.attach.body, node.attach.local));
        else if ('peg' in node) points.push(node.peg);
        else if ('pulley' in node) {
          points.push(node.pulley.center);
          discs.push({ center: node.pulley.center, radius: node.pulley.radius });
        } else points.push(this.bodyPoint(node.wheel.body));
      }
    } else if ('rod' in link) points.push(this.anchorPoint(link.rod.a), this.anchorPoint(link.rod.b));
    else if ('pin' in link) points.push(this.anchorPoint(link.pin.a), this.anchorPoint(link.pin.b));
    else if ('spring' in link) points.push(this.anchorPoint(link.spring.a), this.anchorPoint(link.spring.b));
    else if ('slot' in link) points.push(...this.track(link.slot));
    return { points: points.filter((p): p is Vec => p !== undefined), discs };
  }

  /** The two ends of the stretch of a slot's line worth drawing: well past the body riding on it, both ways. */
  private track(slot: { body: string; origin: Vec; direction: Vec }): Vec[] {
    const length = Math.hypot(slot.direction[0], slot.direction[1]) || 1;
    const [ux, uy] = [slot.direction[0] / length, slot.direction[1] / length];
    const [bx, by] = this.bodyPoint(slot.body) ?? slot.origin;
    const along = (bx - slot.origin[0]) * ux + (by - slot.origin[1]) * uy;
    const at = (s: number): Vec => [slot.origin[0] + ux * s, slot.origin[1] + uy * s];
    return [at(along - 4), at(along + 4)];
  }

  private touches(link: Parameters<Editor['linkPath']>[0], at: Vec, reach: number): boolean {
    const { points, discs } = this.linkPath(link);
    if (discs.some((d) => Math.hypot(at[0] - d.center[0], at[1] - d.center[1]) <= d.radius + reach)) return true;
    if (points.length === 1) return Math.hypot(at[0] - points[0]![0], at[1] - points[0]![1]) <= reach;
    return points.some((p, i) => i > 0 && distanceToSegment(at, points[i - 1]!, p) <= reach);
  }

  /** Removes the rope, rod, pin or spring under a point. Returns false when there is none. */
  removeLinkAt(at: Vec, reach: number): boolean {
    // A track is a faint guide that often lies under the spring or rope along it, so it is the last thing a click means.
    const constraints = this.scene.constraints ?? [];
    const visible = constraints.findIndex((c) => !('slot' in c) && this.touches(c, at, reach));
    const spring = visible >= 0 ? -1 : (this.scene.forces ?? []).findIndex((f) => 'spring' in f && this.touches(f, at, reach));
    const constraint = visible >= 0 || spring >= 0 ? visible : constraints.findIndex((c) => this.touches(c, at, reach));
    if (constraint < 0 && spring < 0) return false;
    this.checkpoint('');
    if (constraint >= 0) this.scene.constraints!.splice(constraint, 1);
    else this.scene.forces!.splice(spring, 1);
    this.changed();
    return true;
  }

  /** Moves a body by a world displacement from where the drag began. */
  moveTo(index: number, origin: Vec, dx: number, dy: number): void {
    const spec = this.scene.bodies[index];
    if (!spec) return;
    this.checkpoint(`move ${index}`);
    spec.position = [round(origin[0] + dx, 0.01), round(origin[1] + dy, 0.01)];
    this.changed();
  }

  setVelocity(index: number, vx: number, vy: number): void {
    const spec = this.scene.bodies[index];
    if (!spec) return;
    this.checkpoint(`velocity ${index}`);
    spec.velocity = [round(vx, 0.1), round(vy, 0.1)];
    this.changed();
  }

  /** Where the velocity arrow of the selected body ends, for drawing and for grabbing it. */
  velocityTip(): Vec | undefined {
    const spec = this.selected === undefined ? undefined : this.scene.bodies[this.selected];
    if (!spec || spec.kind === 'static') return undefined;
    const [x, y] = spec.position ?? [0, 0];
    const [vx, vy] = spec.velocity ?? [0, 0];
    const still = Math.hypot(vx, vy) < 1e-9;
    return still ? [x + 0.6, y + 0.6] : [x + vx * VELOCITY_SCALE, y + vy * VELOCITY_SCALE];
  }

  overlay(painter: Painter, pointer: Vec | undefined): void {
    if (this.pending && pointer) painter.dashed([this.pending.at, pointer], '#94a3b8');
    // A slot keeps a body on a line and has nothing else to show for itself; drawn here so it can be seen and erased.
    for (const constraint of this.scene.constraints ?? []) {
      if (!('slot' in constraint)) continue;
      const [a, b] = this.track(constraint.slot);
      painter.dashed([a!, b!], '#94a3b8');
      painter.label('track', a![0], a![1], '#94a3b8');
    }
    const tip = this.velocityTip();
    const spec = this.selected === undefined ? undefined : this.scene.bodies[this.selected];
    if (tip && spec && this.tool === 'select') {
      const [vx, vy] = spec.velocity ?? [0, 0];
      const speed = Math.hypot(vx, vy);
      if (speed < 1e-9) painter.dashed([spec.position ?? [0, 0], tip], VELOCITY_COLOR);
      painter.knob(tip[0], tip[1], VELOCITY_COLOR);
      painter.label(speed < 1e-9 ? 'drag to launch' : `${formatNumber(speed)} m/s`, tip[0], tip[1] + 0.25, VELOCITY_COLOR);
    }
  }

  /** The panel that edits the selected body. */
  properties(): HTMLElement | undefined {
    const index = this.selected;
    const spec = index === undefined ? undefined : this.scene.bodies[index];
    if (!spec || index === undefined) return undefined;
    const set = (key: string, apply: (b: BodySpec) => void) => {
      this.checkpoint(`${key} ${index}`);
      apply(spec);
      this.changed();
    };
    const rows: HTMLElement[] = [];
    const isStatic = spec.kind === 'static';
    if (!('halfplane' in spec.shape)) {
      const kinds = el('div', { class: 'kind-switch' });
      for (const [label, fixed] of [['Moves', false], ['Fixed', true]] as const) {
        const button = el('button', { type: 'button', text: label, 'aria-pressed': String(isStatic === fixed) });
        button.addEventListener('click', () =>
          set('kind', (b) => {
            b.kind = fixed ? 'static' : 'rigid';
            if (fixed) {
              delete b.mass;
              delete b.velocity;
            } else b.mass ??= 1;
          }),
        );
        kinds.append(button);
      }
      rows.push(kinds);
    }
    if (!isStatic) {
      rows.push(slider({ label: 'Mass', min: 0.1, max: 20, step: 0.1, hardMin: 0.001, hardMax: 1e6, value: spec.mass ?? 1, format: (v) => `${formatNumber(v)} kg`, onInput: (v) => set('mass', (b) => (b.mass = v)) }).root);
    }
    if ('circle' in spec.shape) {
      rows.push(slider({ label: 'Radius', min: 0.05, max: 1.5, step: 0.05, hardMin: 0.01, hardMax: 1000, value: spec.shape.circle, format: (v) => `${formatNumber(v)} m`, onInput: (v) => set('size', (b) => (b.shape = { circle: v })) }).root);
    } else if ('rectangle' in spec.shape) {
      const [w, h] = spec.shape.rectangle;
      rows.push(
        slider({ label: 'Width', min: 0.1, max: 8, step: 0.1, hardMin: 0.01, hardMax: 10000, value: w, format: (v) => `${formatNumber(v)} m`, onInput: (v) => set('width', (b) => 'rectangle' in b.shape && (b.shape = { rectangle: [v, b.shape.rectangle[1]] })) }).root,
        slider({ label: 'Height', min: 0.1, max: 4, step: 0.1, hardMin: 0.01, hardMax: 10000, value: h, format: (v) => `${formatNumber(v)} m`, onInput: (v) => set('height', (b) => 'rectangle' in b.shape && (b.shape = { rectangle: [b.shape.rectangle[0], v] })) }).root,
        slider({ label: 'Tilt', min: -90, max: 90, step: 1, hardMin: -180, hardMax: 180, value: Number((((spec.angle ?? 0) * 180) / Math.PI).toFixed(3)), format: (v) => `${formatNumber(v)}°`, onInput: (v) => set('tilt', (b) => (b.angle = (v * Math.PI) / 180)) }).root,
      );
    }
    rows.push(
      slider({ label: 'Friction μ', min: 0, max: 1, step: 0.05, hardMax: 10, value: spec.friction?.[0] ?? 0, format: (v) => formatNumber(v, 2), onInput: (v) => set('friction', (b) => (b.friction = [v, round(0.8 * v, 0.01)])) }).root,
    );
    if (!isStatic) {
      rows.push(slider({ label: 'Bounce e', min: 0, max: 1, step: 0.05, value: spec.restitution ?? 1, format: (v) => formatNumber(v, 2), onInput: (v) => set('bounce', (b) => (b.restitution = v)) }).root);
    }
    const head = el('div', { class: 'properties-head' }, [el('b', { text: spec.id })]);
    head.append(iconButton('erase', 'Delete (Del)', () => this.remove(index)));
    return el('div', { class: 'properties' }, [head, ...rows]);
  }
}
