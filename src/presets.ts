import type { WaveSimulation } from './engine';

export type Model = 'kdv' | 'nls';

export interface Preset {
  id: string;
  title: string;
  description: string;
  model: Model;
  points: number;
  length: number;
  dt: number;
  stepsPerFrame: number;
  range: [number, number];
  setup(sim: WaveSimulation, x: Float64Array): void;
}

const sech = (x: number) => 1 / Math.cosh(x);

function setProfile(
  sim: WaveSimulation,
  x: Float64Array,
  re: (x: number) => number,
  im: (x: number) => number = () => 0,
): void {
  sim.set_state(x.map(re), x.map(im));
}

export const presets: Preset[] = [
  {
    id: 'kdv-soliton',
    title: 'KdV: a single soliton',
    description:
      'A lone sech² pulse travels at constant speed without changing shape. Taller solitons are narrower and faster.',
    model: 'kdv',
    points: 512,
    length: 60,
    dt: 1e-3,
    stepsPerFrame: 20,
    range: [-0.5, 3.5],
    setup: (sim) => sim.add_kdv_soliton(4, -15),
  },
  {
    id: 'kdv-collision',
    title: 'KdV: two solitons collide',
    description:
      'The fast soliton catches the slow one, they merge briefly, then both emerge with their original shapes. The only trace of the collision is a small shift in position.',
    model: 'kdv',
    points: 1024,
    length: 80,
    dt: 5e-4,
    stepsPerFrame: 40,
    range: [-0.5, 4],
    setup: (sim) => {
      sim.add_kdv_soliton(6, -25);
      sim.add_kdv_soliton(1.5, -5);
    },
  },
  {
    id: 'kdv-fission',
    title: 'KdV: a bump breaks into solitons',
    description:
      'A smooth Gaussian is not a soliton. Nonlinearity steepens it, dispersion spreads it, and the balance sorts it into a train of solitons, tallest first, plus a small dispersive tail.',
    model: 'kdv',
    points: 1024,
    length: 80,
    dt: 5e-4,
    stepsPerFrame: 40,
    range: [-1, 7],
    setup: (sim, x) => setProfile(sim, x, (x) => 3 * Math.exp(-((x + 25) ** 2) / 16)),
  },
  {
    id: 'nls-soliton',
    title: 'NLS: a bright soliton',
    description:
      'The envelope |ψ| keeps its shape while the carrier wave underneath (Re ψ) oscillates. This is the model for optical pulses in fibres and matter waves in condensates.',
    model: 'nls',
    points: 512,
    length: 40 * Math.PI,
    dt: 1e-3,
    stepsPerFrame: 20,
    range: [-1.5, 1.5],
    setup: (sim) => sim.add_nls_soliton(1, 1, -20),
  },
  {
    id: 'nls-collision',
    title: 'NLS: two bright solitons collide',
    description:
      'Two envelopes pass through each other. During the overlap their phases interfere, but both come out intact.',
    model: 'nls',
    points: 512,
    length: 40 * Math.PI,
    dt: 1e-3,
    stepsPerFrame: 20,
    range: [-2, 2],
    setup: (sim) => {
      sim.add_nls_soliton(1, 1, -25);
      sim.add_nls_soliton(0.8, -0.5, 15);
    },
  },
  {
    id: 'nls-breather',
    title: 'NLS: Satsuma–Yajima breather',
    description:
      'Start with twice a soliton’s amplitude, 2 sech x. It does not travel. It breathes: the profile oscillates with period π/2, a bound state of two solitons sharing one centre.',
    model: 'nls',
    points: 1024,
    length: 16 * Math.PI,
    dt: 5e-4,
    stepsPerFrame: 10,
    range: [-4.5, 4.5],
    setup: (sim, x) => setProfile(sim, x, (x) => 2 * sech(x)),
  },
];

export function findPreset(id: string | null): Preset {
  return presets.find((preset) => preset.id === id) ?? presets[0]!;
}
