import type { Param } from '../mechanics/types';

export interface ThermalSpec {
  id: string;
  title: string;
  description: string;
  syllabus: { class: number; chapter: string; topic: string };
  params: Param[];
}

export interface GroupInfo {
  name: string;
  count: number;
  /** amu. */
  mass: number;
  /** nm. */
  radius: number;
}

export interface NowInfo {
  /** ps. */
  time: number;
  /** K. */
  temperature: number;
  /** atm, averaged over the last few picoseconds. */
  pressure: number;
  /** nm³. */
  volume: number;
  /** Totals since the start, 10⁻²¹ J. */
  energy: number;
  work: number;
  heat: number;
  encounters: number;
}

export interface ThermalAnswer {
  name: string;
  value: number;
  /** What the gas gives so far; null until its stage has begun. */
  measured: number | null;
  /** The fraction within which the two count as agreeing. */
  tolerance: number;
}

/** The parts of a scene's JSON the page reads directly. */
export interface ThermalSceneFile {
  size: [number, number, number];
  groups: { name: string; temperature: number; mass: number }[];
  stages: { label: string; piston_to?: number; walls: 'insulated' | { bath: number } | { ends: { left: number; right: number } } }[];
}

/** Molecules as the engine hands them over: `x, y, z, radius, species` each. */
export const MOLECULE_STRIDE = 5;
