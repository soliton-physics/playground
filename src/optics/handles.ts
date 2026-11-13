import type { Vec } from './types';

type Values = Record<string, number>;

/** A knob on the bench that stands for one or two of a scenario's parameters. Positions are in metres. */
export interface Handle {
  label: (p: Values) => string;
  position: (p: Values) => Vec;
  /** The parameters a pointer at `at` asks for; the caller clamps and snaps them. */
  drag: (at: Vec, p: Values) => Values;
}

const CM = 0.01;
const deg = (radians: number) => (radians * 180) / Math.PI;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** The tip of the object arrow: across for its distance, up for its height. */
const objectTip: Handle = {
  label: (p) => `${p.distance} cm away, ${p.height} cm tall`,
  position: (p) => [-p.distance! * CM, p.height! * CM],
  drag: (at) => ({ distance: -at[0] / CM, height: at[1] / CM }),
};

/** Where a ray that meets the origin sets out from, `reach` metres back along it; `flip` for one coming from below. */
const incoming = (reach: number, flip = false): Handle => ({
  label: (p) => `${p.angle}° from the normal`,
  position: (p) => [-reach * Math.sin(rad(p.angle!)), (flip ? -1 : 1) * reach * Math.cos(rad(p.angle!))],
  drag: (at) => ({ angle: deg(Math.atan2(-at[0], Math.abs(at[1]))) }),
});

export const HANDLES: Record<string, Handle[]> = {
  'concave-mirror': [objectTip],
  'convex-mirror': [objectTip],
  'convex-lens': [objectTip],
  'concave-lens': [objectTip],
  'snells-law': [incoming(0.3)],
  'glass-slab': [incoming(0.15)],
  'total-internal-reflection': [
    {
      label: (p) => `${p.angle}° from the normal`,
      position: (p) => [0.2 * Math.tan(rad(p.angle!)), 0],
      drag: (at) => ({ angle: deg(Math.atan2(Math.max(at[0], 0), 0.2)) }),
    },
  ],
  'apparent-depth': [{ label: (p) => `${p.depth} cm down`, position: (p) => [0, -p.depth! * CM], drag: (at) => ({ depth: -at[1] / CM }) }],
  'spherical-surface': [{ label: (p) => `${p.distance} cm away`, position: (p) => [-p.distance! * CM, 0], drag: (at) => ({ distance: -at[0] / CM }) }],
  prism: [
    {
      label: (p) => `${p.angle}° from the normal`,
      position: (p) => {
        const half = rad(p.apex!) / 2;
        const meet: Vec = [-0.06 * Math.tan(half), 0.06];
        const way = -half + rad(p.angle!);
        return [meet[0] - 0.16 * Math.cos(way), meet[1] - 0.16 * Math.sin(way)];
      },
      drag: (at, p) => {
        const half = rad(p.apex!) / 2;
        const meet: Vec = [-0.06 * Math.tan(half), 0.06];
        return { angle: deg(Math.atan2(meet[1] - at[1], meet[0] - at[0]) + half) };
      },
    },
  ],
  'optical-fibre': [
    {
      label: (p) => `enters at ${p.angle}°`,
      position: (p) => [-0.06 * Math.cos(rad(p.angle!)), -0.06 * Math.sin(rad(p.angle!))],
      drag: (at) => ({ angle: deg(Math.atan2(-at[1], -at[0])) }),
    },
  ],
  telescope: [{ label: (p) => `eyepiece: f = ${p.eyepiece} cm`, position: (p) => [(p.objective! + p.eyepiece!) * CM, 0], drag: (at, p) => ({ eyepiece: at[0] / CM - p.objective! }) }],
  'compound-microscope': [{ label: (p) => `${p.beyond} cm beyond the focus`, position: (p) => [-(p.objective! + p.beyond!) * CM, 0], drag: (at, p) => ({ beyond: -at[0] / CM - p.objective! }) }],
  'lenses-in-contact': [],
  'lens-maker': [{ label: (p) => `beam ${p.width} cm wide`, position: (p) => [-0.12, (p.width! * CM) / 2], drag: (at) => ({ width: (2 * Math.abs(at[1])) / CM }) }],
};
