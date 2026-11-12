import { iconButton, slider } from '../controls';
import type { IconName } from '../icons';
import { el, formatNumber } from '../ui';
import { VELOCITY_COLOR, scales, type Painter } from './stage/renderer';
import type { AnchorSpec, BodySpec, ConstraintSpec, ForceSpec, RopeNodeSpec, SceneFile, Vec } from './types';

export type Tool = 'select' | 'ball' | 'box' | 'polygon' | 'platform' | 'incline' | 'wall' | 'rope' | 'rod' | 'spring' | 'pin' | 'erase';

const TOOLS: [Tool, IconName, string][] = [
  ['select', 'cursor', 'Select and move (V)'],
  ['ball', 'ball', 'Ball (B)'],
  ['box', 'box', 'Box (X)'],
  ['polygon', 'polygon', 'Any shape: click its corners (G)'],
  ['platform', 'platform', 'Fixed platform (P)'],
  ['incline', 'incline', 'Incline: drag from its foot to its top (I)'],
  ['wall', 'wall', 'Wall or ramp: drag along it (W)'],
  ['rope', 'rope', 'Rope: click two ends (O)'],
  ['rod', 'rod', 'Rigid rod: click two ends (D)'],
  ['spring', 'spring', 'Spring: click two ends (S)'],
  ['pin', 'pin', 'Pin a body to the page (N)'],
  ['erase', 'erase', 'Erase (E)'],
];

export const TOOL_KEYS: Record<string, Tool> = { v: 'select', b: 'ball', x: 'box', g: 'polygon', p: 'platform', i: 'incline', w: 'wall', o: 'rope', d: 'rod', s: 'spring', n: 'pin', e: 'erase' };

const HINTS: Record<Tool, string> = {
  select: 'Drag a body to move it, or its arrow to launch it. Click a rope or spring to edit it. Shift-click selects several.',
  ball: 'Click to drop a ball.',
  box: 'Click to place a box.',
  polygon: 'Click each corner in turn. Click the first corner again, or press Enter, to finish.',
  platform: 'Click to place a fixed platform.',
  incline: 'Drag from the foot of the slope to its top.',
  wall: 'Drag along where the wall or ramp should be.',
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

/**
 * A world to start playing with attraction: no ground and no downward gravity, a heavy sun and two planets already
 * going round it. The sun is free to move, and starts with the small velocity that keeps the whole system in place.
 */
export function orbitSandbox(): SceneFile {
  const [g, sun] = [1, 200];
  const planets: { id: string; mass: number; radius: number; r: number }[] = [
    { id: 'planet', mass: 1, radius: 0.16, r: 3 },
    { id: 'outer planet', mass: 2, radius: 0.22, r: 5 },
  ];
  const speed = (r: number) => Math.sqrt((g * sun) / r);
  const recoil = -planets.reduce((sum, p) => sum + p.mass * speed(p.r), 0) / sun;
  return {
    schema: 1,
    title: 'Orbits sandbox',
    world: { gravity: [0, 0], dt: 0.001 },
    bodies: [
      { id: 'sun', kind: 'rigid', shape: { circle: 0.5 }, mass: sun, velocity: [0, Number(recoil.toFixed(4))], restitution: 0.3 },
      ...planets.map((p): BodySpec => ({ id: p.id, kind: 'rigid', shape: { circle: p.radius }, mass: p.mass, position: [p.r, 0], velocity: [0, Number(speed(p.r).toFixed(3))], restitution: 0.3 })),
    ],
    forces: [{ gravitation: { constant: g } }],
    focus: 'planet',
    view: { center: [0, 0], half_height: 6.5 },
  };
}

/** The convex hull of some points, counter-clockwise: the shape a rubber band round them would take. */
function convexHull(points: Vec[]): Vec[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Vec, a: Vec, b: Vec) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Vec[]) => {
    const out: Vec[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

/** The area of a polygon and where its centre of mass is. */
function areaAndCentroid(points: Vec[]): { area: number; centroid: Vec } {
  let [twice, cx, cy] = [0, 0, 0];
  points.forEach(([x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length]!;
    const w = x0 * y1 - x1 * y0;
    twice += w;
    cx += (x0 + x1) * w;
    cy += (y0 + y1) * w;
  });
  return { area: Math.abs(twice) / 2, centroid: [cx / (3 * twice), cy / (3 * twice)] };
}

/** A rope, rod, spring, pin or track, by where it is in the scene. */
export interface LinkRef {
  kind: 'constraint' | 'force';
  index: number;
}

/** The ids of every body a rope, rod, spring or pin is tied to. */
function bodiesNamed(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(bodiesNamed);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, v]) => ((key === 'body' || key === 'id') && typeof v === 'string' ? [v] : bodiesNamed(v)));
}

