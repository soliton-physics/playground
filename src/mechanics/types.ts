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
  shape: ShapeInfo;
}

export interface ForceInfo {
  label: string;
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
}

/** One body's row of the flat state array: `[x, y, angle, vx, vy, omega, ax, ay]`. */
export const STATE_STRIDE = 8;
