import type { Param } from '../mechanics/types';

export type Vec = [number, number];

export interface OpticsSpec {
  id: string;
  title: string;
  description: string;
  syllabus: { class: number; chapter: string; topic: string };
  params: Param[];
}

/** Something on the bench, as a line to draw. Glass is a closed outline; a lens is the line across it. */
export interface ElementInfo {
  kind: 'mirror' | 'screen' | 'glass' | 'lens';
  points: Vec[];
  /** Refractive index of glass; zero otherwise. */
  index: number;
  /** Focal length of an ideal lens in metres, negative for a diverging one; zero otherwise. */
  focal: number;
}

export interface RayEvent {
  at: Vec;
  kind: 'reflection' | 'refraction' | 'total_reflection' | 'lens' | 'absorbed';
  /** Unit normal on the side the ray came from. */
  normal: Vec;
  /** Degrees from the normal, arriving and leaving. */
  incidence: number;
  emergence: number;
}

export interface RayInfo {
  points: Vec[];
  events: RayEvent[];
  end: 'escaped' | 'absorbed' | 'exhausted';
  /** Mark the normal and the angles where this ray meets a surface. */
  angles: boolean;
  /** Drawn lightly: background to another ray. */
  faint: boolean;
}

export interface ObjectInfo {
  base: Vec;
  tip: Vec;
  /** The paraxial image; null when it is at infinity. */
  image: { base: Vec; tip: Vec; real: boolean } | null;
}

export interface MarkInfo {
  at: Vec;
  label: string;
}

export interface AnswerInfo {
  name: string;
  value: number;
  /** What the traced rays give, where they can give it. */
  measured: number | null;
}

export interface OpticsView {
  center: Vec;
  half_width: number;
  half_height: number;
}

/** Everything about a traced bench that the stage draws. */
export interface BenchFrame {
  elements: ElementInfo[];
  rays: RayInfo[];
  objects: ObjectInfo[];
  marks: MarkInfo[];
  axis?: [Vec, Vec];
}
