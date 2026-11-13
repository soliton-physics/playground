export interface Param {
  name: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface ScenarioSpec {
  id: string;
  title: string;
  description: string;
  syllabus: { class: number; chapter: string; topic: string };
  params: Param[];
  dt: number;
  duration: number;
}

export type ShapeInfo =
  | { kind: 'circle'; radius: number }
  | { kind: 'polygon'; vertices: [number, number][] }
  | { kind: 'halfplane'; normal: [number, number]; offset: number };

export interface BodyInfo {
  label: string;
  kind: 'particle' | 'rigid' | 'static';
  mass: number;
  /** Electric charge in coulombs; zero for a body with none. */
  charge: number;
  /** `[moment, length]` of a bar magnet, A·m² and m, north towards the body's x axis; null for anything else. */
  magnet: [number, number] | null;
  /** Moment taken on per tesla: positive for a paramagnet, negative for a diamagnet. */
  polarisability: number;
  shape: ShapeInfo;
}

/**
 * A fixed wire, sheet or shell of charge. `at` is where the wire meets the page, a point on the sheet, or the
 * centre of the shell; `amount` is C/m, C/m² or C.
 */
export interface DistributionInfo {
  kind: 'wire' | 'sheet' | 'shell';
  at: [number, number];
  normal: [number, number];
  radius: number;
  amount: number;
}

/** A closed surface the flux is totalled through: a sphere, drawn as its circle in the page. */
export interface SurfaceSpec {
  centre: Vec;
  radius: number;
}

/** A uniform field: electric in N/C as it is now, or magnetic in tesla out of the page. */
export interface FieldInfo {
  kind: 'electric' | 'magnetic';
  electric: [number, number];
  magnetic: number;
  /** Opposite corners of the rectangle it is confined to, or null when it fills the plane. */
  region: [[number, number], [number, number]] | null;
}

export interface ForceInfo {
  label: string;
  /** An impact impulse spread over one step; shown as force × dt. */
  impulsive: boolean;
  force: [number, number];
  point: [number, number];
  torque: number;
}

export type SketchInfo =
  | { kind: 'line'; points: [[number, number], [number, number]] }
  | { kind: 'polyline'; points: [number, number][] }
  | { kind: 'circle'; center: [number, number]; radius: number }
  | { kind: 'spring'; points: [[number, number], [number, number]] }
  | { kind: 'pivot'; point: [number, number] };

export interface EventInfo {
  time: number;
  kind: string;
  bodies: number[];
}

export interface EnergyInfo {
  kinetic: number;
  potential: number;
  dissipated: number;
  external_work: number;
  conserved: number;
}

export interface ExactInfo {
  name: string;
  value: number;
}

export interface View {
  center: [number, number];
  half_height: number;
  half_width?: number;
}

/** Why and when the problem a scene poses ended. */
export interface FinishInfo {
  time: number;
  reason: string;
}

/** The hand on a body: the held point and where the pointer is. */
export interface GrabInfo {
  body: number;
  point: [number, number];
  target: [number, number];
}

/** One body's row of the flat state array: `[x, y, angle, vx, vy, omega, ax, ay]`. */
export const STATE_STRIDE = 8;

// ---- scene JSON (schema 1), as the engine reads and writes it ----

export type Vec = [number, number];

export type ShapeSpec = { circle: number } | { rectangle: Vec } | { polygon: Vec[] } | { halfplane: { normal: Vec; offset: number } };

export interface BodySpec {
  id: string;
  kind: 'particle' | 'rigid' | 'static';
  shape: ShapeSpec;
  mass?: number;
  position?: Vec;
  angle?: number;
  velocity?: Vec;
  angular_velocity?: number;
  friction?: Vec;
  restitution?: number;
  inertia?: number;
  charge?: number;
  magnet?: { moment: number; length: number };
  magnetisable?: { susceptibility: number; volume: number };
}

export type AnchorSpec = { fixed: Vec } | { body: { id: string; local?: Vec } };

export type RopeNodeSpec =
  | { attach: { body: string; local?: Vec } }
  | { peg: Vec }
  | { pulley: { center: Vec; radius: number; wrap: string } }
  | { wheel: { body: string; radius: number; wrap: string } };

export type ConstraintSpec =
  | { pin: { a: AnchorSpec; b: AnchorSpec } }
  | { rod: { a: AnchorSpec; b: AnchorSpec; length?: number } }
  | { slot: { body: string; local?: Vec; origin: Vec; direction: Vec } }
  | { fixed_angle: { body: string; angle: number } }
  | { rope: { nodes: RopeNodeSpec[]; length?: number } };

export type ForceSpec =
  | { applied: { body: string; force: Vec; point?: Vec; from?: number; until?: number } }
  | { torque: { body: string; torque: number } }
  | { spring: { a: AnchorSpec; b: AnchorSpec; stiffness: number; rest_length?: number; pushes_only?: boolean } }
  | { linear_drag: { body: string; coefficient: number } }
  | { quadratic_drag: { body: string; coefficient: number } }
  | { driving: { body: string; amplitude: Vec; angular_frequency: number; phase?: number } }
  | { gravitation: { constant: number; fixed?: { at: Vec; mass: number }[] } }
  | { electrostatics: { constant?: number; fixed?: DistributionSpec[] } }
  | { magnetostatics: { constant?: number; background?: Vec } }
  | { electric_field: { field: Vec; region?: RegionSpec; angular_frequency?: number; phase?: number } }
  | { magnetic_field: { strength: number; region?: RegionSpec } };

export type DistributionSpec =
  | { wire: { at: Vec; density: number } }
  | { sheet: { point: Vec; normal: Vec; density: number } }
  | { shell: { centre: Vec; radius: number; charge: number } };

export interface RegionSpec {
  min: Vec;
  max: Vec;
}

export interface SceneFile {
  schema: 1;
  title: string;
  description?: string;
  syllabus?: { class: number; chapter: string; topic: string };
  world: { gravity: Vec; dt: number };
  bodies: BodySpec[];
  forces?: ForceSpec[];
  constraints?: ConstraintSpec[];
  ignore_collisions?: [string, string][];
  focus?: string;
  answers?: ExactInfo[];
  view?: View;
  finish?: { when: Record<string, unknown>; hold?: number }[];
  playback?: number;
  surface?: SurfaceSpec;
}