/** A copy of a link tied to the copies of its bodies, with its fixed points moved along with them. */
function relinked(value: unknown, names: Map<string, string>, shift: Vec): unknown {
  if (Array.isArray(value)) return value.map((v) => relinked(v, names, shift));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => {
      if ((key === 'body' || key === 'id') && typeof v === 'string') return [key, names.get(v) ?? v];
      const point = Array.isArray(v) && v.length === 2 && typeof v[0] === 'number';
      if (point && ['fixed', 'peg', 'center', 'origin'].includes(key)) return [key, [(v[0] as number) + shift[0], (v[1] as number) + shift[1]]];
      return [key, relinked(v, names, shift)];
    }),
  );
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

/** To the nearest `step`, without the stray digits binary arithmetic leaves: 0.575, not 0.5750000000000001. */
const round = (value: number, step = 0.05) => Number((Math.round(value / step) * step).toPrecision(12));

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
  /** The bodies selected, by index. One of them can be edited in the panel; several can be moved, copied or removed. */
  selection: number[] = [];
  /** The rope, rod, spring, pin or track selected instead of a body. */
  pickedLink: LinkRef | undefined;
  private clipboard: { bodies: BodySpec[]; constraints: ConstraintSpec[]; forces: ForceSpec[] } | undefined;
  private pending: { tool: Tool; anchor: AnchorSpec; at: Vec } | undefined;
  /** The corners clicked so far with the polygon tool. */
  private corners: Vec[] = [];
  /** The incline or wall being dragged out. */
  private stretch: { from: Vec; to: Vec } | undefined;
  private history: string[] = [];
  private future: string[] = [];
  private lastEdit = { key: '', time: 0 };
  private readonly buttons = new Map<Tool, HTMLButtonElement>();

  /** The one selected body, when exactly one is. Setting it replaces the whole selection. */
  get selected(): number | undefined {
    return this.selection.length === 1 ? this.selection[0] : undefined;
  }

  set selected(index: number | undefined) {
    this.selection = index === undefined ? [] : [index];
    this.pickedLink = undefined;
  }

  /** Adds a body to the selection, or takes it out if it is there: what a shift-click does. */
  toggle(index: number): void {
    this.pickedLink = undefined;
    this.selection = this.selection.includes(index) ? this.selection.filter((i) => i !== index) : [...this.selection, index];
  }

  /** Selects every body whose centre is inside a box, in addition to what is selected if `add`. */
  selectWithin(a: Vec, b: Vec, add: boolean): void {
    const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
    const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
    const inside = this.scene.bodies
      .map((body, i) => ({ body, i }))
      .filter(({ body }) => !('halfplane' in body.shape))
      .filter(({ body }) => {
        const [x, y] = body.position ?? [0, 0];
        return x >= x0 && x <= x1 && y >= y0 && y <= y1;
      })
      .map(({ i }) => i);
    this.pickedLink = undefined;
    this.selection = [...new Set([...(add ? this.selection : []), ...inside])];
  }

  selectAll(): void {
    this.pickedLink = undefined;
    this.selection = this.scene.bodies.map((_, i) => i).filter((i) => !('halfplane' in this.scene.bodies[i]!.shape));
  }

  /**
   * `changed` rebuilds the world from `scene`; `hint` shows a line of guidance on the stage; `span` is how many
   * metres the stage shows from its middle to its top edge right now.
   */
  constructor(private readonly changed: () => void, private readonly hint: (text: string) => void, private readonly span: () => number = () => 4) {
    this.rail = el('div', { class: 'rail glass overlay', role: 'toolbar', 'aria-label': 'Sandbox tools' });
    for (const [tool, name, label] of TOOLS) {
      const button = iconButton(name, label, () => this.setTool(tool));
      this.buttons.set(tool, button);
      this.rail.append(button);
    }
    this.rail.append(el('div', { class: 'rail-divider' }), iconButton('undo', 'Undo (Ctrl+Z)', () => this.undo()), iconButton('redo', 'Redo (Ctrl+Shift+Z)', () => this.redo()));
    this.setTool('select');
  }

  /**
   * The size of things at the scale being looked at, as a power of ten: 1 when the stage shows a few metres, a
   * million in a remixed orbit. New bodies, the size sliders and the grid that positions snap to are all in these
   * units, so a ball dropped beside the Earth is a few hundred kilometres across and can be seen, not thirty
   * centimetres and a dot.
   */
  get unit(): number {
    const span = this.span();
    return span > 0 && Number.isFinite(span) ? 10 ** Math.floor(Math.log10(span / 2.5)) : 1;
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
    this.corners = [];
    this.stretch = undefined;
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

  /** The strength of the attraction between bodies, Newton's G in this world's units; zero when there is none. */
  get attraction(): number {
    for (const force of this.scene.forces ?? []) if ('gravitation' in force) return force.gravitation.constant;
    return 0;
  }

  set attraction(constant: number) {
    this.checkpoint('attraction');
    const others = (this.scene.forces ?? []).filter((f) => !('gravitation' in f));
    this.scene.forces = constant > 0 ? [...others, { gravitation: { constant } }] : others;
    this.changed();
  }

  /** Sets the uniform downward gravity. */
  setGravity(g: number): void {
    this.checkpoint('');
    this.scene.world.gravity = [0, -g];
    this.changed();
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
    const u = this.unit;
    if (hit.body === undefined) return { fixed: [round(hit.at[0], 0.05 * u), round(hit.at[1], 0.05 * u)] };
    const spec = this.scene.bodies[hit.body]!;
    const [px, py] = spec.position ?? [0, 0];
    const angle = spec.angle ?? 0;
    const [dx, dy] = [hit.at[0] - px, hit.at[1] - py];
    const local: Vec = [dx * Math.cos(angle) + dy * Math.sin(angle), -dx * Math.sin(angle) + dy * Math.cos(angle)];
    const offCentre = ('rectangle' in spec.shape || 'polygon' in spec.shape) && Math.hypot(local[0], local[1]) > 0.08 * u;
    return { body: offCentre ? { id: spec.id, local: [round(local[0], 0.01 * u), round(local[1], 0.01 * u)] } : { id: spec.id } };
  }

  /** A press on the stage with a placing tool. Returns true when the tool used it. */
  press(hit: Hit): boolean {
    const u = this.unit;
    const [x, y] = [round(hit.at[0], 0.05 * u), round(hit.at[1], 0.05 * u)];
    switch (this.tool) {
      case 'select':
        return false;
      case 'ball':
        return this.add({ id: this.uniqueId('ball'), kind: 'rigid', shape: { circle: 0.3 * u }, mass: 1, position: [x, y], restitution: 0.5, friction: [0.5, 0.4] });
      case 'box':
        return this.add({ id: this.uniqueId('box'), kind: 'rigid', shape: { rectangle: [0.8 * u, 0.5 * u] }, mass: 2, position: [x, y], restitution: 0.2, friction: [0.5, 0.4] });
      case 'polygon':
        return this.corner([x, y], hit.reach ?? 0.15 * u);
      case 'incline':
      case 'wall':
        this.stretch = { from: [x, y], to: [x, y] };
        return true;
      case 'platform':
        return this.add({ id: this.uniqueId('platform'), kind: 'static', shape: { rectangle: [3 * u, 0.3 * u] }, position: [x, y], friction: [0.6, 0.5] });
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

  /** Whether a press with the current tool starts a drag that `stretchTo` and `release` should follow. */
  get stretching(): boolean {
    return this.stretch !== undefined;
  }

  stretchTo(at: Vec): void {
    const u = this.unit;
    if (this.stretch) this.stretch.to = [round(at[0], 0.05 * u), round(at[1], 0.05 * u)];
  }

  /** The pointer came up: the incline or wall dragged out becomes a body. */
  release(): void {
    const drawn = this.stretch;
    this.stretch = undefined;
    if (!drawn) return;
    const u = this.unit;
    const { from } = drawn;
    let { to } = drawn;
    const tapped = Math.hypot(to[0] - from[0], to[1] - from[1]) < 0.2 * u;
    if (this.tool === 'incline') {
      // A tap gives a slope of the usual size, rising to the left from where it was tapped.
      if (tapped) to = [from[0] - 3 * u, from[1] + 1.7 * u];
      if (Math.abs(to[0] - from[0]) < 0.1 * u || Math.abs(to[1] - from[1]) < 0.1 * u) {
        this.hint('An incline needs both a width and a height: drag diagonally.');
        return;
      }
      const [high, low] = to[1] >= from[1] ? [to, from] : [from, to];
      // A right angle under the top, the slope running down to the foot.
      this.addPolygon('incline', [[high[0], low[1]], [low[0], low[1]], [high[0], high[1]]], true);
    } else {
      if (tapped) to = [from[0], from[1] + 2 * u];
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
      this.add({
        id: this.uniqueId('wall'),
        kind: 'static',
        shape: { rectangle: [round(length, 0.01 * u), 0.2 * u] },
        position: [0.5 * (from[0] + to[0]), 0.5 * (from[1] + to[1])],
        angle,
        friction: [0.5, 0.4],
      });
    }
  }

  /** A click with the polygon tool: one more corner, or the end of the shape. */
  private corner(at: Vec, reach: number): boolean {
    const near = (p: Vec | undefined) => p !== undefined && Math.hypot(p[0] - at[0], p[1] - at[1]) <= reach;
    // The first corner again closes the shape; so does a second click on the last one, as a double click does.
    if (this.corners.length >= 3 && (near(this.corners[0]) || near(this.corners[this.corners.length - 1]))) {
      this.finishPolygon();
    } else if (!near(this.corners[this.corners.length - 1])) {
      this.corners.push(at);
      if (this.corners.length === 3) this.hint('Keep clicking corners. Click the first corner again, or press Enter, to finish.');
    }
    return true;
  }

  /** Turns the corners clicked so far into a body. Returns false when there are too few to make one. */
  finishPolygon(): boolean {
    const corners = this.corners;
    this.corners = [];
    if (corners.length < 3) {
      if (this.tool === 'polygon') this.hint('A shape needs at least three corners.');
      return false;
    }
    this.hint(HINTS.polygon);
    return this.addPolygon('shape', corners, false);
  }

  /** Forgets a shape, incline or link being drawn. Returns true if there was one. */
  cancel(): boolean {
    const busy = this.corners.length > 0 || this.stretch !== undefined || this.pending !== undefined;
    this.corners = [];
    this.stretch = undefined;
    this.pending = undefined;
    return busy;
  }

  /**
   * Adds a polygon given by corners in world coordinates. The engine collides convex shapes, so a shape with a dent
   * in it is replaced by its hull, and the user is told. Corners are stored about the centre of mass, which is
   * where the body's position is.
   */
  private addPolygon(name: string, corners: Vec[], fixed: boolean): boolean {
    const u = this.unit;
    const hull = convexHull(corners);
    const { area, centroid } = areaAndCentroid(hull);
    if (hull.length < 3 || area < 1e-4 * u * u) {
      this.hint('Those corners are in a line: there is no shape between them.');
      return true;
    }
    if (hull.length < corners.length) this.hint('Shapes that collide have to be convex, so the dents were filled in.');
    const grid = 0.001 * u;
    const body: BodySpec = {
      id: this.uniqueId(name),
      kind: fixed ? 'static' : 'rigid',
      shape: { polygon: hull.map(([x, y]): Vec => [round(x - centroid[0], grid), round(y - centroid[1], grid)]) },
      position: [round(centroid[0], grid), round(centroid[1], grid)],
      friction: [0.5, 0.4],
    };
    if (!fixed) {
      // About as heavy as the box of the same area would be.
      body.mass = Math.max(0.1, Number(((5 * area) / (u * u)).toFixed(1)));
      body.restitution = 0.2;
    }
    return this.add(body);
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
    this.removeBodies([index]);
  }

  /** Removes bodies and everything tied to them, as one step for undo. */
  removeBodies(indices: number[]): void {
    const ids = indices.map((i) => this.scene.bodies[i]?.id).filter((id): id is string => id !== undefined);
    if (ids.length === 0) return;
    this.checkpoint('');
    this.scene.bodies = this.scene.bodies.filter((b) => !ids.includes(b.id));
    for (const id of ids) {
      this.scene.constraints = this.scene.constraints?.filter((c) => !mentions(c, id));
      this.scene.forces = this.scene.forces?.filter((f) => !mentions(f, id));
      this.scene.finish = this.scene.finish?.filter((f) => !JSON.stringify(f.when).includes(`"${id}"`));
      this.scene.ignore_collisions = this.scene.ignore_collisions?.filter((pair) => !pair.includes(id));
      if (this.scene.focus === id) delete this.scene.focus;
    }
    this.selected = undefined;
    this.changed();
  }

  /** Removes whatever is selected: the bodies, or the link. Returns false when nothing is. */
  removeSelection(): boolean {
    if (this.pickedLink) {
      const link = this.pickedLink;
      this.pickedLink = undefined;
      this.checkpoint('');
      if (link.kind === 'constraint') this.scene.constraints?.splice(link.index, 1);
      else this.scene.forces?.splice(link.index, 1);
      this.changed();
      return true;
    }
    if (this.selection.length === 0) return false;
    this.removeBodies(this.selection);
    return true;
  }

  // ---- copy, paste, duplicate

  /** Remembers the selected bodies, and the ropes, rods, springs and pins that join only them. */
  copy(): boolean {
    const ids = new Set(this.selection.map((i) => this.scene.bodies[i]?.id).filter((id): id is string => id !== undefined));
    if (ids.size === 0) return false;
    const within = (link: unknown) => {
      const named = bodiesNamed(link);
      return named.length > 0 && named.every((id) => ids.has(id));
    };
    this.clipboard = structuredClone({
      bodies: this.scene.bodies.filter((b) => ids.has(b.id)),
      constraints: (this.scene.constraints ?? []).filter(within),
      forces: (this.scene.forces ?? []).filter((f) => !('gravitation' in f) && within(f)),
    });
    return true;
  }

  /** Adds what was copied, a little up and to the right of where it was, under new names, and selects it. */
  paste(): boolean {
    const copied = this.clipboard;
    if (!copied) return false;
    this.checkpoint('');
    const shift: Vec = [0.5 * this.unit, 0.5 * this.unit];
    const grid = 0.01 * this.unit;
    const names = new Map<string, string>();
    const first = this.scene.bodies.length;
    for (const original of copied.bodies) {
      const body = structuredClone(original);
      body.id = this.uniqueId(original.id.replace(/ \d+$/, ''));
      names.set(original.id, body.id);
      body.position = [round((body.position?.[0] ?? 0) + shift[0], grid), round((body.position?.[1] ?? 0) + shift[1], grid)];
      this.scene.bodies.push(body);
    }
    const constraints = copied.constraints.map((c) => relinked(c, names, shift) as ConstraintSpec);
    const forces = copied.forces.map((f) => relinked(f, names, shift) as ForceSpec);
    this.constraints().push(...constraints);
    (this.scene.forces ??= []).push(...forces);
    // What was just pasted becomes what is on the clipboard, so a second paste lands beside the first.
    this.clipboard = structuredClone({ bodies: this.scene.bodies.slice(first), constraints, forces });
    this.pickedLink = undefined;
    this.selection = this.scene.bodies.map((_, i) => i).slice(first);
    this.changed();
    return true;
  }

  duplicate(): boolean {
    const kept = this.clipboard;
    if (!this.copy()) return false;
    const done = this.paste();
    this.clipboard = kept;
    return done;
  }

  /** Moves every selected body by a displacement from where each was when the drag began. */
  moveSelection(origins: Map<number, Vec>, dx: number, dy: number): void {
    this.checkpoint(`move ${[...origins.keys()].join(',')}`);
    const grid = 0.01 * this.unit;
    for (const [index, origin] of origins) {
      const spec = this.scene.bodies[index];
      if (spec && !('halfplane' in spec.shape)) spec.position = [round(origin[0] + dx, grid), round(origin[1] + dy, grid)];
    }
    this.changed();
  }

  // ---- links: ropes, rods, springs, pins and tracks

  /** The rope, rod, spring, pin or track under a point. What is drawn boldly comes before a faint track. */
  linkAt(at: Vec, reach: number): LinkRef | undefined {
    const constraints = this.scene.constraints ?? [];
    const visible = constraints.findIndex((c) => !('slot' in c) && this.touches(c, at, reach));
    if (visible >= 0) return { kind: 'constraint', index: visible };
    const spring = (this.scene.forces ?? []).findIndex((f) => 'spring' in f && this.touches(f, at, reach));
    if (spring >= 0) return { kind: 'force', index: spring };
    const track = constraints.findIndex((c) => this.touches(c, at, reach));
    return track >= 0 ? { kind: 'constraint', index: track } : undefined;
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

  /** Removes the rope, rod, pin, spring or track under a point. Returns false when there is none. */
  removeLinkAt(at: Vec, reach: number): boolean {
    const found = this.linkAt(at, reach);
    if (!found) return false;
    this.pickedLink = found;
    return this.removeSelection();
  }

  /** Moves a body by a world displacement from where the drag began. */
  moveTo(index: number, origin: Vec, dx: number, dy: number): void {
    const spec = this.scene.bodies[index];
    if (!spec) return;
    this.checkpoint(`move ${index}`);
    const grid = 0.01 * this.unit;
    spec.position = [round(origin[0] + dx, grid), round(origin[1] + dy, grid)];
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
    const reach = 0.6 * this.unit;
    return still ? [x + reach, y + reach] : [x + vx * scales.velocity, y + vy * scales.velocity];
  }

  overlay(painter: Painter, pointer: Vec | undefined): void {
    if (this.pending && pointer) painter.dashed([this.pending.at, pointer], '#94a3b8');
    const guide = '#38d6f5';
    const chosen = this.pickedLink?.kind === 'constraint' ? this.scene.constraints?.[this.pickedLink.index] : this.pickedLink ? this.scene.forces?.[this.pickedLink.index] : undefined;
    if (chosen && !('gravitation' in chosen)) {
      const { points } = this.linkPath(chosen as ConstraintSpec);
      for (const [x, y] of points) painter.knob(x, y, guide, true);
    }
    if (this.corners.length > 0) {
      // The corners so far, the edge that would follow the pointer, and the edge that would close the shape.
      const path = pointer ? [...this.corners, pointer] : this.corners;
      painter.dashed(path.length >= 3 ? [...path, path[0]!] : path, guide);
      this.corners.forEach(([x, y], i) => painter.knob(x, y, guide, i === 0 && this.corners.length >= 3));
    }
    if (this.stretch) {
      const { from, to } = this.stretch;
      if (this.tool === 'incline') {
        const [high, low] = to[1] >= from[1] ? [to, from] : [from, to];
        const corner: Vec = [high[0], low[1]];
        painter.dashed([corner, low, high, corner], guide);
        const angle = (Math.atan2(high[1] - low[1], Math.abs(high[0] - low[0])) * 180) / Math.PI;
        if (Number.isFinite(angle) && angle > 0) painter.label(`${formatNumber(angle)}°`, low[0], low[1], guide);
      } else {
        painter.dashed([from, to], guide);
        const angle = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
        painter.label(`${formatNumber(Math.hypot(to[0] - from[0], to[1] - from[1]))} m at ${formatNumber(angle)}°`, to[0], to[1], guide);
      }
      painter.knob(from[0], from[1], guide);
      painter.knob(to[0], to[1], guide, true);
    }
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
      painter.label(speed < 1e-9 ? 'drag to launch' : `${formatNumber(speed)} m/s`, tip[0], tip[1] + 0.25 * this.unit, VELOCITY_COLOR);
    }
  }

  /** The panel for several bodies at once: what can be done to all of them together. */
  private groupProperties(): HTMLElement {
    const button = (label: string, action: () => void) => {
      const b = el('button', { type: 'button', class: 'text-button outlined', text: label });
      b.addEventListener('click', action);
      return b;
    };
    return el('div', { class: 'properties' }, [
      el('div', { class: 'properties-head' }, [el('b', { text: `${this.selection.length} bodies` }), iconButton('erase', 'Delete (Del)', () => this.removeSelection())]),
      el('p', { class: 'empty', text: 'Drag any one of them to move them all. Shift-click adds or removes a body; shift-drag on empty space selects a box.' }),
      el('div', { class: 'info-actions' }, [button('Duplicate', () => this.duplicate()), button('Copy', () => this.copy())]),
    ]);
  }

  /**
   * The panel that edits a rope, rod or spring. `measured` is the scene as the engine built it, with the lengths it
   * measured at the start written out: a rope left taut has no length of its own until then.
   */
  private linkProperties(ref: LinkRef, measured?: SceneFile): HTMLElement | undefined {
    const u = this.unit;
    const length = (v: number) => (Math.abs(v) >= 1000 ? `${formatNumber(v / 1000)} km` : `${formatNumber(v)} m`);
    const list = ref.kind === 'constraint' ? this.scene.constraints : this.scene.forces;
    const spec = list?.[ref.index];
    if (!spec) return undefined;
    const built = (ref.kind === 'constraint' ? measured?.constraints : measured?.forces)?.[ref.index];
    const span = () => {
      const { points } = this.linkPath(spec as ConstraintSpec);
      return points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]), 0);
    };
    const set = (key: string, apply: () => void) => {
      this.checkpoint(`${key} ${ref.kind} ${ref.index}`);
      apply();
      this.changed();
    };
    const lengthSlider = (label: string, value: number, apply: (v: number) => void) =>
      slider({ label, min: 0.1 * u, max: Math.max(2 * value, 2 * u), step: 0.05 * u, hardMin: 1e-3, hardMax: 1e12, value, format: length, onInput: (v) => set('length', () => apply(v)) }).root;
    let name = 'Link';
    const rows: HTMLElement[] = [];
    const note = (text: string) => rows.push(el('p', { class: 'empty', text }));
    if ('rope' in spec) {
      name = 'Rope';
      const from = built && 'rope' in built ? built.rope.length : undefined;
      rows.push(lengthSlider('Length', spec.rope.length ?? from ?? span(), (v) => (spec.rope.length = v)));
      note('Longer than the path between its ends and it starts slack. Shorter, and it pulls the ends together at the start.');
    } else if ('rod' in spec) {
      name = 'Rod';
      const from = built && 'rod' in built ? built.rod.length : undefined;
      rows.push(lengthSlider('Length', spec.rod.length ?? from ?? span(), (v) => (spec.rod.length = v)));
      note('A rod keeps its ends exactly this far apart. Change it and they are moved to fit when the run starts.');
    } else if ('spring' in spec) {
      name = 'Spring';
      const from = built && 'spring' in built ? built.spring.rest_length : undefined;
      rows.push(
        slider({ label: 'Stiffness k', min: 1, max: 500, step: 1, hardMin: 0.001, hardMax: 1e12, value: spec.spring.stiffness, format: (v) => `${formatNumber(v)} N/m`, onInput: (v) => set('stiffness', () => (spec.spring.stiffness = v)) }).root,
        lengthSlider('Natural length', spec.spring.rest_length ?? from ?? span(), (v) => (spec.spring.rest_length = v)),
      );
      note('The spring pulls when it is longer than its natural length and pushes when it is shorter.');
    } else if ('pin' in spec) {
      name = 'Pin';
      note('A pin holds one point of a body in place and lets it turn about it.');
    } else if ('slot' in spec) {
      name = 'Track';
      note('A track keeps a body on a line. It can slide along it and nothing else.');
    } else {
      return undefined;
    }
    return el('div', { class: 'properties' }, [el('div', { class: 'properties-head' }, [el('b', { text: name }), iconButton('erase', 'Delete (Del)', () => this.removeSelection())]), ...rows]);
  }

  /** The panel that edits the selected body. */
  properties(measured?: SceneFile): HTMLElement | undefined {
    if (this.pickedLink) return this.linkProperties(this.pickedLink, measured);
    if (this.selection.length > 1) return this.groupProperties();
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
    const u = this.unit;
    const length = (v: number) => (Math.abs(v) >= 1000 ? `${formatNumber(v / 1000)} km` : `${formatNumber(v)} m`);
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
      rows.push(slider({ label: 'Radius', min: 0.05 * u, max: 1.5 * u, step: 0.05 * u, hardMin: 1e-3, hardMax: 1e12, value: spec.shape.circle, format: length, onInput: (v) => set('size', (b) => (b.shape = { circle: v })) }).root);
    } else if ('rectangle' in spec.shape) {
      const [w, h] = spec.shape.rectangle;
      rows.push(
        slider({ label: 'Width', min: 0.1 * u, max: 8 * u, step: 0.1 * u, hardMin: 1e-3, hardMax: 1e12, value: w, format: length, onInput: (v) => set('width', (b) => 'rectangle' in b.shape && (b.shape = { rectangle: [v, b.shape.rectangle[1]] })) }).root,
        slider({ label: 'Height', min: 0.1 * u, max: 4 * u, step: 0.1 * u, hardMin: 1e-3, hardMax: 1e12, value: h, format: length, onInput: (v) => set('height', (b) => 'rectangle' in b.shape && (b.shape = { rectangle: [b.shape.rectangle[0], v] })) }).root,
        slider({ label: 'Tilt', min: -90, max: 90, step: 1, hardMin: -180, hardMax: 180, value: Number((((spec.angle ?? 0) * 180) / Math.PI).toFixed(3)), format: (v) => `${formatNumber(v)}°`, onInput: (v) => set('tilt', (b) => (b.angle = (v * Math.PI) / 180)) }).root,
      );
    }
    if ('polygon' in spec.shape) {
      const reach = (points: Vec[]) => Math.max(...points.map(([x, y]) => Math.hypot(x, y)));
      rows.push(
        slider({
          label: 'Size',
          min: 0.1 * u,
          max: 5 * u,
          step: 0.05 * u,
          hardMin: 1e-3,
          hardMax: 1e12,
          value: reach(spec.shape.polygon),
          format: length,
          // Every corner moves out from the centre of mass by the same factor: the shape is kept, only its size changes.
          onInput: (v) =>
            set('size', (b) => {
              if (!('polygon' in b.shape)) return;
              const factor = v / reach(b.shape.polygon);
              b.shape = { polygon: b.shape.polygon.map(([x, y]): Vec => [x * factor, y * factor]) };
            }),
        }).root,
        slider({ label: 'Tilt', min: -90, max: 90, step: 1, hardMin: -180, hardMax: 180, value: Number((((spec.angle ?? 0) * 180) / Math.PI).toFixed(3)), format: (v) => `${formatNumber(v)}°`, onInput: (v) => set('tilt', (b) => (b.angle = (v * Math.PI) / 180)) }).root,
      );
    }
    rows.push(
      slider({ label: 'Friction μ', min: 0, max: 1, step: 0.05, hardMax: 10, value: spec.friction?.[0] ?? 0, format: (v) => formatNumber(v, 2), onInput: (v) => set('friction', (b) => (b.friction = [v, round(0.8 * v, 0.01)])) }).root,
    );
    if (!isStatic) {
      rows.push(slider({ label: 'Bounce e', min: 0, max: 1, step: 0.05, value: spec.restitution ?? 1, format: (v) => formatNumber(v, 2), onInput: (v) => set('bounce', (b) => (b.restitution = v)) }).root);
    }
    // At a few pixels across a body is drawn as a dot of fixed size, and changing its size changes nothing on screen.
    const size = 'circle' in spec.shape ? 2 * spec.shape.circle : 'rectangle' in spec.shape ? Math.max(...spec.shape.rectangle) : Infinity;
    if (size < this.span() / 60) {
      rows.push(el('p', { class: 'empty', text: `At this zoom it is too small to draw to scale, so it shows as a dot. Sizes here are best set in steps of ${length(0.05 * u)}, or zoom in.` }));
    }
    const head = el('div', { class: 'properties-head' }, [el('b', { text: spec.id })]);
    head.append(iconButton('erase', 'Delete (Del)', () => this.remove(index)));
    return el('div', { class: 'properties' }, [head, ...rows]);
  }
}
