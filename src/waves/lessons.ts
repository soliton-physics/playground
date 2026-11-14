import { formatDuration, formatNumber, formatPrefixed, formatQuantity, prefixFor } from '../ui';
import { CapacitorScene } from './capacitor';
import { colourOf, PatternScene, type Pattern } from './pattern';
import type { Formula } from './formulas';
import { resultant, type Component, type Pulse, type Sine } from './model';
import type { WaveScene } from './scene';

/** Something the reader can change: a slider, or a choice between a few named values. */
export interface Param {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  hardMin?: number;
  hardMax?: number;
  options?: { label: string; value: number }[];
}

export type Values = Record<string, number>;

export interface Fact {
  label: string;
  value: string;
}

/** Something drawn on the plot to name a part of the wave. */
export type Mark =
  | { kind: 'span'; from: number; to: number; at: number; label: string }
  | { kind: 'rise'; x: number; to: number; label: string }
  | { kind: 'point'; x: number; label: string; tone: 'node' | 'antinode' }
  | { kind: 'end'; x: number; type: 'fixed' | 'free' | 'closed' | 'open' }
  | { kind: 'now'; x: number }
  | { kind: 'spectrum'; power: number; bands: { from: number; name: string }[] }
  | { kind: 'heading'; direction: 1 | -1; label: string };

export interface Lesson {
  id: string;
  title: string;
  description: string;
  params: Param[];
  domain(p: Values): [number, number];
  parts(p: Values): Component[];
  /** The largest displacement the plot must have room for. */
  height(p: Values): number;
  /** The numbers worth knowing about this wave, worked out from the parameters. */
  facts(p: Values): Fact[];
  marks?(p: Values, t: number): Mark[];
  formulas: Formula[];
  /** The chapter it belongs to, when that is not class 11's waves. */
  chapter?: string;
  /**
   * What the wave travels in. Air is drawn as layers that move along the wave; a string as beads that move across.
   * Light needs nothing to travel in: its displacement is the electric field, and the magnetic field is drawn with it.
   */
  medium: 'string' | 'air' | 'light';
  /** Unit of position, when metres would be the wrong size. */
  xUnit?(p: Values): string;
  /** The speed light has here, in m/s, for the magnetic field that goes with the electric one. */
  lightSpeed?(p: Values): number;
  /** A scene of its own, for a lesson that is not a wave along a line. */
  build?(p: Values, startAt: number): WaveScene;
  /** Unit of displacement: a string moves centimetres, air a few thousandths of a millimetre. */
  yUnit: string;
  /** Draw each part faintly behind their sum. */
  showParts?: boolean;
  /** When the story is over, for a pulse that has done what it came to do. */
  duration?(p: Values): number;
}

const TAU = 2 * Math.PI;
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const q = formatQuantity;
const sine = (amplitude: number, wavelength: number, frequency: number, phase = 0, direction: 1 | -1 = 1): Sine => ({ kind: 'sine', amplitude, wavelength, frequency, phase, direction });
const pulse = (amplitude: number, width: number, centre: number, speed: number, direction: 1 | -1): Pulse => ({ kind: 'pulse', amplitude, width, centre, speed, direction });

const amplitude = (value: number, unit = 'm', max = 0.5): Param => ({ id: 'amplitude', label: 'Amplitude', unit, min: max / 10, max, step: max / 100, value, hardMin: 0, hardMax: max * 20 });
const wavelength = (value: number, max = 6): Param => ({ id: 'wavelength', label: 'Wavelength', unit: 'm', min: max / 12, max, step: max / 120, value, hardMin: max / 600, hardMax: max * 100 });
const frequency = (value: number, min: number, max: number, id = 'frequency', label = 'Frequency'): Param => ({ id, label, unit: 'Hz', min, max, step: (max - min) / 200, value, hardMin: min / 100, hardMax: max * 100 });

/** The crest nearest the left of the plot, so that the labels ride along with the wave. */
function firstCrest(c: Sine, from: number, t: number): number {
  const k = TAU / c.wavelength;
  const x = (Math.PI / 2 - c.phase + c.direction * TAU * c.frequency * t) / k;
  return from + ((((x - from) % c.wavelength) + c.wavelength) % c.wavelength);
}

function crestMarks(c: Sine, [from, to]: [number, number], t: number, top: number, height = 'A'): Mark[] {
  let crest = firstCrest(c, from, t);
  if (crest + c.wavelength > to) crest -= c.wavelength;
  if (crest < from || c.amplitude <= 0) return [];
  return [
    { kind: 'span', from: crest, to: crest + c.wavelength, at: top, label: `λ = ${q(c.wavelength, 'm')}` },
    { kind: 'rise', x: crest, to: c.amplitude, label: height },
  ];
}

const sineFacts = (c: Sine): Fact[] => [
  { label: 'Speed of the wave, v = fλ', value: q(c.frequency * c.wavelength, 'm/s') },
  { label: 'Period, T = 1/f', value: formatDuration(1 / c.frequency) },
  { label: 'Wave number, k = 2π/λ', value: q(TAU / c.wavelength, 'rad/m') },
  { label: 'Angular frequency, ω = 2πf', value: q(TAU * c.frequency, 'rad/s') },
];

/** Nodes and antinodes of 2A sin(kx + shift) cos ωt between the two ends. */
function stationaryMarks(lambda: number, shift: number, [from, to]: [number, number]): Mark[] {
  const marks: Mark[] = [];
  const quarter = lambda / 4;
  // sin(kx + shift) = 0 at x = (nπ − shift)/k; every quarter wavelength alternates node, antinode.
  const start = (-shift / TAU) * lambda;
  for (let n = Math.ceil((from - start) / quarter - 1e-9); start + n * quarter <= to + 1e-9; n++) {
    marks.push({ kind: 'point', x: start + n * quarter, label: n % 2 === 0 ? 'N' : 'A', tone: n % 2 === 0 ? 'node' : 'antinode' });
  }
  return marks;
}

const travelling: Lesson = {
  id: 'travelling-wave',
  title: 'A travelling wave',
  description:
    'The shape moves along; the string does not. Watch one bead: it only goes up and down, once for every wavelength that passes. Click anywhere on the wave to read that point.',
  params: [
    amplitude(0.2),
    wavelength(2),
    frequency(1, 0.2, 5),
    { id: 'phase', label: 'Starting phase', unit: '°', min: 0, max: 360, step: 5, value: 0 },
    { id: 'direction', label: 'Travels', unit: '', min: -1, max: 1, step: 2, value: 1, options: [{ label: 'to the right', value: 1 }, { label: 'to the left', value: -1 }] },
  ],
  domain: () => [0, 12],
  parts: (p) => [sine(p.amplitude!, p.wavelength!, p.frequency!, rad(p.phase!), p.direction! < 0 ? -1 : 1)],
  height: (p) => p.amplitude!,
  facts: (p) => sineFacts(sine(p.amplitude!, p.wavelength!, p.frequency!)),
  marks(p, t) {
    const [c] = this.parts(p) as [Sine];
    return crestMarks(c, this.domain(p), t, p.amplitude! * 1.25);
  },
  formulas: [
    { label: 'Displacement', tex: String.raw`y(x,t) = A\,\sin(kx - \omega t + \varphi)`, note: 'Moving to the left, the sign in the middle becomes +.' },
    { label: 'How the numbers are tied', tex: String.raw`k = \frac{2\pi}{\lambda}, \qquad \omega = 2\pi f = \frac{2\pi}{T}, \qquad v = f\lambda = \frac{\omega}{k}` },
    { label: 'Speed of a bead on the string', tex: String.raw`\frac{\partial y}{\partial t} = -A\,\omega\,\cos(kx - \omega t + \varphi)`, note: 'Greatest, Aω, as the bead passes through rest. It is not the speed of the wave.' },
    { label: 'Phase difference between two points', tex: String.raw`\Delta\varphi = \frac{2\pi}{\lambda}\,\Delta x`, note: 'Click a second point to see it.' },
  ],
  medium: 'string',
  yUnit: 'm',
};

const longitudinal: Lesson = {
  id: 'sound-wave',
  title: 'A sound wave',
  description:
    'In sound the air moves back and forth along the direction the wave travels. The layers bunch up into compressions and spread into rarefactions, and it is that pattern which moves. The graph shows how far each layer is from its place.',
  params: [frequency(170, 85, 680), { id: 'speed', label: 'Speed of sound', unit: 'm/s', min: 300, max: 360, step: 1, value: 340, hardMin: 100, hardMax: 6000 }, amplitude(10, 'µm', 20)],
  domain: () => [0, 8],
  parts: (p) => [sine(p.amplitude!, p.speed! / p.frequency!, p.frequency!)],
  height: (p) => p.amplitude!,
  facts: (p) => [{ label: 'Wavelength, λ = v/f', value: q(p.speed! / p.frequency!, 'm') }, ...sineFacts(sine(1, p.speed! / p.frequency!, p.frequency!)).slice(1)],
  marks(p, t) {
    const [c] = this.parts(p) as [Sine];
    const [from, to] = this.domain(p);
    // Layers crowd together where the displacement falls through zero going along the wave: a quarter wavelength
    // past each crest.
    const marks: Mark[] = [];
    for (let x = firstCrest(c, from, t) + c.wavelength / 4 - c.wavelength; x <= to; x += c.wavelength / 2) {
      const compression = Math.round((x - firstCrest(c, from, t) - c.wavelength / 4) / (c.wavelength / 2)) % 2 === 0;
      if (x >= from) marks.push({ kind: 'point', x, label: compression ? 'C' : 'R', tone: compression ? 'antinode' : 'node' });
    }
    return marks;
  },
  formulas: [
    { label: 'Displacement of a layer of air', tex: String.raw`s(x,t) = s_0\,\sin(kx - \omega t)`, note: 'Along the direction of travel, not across it.' },
    { label: 'Change in pressure', tex: String.raw`\Delta p = -B\,\frac{\partial s}{\partial x} = -B\,k\,s_0\cos(kx - \omega t)`, note: 'Greatest where the displacement is zero: C marks a compression, R a rarefaction.' },
    { label: 'Speed of sound in a gas', tex: String.raw`v = \sqrt{\frac{\gamma P}{\rho}}`, note: 'Newton’s formula with Laplace’s correction. About 340 m/s in air at room temperature.' },
    { label: 'Wavelength', tex: String.raw`\lambda = \frac{v}{f}` },
  ],
  medium: 'air',
  yUnit: 'µm',
};

const onString: Lesson = {
  id: 'wave-on-string',
  title: 'Speed of a wave on a string',
  description:
    'How fast a wave runs along a string is set by the string alone: how hard it is pulled and how heavy it is. Shake it faster and the wave does not hurry; the wavelength shrinks instead.',
  params: [
    { id: 'tension', label: 'Tension', unit: 'N', min: 1, max: 100, step: 1, value: 20, hardMin: 0.01, hardMax: 1e5 },
    { id: 'density', label: 'Mass per metre', unit: 'kg/m', min: 0.005, max: 0.5, step: 0.005, value: 0.05, hardMin: 1e-5, hardMax: 100 },
    frequency(5, 1, 20),
    amplitude(0.1),
  ],
  domain: () => [0, 20],
  parts: (p) => [sine(p.amplitude!, Math.sqrt(p.tension! / p.density!) / p.frequency!, p.frequency!)],
  height: (p) => p.amplitude!,
  facts: (p) => {
    const v = Math.sqrt(p.tension! / p.density!);
    return [{ label: 'Speed of the wave, v = √(T/μ)', value: q(v, 'm/s') }, { label: 'Wavelength, λ = v/f', value: q(v / p.frequency!, 'm') }, { label: 'Period', value: formatDuration(1 / p.frequency!) }];
  },
  marks(p, t) {
    const [c] = this.parts(p) as [Sine];
    return crestMarks(c, this.domain(p), t, p.amplitude! * 1.25);
  },
  formulas: [
    { label: 'Speed on a stretched string', tex: String.raw`v = \sqrt{\frac{T}{\mu}}`, note: 'T is the tension, μ the mass of each metre of string. Neither the frequency nor the amplitude appears.' },
    { label: 'So the wavelength follows', tex: String.raw`\lambda = \frac{v}{f} = \frac{1}{f}\sqrt{\frac{T}{\mu}}` },
  ],
  medium: 'string',
  yUnit: 'm',
};

const superposition: Lesson = {
  id: 'superposition',
  title: 'Two waves add',
  description:
    'Two waves on the same string, same wavelength, same direction. The string simply does both at once. In step they build each other up; half a cycle apart they cancel. The faint lines are the two waves, the bright one is what the string does.',
  params: [
    { ...amplitude(0.2), id: 'first', label: 'Amplitude of the first' },
    { ...amplitude(0.2), id: 'second', label: 'Amplitude of the second' },
    { id: 'difference', label: 'Phase difference', unit: '°', min: 0, max: 360, step: 5, value: 60 },
    wavelength(2),
    frequency(1, 0.2, 5),
  ],
  domain: () => [0, 12],
  parts: (p) => [sine(p.first!, p.wavelength!, p.frequency!), sine(p.second!, p.wavelength!, p.frequency!, rad(p.difference!))],
  height: (p) => p.first! + p.second!,
  facts(p) {
    const sum = resultant(this.parts(p) as Sine[]);
    const d = ((p.difference! % 360) + 360) % 360;
    const kind = d === 0 ? 'constructive: in step' : d === 180 ? 'destructive: exactly out of step' : 'in between';
    return [
      { label: 'Amplitude of the sum', value: q(sum.amplitude, 'm') },
      { label: 'Its phase, ahead of the first', value: q((sum.phase * 180) / Math.PI, '°') },
      { label: 'Interference', value: kind },
      { label: 'Speed of each wave', value: q(p.frequency! * p.wavelength!, 'm/s') },
    ];
  },
  formulas: [
    { label: 'Principle of superposition', tex: String.raw`y = y_1 + y_2`, note: 'Displacements add, point by point. The waves pass through each other unchanged.' },
    { label: 'Two equal waves, φ apart', tex: String.raw`y = 2A\cos\frac{\varphi}{2}\;\sin\!\left(kx - \omega t + \frac{\varphi}{2}\right)` },
    { label: 'Unequal waves', tex: String.raw`A_R = \sqrt{A_1^2 + A_2^2 + 2A_1A_2\cos\varphi}` },
    { label: 'Build up, cancel', tex: String.raw`\varphi = 2n\pi:\ A_R = A_1 + A_2 \qquad \varphi = (2n+1)\pi:\ A_R = |A_1 - A_2|` },
  ],
  medium: 'string',
  yUnit: 'm',
  showParts: true,
};

const BEAT_SPEED = 340;
const beats: Lesson = {
  id: 'beats',
  title: 'Beats',
  description:
    'Two notes of nearly the same pitch. They drift in and out of step, so the sound swells and fades: these are beats, and a musician tunes by making them slow down and stop. Click a point to see what a listener there hears over time.',
  params: [frequency(20, 16, 40, 'first', 'Frequency of the first'), frequency(22, 16, 40, 'second', 'Frequency of the second'), amplitude(10, 'µm', 20)],
  domain: () => [0, 510],
  parts: (p) => [sine(p.amplitude!, BEAT_SPEED / p.first!, p.first!), sine(p.amplitude!, BEAT_SPEED / p.second!, p.second!)],
  height: (p) => 2 * p.amplitude!,
  facts: (p) => {
    const beat = Math.abs(p.first! - p.second!);
    return [
      { label: 'Beat frequency, |f₁ − f₂|', value: q(beat, 'Hz') },
      { label: 'Time between swells', value: beat > 0 ? formatDuration(1 / beat) : 'never: the notes agree' },
      { label: 'Pitch that is heard, (f₁ + f₂)/2', value: q((p.first! + p.second!) / 2, 'Hz') },
      { label: 'Speed of sound', value: q(BEAT_SPEED, 'm/s') },
    ];
  },
  formulas: [
    { label: 'At the listener', tex: String.raw`s = s_0\cos\omega_1 t + s_0\cos\omega_2 t` },
    { label: 'Which is', tex: String.raw`s = \Big[\,2s_0\cos\frac{(\omega_1 - \omega_2)\,t}{2}\Big]\cos\frac{(\omega_1 + \omega_2)\,t}{2}`, note: 'A note at the average frequency whose loudness rises and falls slowly: the bracket.' },
    { label: 'Beat frequency', tex: String.raw`f_\text{beat} = |f_1 - f_2|`, note: 'Loudness peaks twice in each cycle of the bracket, so the 2 in it cancels.' },
  ],
  medium: 'air',
  yUnit: 'µm',
  showParts: false,
};

const crossing: Lesson = {
  id: 'pulses-crossing',
  title: 'Two pulses cross',
  description:
    'Two pulses run towards each other on one string. Where they overlap their displacements add: two crests make a taller one, a crest and a trough flatten each other for an instant. Then each carries on as if the other had never been there.',
  params: [
    { id: 'first', label: 'Height of the first', unit: 'm', min: -0.5, max: 0.5, step: 0.01, value: 0.3, hardMin: -5, hardMax: 5 },
    { id: 'second', label: 'Height of the second', unit: 'm', min: -0.5, max: 0.5, step: 0.01, value: -0.3, hardMin: -5, hardMax: 5 },
    { id: 'width', label: 'Width', unit: 'm', min: 0.2, max: 1.5, step: 0.05, value: 0.6, hardMin: 0.05, hardMax: 5 },
    { id: 'speed', label: 'Speed', unit: 'm/s', min: 0.5, max: 5, step: 0.1, value: 2, hardMin: 0.05, hardMax: 100 },
  ],
  domain: () => [0, 12],
  parts: (p) => [pulse(p.first!, p.width!, 2, p.speed!, 1), pulse(p.second!, p.width!, 10, p.speed!, -1)],
  height: (p) => Math.max(Math.abs(p.first!), Math.abs(p.second!), Math.abs(p.first! + p.second!)),
  facts: (p) => [
    { label: 'They meet at', value: `${q(4 / p.speed!, 's')}, at x = 6.00 m` },
    { label: 'Height where they overlap', value: q(p.first! + p.second!, 'm') },
    { label: 'Afterwards', value: 'each keeps its own shape and speed' },
  ],
  formulas: [
    { label: 'Principle of superposition', tex: String.raw`y(x,t) = f(x - vt) + g(x + vt)`, note: 'Any shape moving right plus any shape moving left is a wave on the string.' },
    { label: 'A flat string that is not at rest', tex: String.raw`y = 0 \ \text{everywhere, but}\ \frac{\partial y}{\partial t} \neq 0`, note: 'When equal and opposite pulses overlap exactly the string is straight and moving: the energy is all kinetic for that instant.' },
  ],
  medium: 'string',
  yUnit: 'm',
  showParts: true,
  duration: (p) => 9 / p.speed!,
};

const STRING_END = 10;
const reflection = (free: boolean): Lesson => ({
  id: free ? 'reflection-free' : 'reflection-fixed',
  title: free ? 'Reflection at a free end' : 'Reflection at a fixed end',
  description: free
    ? 'The end of the string is a light ring free to slide on a rod. Nothing holds it down, so it overshoots to twice the height of the pulse, and that sends the pulse back the same way up.'
    : 'The end of the string is tied to a wall. The pulse pulls up on the wall, the wall pulls back down on the string, and the pulse returns upside down.',
  params: [
    { id: 'height', label: 'Height of the pulse', unit: 'm', min: 0.05, max: 0.5, step: 0.01, value: 0.3, hardMin: -5, hardMax: 5 },
    { id: 'width', label: 'Width', unit: 'm', min: 0.2, max: 1.5, step: 0.05, value: 0.6, hardMin: 0.05, hardMax: 3 },
    { id: 'speed', label: 'Speed', unit: 'm/s', min: 0.5, max: 5, step: 0.1, value: 2, hardMin: 0.05, hardMax: 100 },
  ],
  domain: () => [0, STRING_END],
  // The wall is replaced by a pulse coming the other way from behind it: its mirror image, upside down for a
  // fixed end so that the two always cancel at the wall, upright for a free end so that their slopes do.
  parts: (p) => [pulse(p.height!, p.width!, 3, p.speed!, 1), pulse(free ? p.height! : -p.height!, p.width!, 2 * STRING_END - 3, p.speed!, -1)],
  height: (p) => Math.abs(p.height!) * (free ? 2 : 1),
  facts: (p) => [
    { label: 'Reaches the end at', value: q((STRING_END - 3) / p.speed!, 's') },
    { label: 'Comes back', value: free ? 'the same way up' : 'upside down' },
    { label: 'Change of phase on reflection', value: free ? '0' : 'π (180°)' },
    { label: free ? 'Greatest height of the ring' : 'Displacement of the end', value: free ? q(2 * p.height!, 'm') : 'always 0' },
  ],
  marks: () => [{ kind: 'end', x: STRING_END, type: free ? 'free' : 'fixed' }],
  formulas: free
    ? [
        { label: 'Incident and reflected', tex: String.raw`y = f(x - vt) + f(2L - x - vt)`, note: 'The reflected pulse is the mirror image of the incoming one.' },
        { label: 'At a free end', tex: String.raw`\frac{\partial y}{\partial x}\bigg|_{x=L} = 0`, note: 'Nothing pulls the ring up or down, so the string meets the rod level. No change of phase.' },
      ]
    : [
        { label: 'Incident and reflected', tex: String.raw`y = f(x - vt) - f(2L - x - vt)`, note: 'The reflected pulse is the mirror image of the incoming one, turned over.' },
        { label: 'At a fixed end', tex: String.raw`y(L, t) = 0`, note: 'The end cannot move. The wall’s reaction (Newton’s third law) turns the pulse over: a phase change of π.' },
      ],
  medium: 'string',
  yUnit: 'm',
  showParts: false,
  duration: (p) => (2 * (STRING_END - 3) + 1) / p.speed!,
});

const standing: Lesson = {
  id: 'standing-wave',
  title: 'Standing waves on a string',
  description:
    'A string held at both ends, like a guitar’s. A wave and its reflection run through each other and the pattern stands still: nodes that never move, antinodes that swing the most. Only whole numbers of half-wavelengths fit, which is why a string has notes.',
  params: [
    { id: 'harmonic', label: 'Harmonic', unit: '', min: 1, max: 8, step: 1, value: 3, hardMin: 1, hardMax: 30 },
    { id: 'length', label: 'Length of the string', unit: 'm', min: 0.3, max: 3, step: 0.01, value: 1.2, hardMin: 0.05, hardMax: 100 },
    { id: 'tension', label: 'Tension', unit: 'N', min: 10, max: 200, step: 1, value: 80, hardMin: 0.1, hardMax: 1e5 },
    { id: 'density', label: 'Mass per metre', unit: 'kg/m', min: 0.001, max: 0.02, step: 0.0005, value: 0.005, hardMin: 1e-5, hardMax: 10 },
    { ...amplitude(1, 'cm', 2), label: 'Swing at an antinode' },
  ],
  domain: (p) => [0, p.length!],
  parts(p) {
    const n = Math.max(1, Math.round(p.harmonic!));
    const lambda = (2 * p.length!) / n;
    const f = Math.sqrt(p.tension! / p.density!) / lambda;
    return [sine(p.amplitude! / 2, lambda, f, 0, 1), sine(p.amplitude! / 2, lambda, f, 0, -1)];
  },
  height: (p) => p.amplitude!,
  facts: (p) => {
    const n = Math.max(1, Math.round(p.harmonic!));
    const v = Math.sqrt(p.tension! / p.density!);
    return [
      { label: 'Speed of waves on it, √(T/μ)', value: q(v, 'm/s') },
      { label: 'Wavelength, 2L/n', value: q((2 * p.length!) / n, 'm') },
      { label: `Frequency of harmonic ${n}`, value: q((n * v) / (2 * p.length!), 'Hz') },
      { label: 'Fundamental, v/2L', value: q(v / (2 * p.length!), 'Hz') },
      { label: 'Nodes, antinodes', value: `${n + 1}, ${n}` },
    ];
  },
  marks(p) {
    const n = Math.max(1, Math.round(p.harmonic!));
    return [...stationaryMarks((2 * p.length!) / n, 0, this.domain(p)), { kind: 'end', x: 0, type: 'fixed' }, { kind: 'end', x: p.length!, type: 'fixed' }];
  },
  formulas: [
    { label: 'A wave and its reflection', tex: String.raw`y = A\sin(kx - \omega t) + A\sin(kx + \omega t) = 2A\,\sin kx\,\cos\omega t`, note: 'Every point swings in time with the rest; how far depends on where it is.' },
    { label: 'Nodes and antinodes', tex: String.raw`\text{nodes: } x = \frac{n\lambda}{2} \qquad \text{antinodes: } x = \Big(n + \tfrac12\Big)\frac{\lambda}{2}`, note: 'Neighbouring nodes are half a wavelength apart.' },
    { label: 'What fits between fixed ends', tex: String.raw`L = \frac{n\lambda}{2} \quad\Longrightarrow\quad f_n = \frac{n\,v}{2L} = \frac{n}{2L}\sqrt{\frac{T}{\mu}}`, note: 'n = 1 is the fundamental; all harmonics are present.' },
  ],
  medium: 'string',
  yUnit: 'cm',
  showParts: false,
};

const SOUND = 340;
const pipe = (closed: boolean): Lesson => {
  const wavelengthOf = (p: Values) => {
    const m = Math.max(1, Math.round(p.mode!));
    return closed ? (4 * p.length!) / (2 * m - 1) : (2 * p.length!) / m;
  };
  // A closed end cannot move, so it is a node of displacement; an open end is free, an antinode.
  const shift = closed ? 0 : Math.PI / 2;
  return {
    id: closed ? 'closed-pipe' : 'open-pipe',
    title: closed ? 'Air column closed at one end' : 'Air column open at both ends',
    description: closed
      ? 'A pipe closed at one end, like a bottle you blow across. The air cannot move at the closed end and moves most at the open one, so a quarter of a wavelength fits, or three quarters, or five: only the odd harmonics sound.'
      : 'A pipe open at both ends, like a flute. The air moves most at each open end, so a half wavelength fits, or two halves, or three: every harmonic sounds.',
    params: [
      { id: 'mode', label: closed ? 'Mode (1st, 2nd, 3rd…)' : 'Harmonic', unit: '', min: 1, max: 6, step: 1, value: closed ? 2 : 2, hardMin: 1, hardMax: 20 },
      { id: 'length', label: 'Length of the pipe', unit: 'm', min: 0.1, max: 2, step: 0.01, value: 0.5, hardMin: 0.01, hardMax: 50 },
      { ...amplitude(10, 'µm', 20), label: 'Swing at an antinode' },
    ],
    domain: (p) => [0, p.length!],
    parts: (p) => [sine(p.amplitude! / 2, wavelengthOf(p), SOUND / wavelengthOf(p), shift, 1), sine(p.amplitude! / 2, wavelengthOf(p), SOUND / wavelengthOf(p), shift, -1)],
    height: (p) => p.amplitude!,
    facts: (p) => {
      const m = Math.max(1, Math.round(p.mode!));
      const fundamental = SOUND / ((closed ? 4 : 2) * p.length!);
      return [
        { label: closed ? 'Wavelength, 4L/(2n − 1)' : 'Wavelength, 2L/n', value: q(wavelengthOf(p), 'm') },
        { label: 'Frequency of this mode', value: q(SOUND / wavelengthOf(p), 'Hz') },
        { label: closed ? 'Fundamental, v/4L' : 'Fundamental, v/2L', value: q(fundamental, 'Hz') },
        { label: 'Which harmonic this is', value: closed ? `${2 * m - 1} (odd ones only)` : `${m}` },
        { label: 'Speed of sound', value: q(SOUND, 'm/s') },
      ];
    },
    marks(p) {
      return [...stationaryMarks(wavelengthOf(p), shift, this.domain(p)), { kind: 'end', x: 0, type: closed ? 'closed' : 'open' }, { kind: 'end', x: p.length!, type: 'open' }];
    },
    formulas: closed
      ? [
          { label: 'Displacement of the air', tex: String.raw`s = 2s_0\,\sin kx\,\cos\omega t`, note: 'A node at the closed end, x = 0; an antinode at the open end.' },
          { label: 'What fits', tex: String.raw`L = (2n - 1)\frac{\lambda}{4} \quad\Longrightarrow\quad f = (2n - 1)\,\frac{v}{4L}`, note: 'Frequencies in the ratio 1 : 3 : 5… The even harmonics are missing.' },
          { label: 'Pressure', tex: String.raw`\text{pressure antinode} \leftrightarrow \text{displacement node}`, note: 'The pressure changes most at the closed end, where the air cannot get out of the way.' },
        ]
      : [
          { label: 'Displacement of the air', tex: String.raw`s = 2s_0\,\cos kx\,\cos\omega t`, note: 'An antinode at each open end.' },
          { label: 'What fits', tex: String.raw`L = \frac{n\lambda}{2} \quad\Longrightarrow\quad f_n = \frac{n\,v}{2L}`, note: 'Frequencies in the ratio 1 : 2 : 3… An open pipe sounds an octave above a closed one of the same length.' },
        ],
    medium: 'air',
    yUnit: 'µm',
    showParts: false,
  };
};

// ---------------------------------------------------------------- class 12: electromagnetic waves

export const LIGHT_CHAPTER = 'Class 12 · Electromagnetic waves';
/** Speed of light in vacuum, m/s, and the two constants it is made of. */
const C = 299_792_458;
const MU_0 = 4e-7 * Math.PI;
const EPSILON_0 = 1 / (MU_0 * C * C);
const prefixed = formatPrefixed;

const fieldAmplitude: Param = { id: 'amplitude', label: 'Electric field at the crest, E₀', unit: 'V/m', min: 10, max: 300, step: 5, value: 120, hardMin: 0, hardMax: 1e6 };
const megahertz: Param = { id: 'frequency', label: 'Frequency', unit: 'MHz', min: 50, max: 300, step: 5, value: 100, hardMin: 1, hardMax: 3000 };
const MEDIA = [
  { label: 'empty space', value: 1 },
  { label: 'water', value: 1.33 },
  { label: 'glass', value: 1.5 },
];

const lightFacts = (amplitude: number, frequency: number, index: number): Fact[] => {
  const speed = C / index;
  // In a transparent medium ε is n² times ε₀, so the same E₀ carries n times the energy across each square metre.
  const intensity = 0.5 * EPSILON_0 * index * C * amplitude * amplitude;
  return [
    { label: index === 1 ? 'Speed, c = 1/√(μ₀ε₀)' : 'Speed, v = c/n', value: q(speed, 'm/s') },
    { label: 'Wavelength, λ = v/f', value: prefixed(speed / frequency, 'm') },
    { label: 'Magnetic field at the crest, B₀ = E₀/v', value: prefixed(amplitude / speed, 'T') },
    { label: 'Intensity, ½ε v E₀²', value: prefixed(intensity, 'W/m²') },
    { label: 'Pressure on a surface that absorbs it, I/v', value: prefixed(intensity / speed, 'Pa') },
  ];
};

const lightWave: Lesson = {
  id: 'electromagnetic-wave',
  chapter: LIGHT_CHAPTER,
  title: 'An electromagnetic wave',
  description:
    'A changing electric field makes a magnetic field, and a changing magnetic field makes an electric one: the pair keeps itself going and travels. The two are at right angles to each other and to the way the wave goes, and they rise and fall together.',
  params: [megahertz, fieldAmplitude, { id: 'index', label: 'Travelling through', unit: '', min: 1, max: 1.5, step: 0.01, value: 1, options: MEDIA }],
  domain: () => [0, 12],
  parts: (p) => [sine(p.amplitude!, C / p.index! / (p.frequency! * 1e6), p.frequency! * 1e6)],
  height: (p) => p.amplitude!,
  facts: (p) => lightFacts(p.amplitude!, p.frequency! * 1e6, p.index!),
  marks(p, t) {
    const [c] = this.parts(p) as [Sine];
    return [...crestMarks(c, this.domain(p), t, p.amplitude! * 1.25, 'E₀'), { kind: 'heading', direction: 1, label: p.index === 1 ? 'c' : 'v = c/n' }];
  },
  formulas: [
    { label: 'The two fields', tex: String.raw`E_y = E_0 \sin(kx - \omega t), \qquad B_z = B_0 \sin(kx - \omega t)`, note: 'In step, at right angles to each other and to x. E × B points the way the wave travels.' },
    { label: 'How big each is', tex: String.raw`\frac{E_0}{B_0} = c`, note: 'In volts per metre and teslas the magnetic field looks tiny; the two carry equal energy.' },
    { label: 'Speed', tex: String.raw`c = \frac{1}{\sqrt{\mu_0 \varepsilon_0}} = 3.00 \times 10^{8}\ \text{m/s}, \qquad v = \frac{1}{\sqrt{\mu \varepsilon}} = \frac{c}{n}`, note: 'Two constants measured with coils and capacitors give the speed of light. That is how Maxwell knew what light is.' },
    { label: 'Energy', tex: String.raw`u = \tfrac12 \varepsilon_0 E^2 + \frac{B^2}{2\mu_0}, \qquad I = \tfrac12\, \varepsilon_0\, c\, E_0^2, \qquad p = \frac{U}{c}`, note: 'The wave carries energy and momentum, so it pushes on what it hits.' },
  ],
  medium: 'light',
  yUnit: 'V/m',
  lightSpeed: (p) => C / p.index!,
};

const lightStanding: Lesson = {
  id: 'electromagnetic-standing-wave',
  chapter: LIGHT_CHAPTER,
  title: 'Radio waves off a metal sheet',
  description:
    'A metal sheet sends the wave straight back, and the two make a standing wave. Hertz found the nodes with a small loop of wire, measured the wavelength, and from it the speed. The electric field must vanish at the metal; the magnetic field is greatest there.',
  params: [megahertz, fieldAmplitude],
  domain: () => [0, 12],
  // Reflection turns the electric field over, so the two cancel at the sheet at x = 12 m.
  parts: (p) => {
    const lambda = C / (p.frequency! * 1e6);
    const phase = (-TAU * 12) / lambda;
    return [sine(p.amplitude!, lambda, p.frequency! * 1e6, phase, 1), sine(p.amplitude!, lambda, p.frequency! * 1e6, phase + Math.PI, -1)];
  },
  height: (p) => 2 * p.amplitude!,
  facts: (p) => {
    const lambda = C / (p.frequency! * 1e6);
    return [
      { label: 'Wavelength, λ = c/f', value: q(lambda, 'm') },
      { label: 'From one node to the next, λ/2', value: q(lambda / 2, 'm') },
      { label: 'Speed found from them, f × 2 × (node to node)', value: q(C, 'm/s') },
      { label: 'Electric field at an antinode, 2E₀', value: q(2 * p.amplitude!, 'V/m') },
      { label: 'Magnetic field at the sheet, 2E₀/c', value: prefixed((2 * p.amplitude!) / C, 'T') },
    ];
  },
  marks(p) {
    const lambda = C / (p.frequency! * 1e6);
    return [...stationaryMarks(lambda, (-TAU * 12) / lambda, this.domain(p)), { kind: 'end', x: 12, type: 'fixed' }];
  },
  formulas: [
    { label: 'Electric field', tex: String.raw`E_y = 2E_0\, \sin k(x - L)\, \cos \omega t`, note: 'Zero at the metal, x = L, and every half wavelength back from it.' },
    { label: 'Magnetic field', tex: String.raw`B_z = -\frac{2E_0}{c}\, \cos k(x - L)\, \sin \omega t`, note: 'Greatest where the electric field is zero, and a quarter of a period later. In a standing wave the two are out of step in place and in time.' },
    { label: 'What Hertz measured', tex: String.raw`c = f\lambda = f \times 2\,(\text{node to node})` },
  ],
  medium: 'light',
  yUnit: 'V/m',
  showParts: false,
  lightSpeed: () => C,
};

/** The spectrum, from long radio waves to gamma rays: where each band starts, in hertz, and what it is. */
const BANDS: { from: number; name: string; made: string; used: string }[] = [
  { from: 0, name: 'Radio waves', made: 'charges driven up and down an aerial', used: 'radio and television, mobile phones' },
  { from: 1e9, name: 'Microwaves', made: 'klystrons and magnetrons', used: 'radar, ovens, satellite links' },
  { from: 3e11, name: 'Infrared', made: 'warm bodies; molecules vibrating', used: 'heaters, remote controls, night vision' },
  { from: 4e14, name: 'Visible light', made: 'electrons changing level in atoms', used: 'seeing: red at this end, violet at the other' },
  { from: 7.7e14, name: 'Ultraviolet', made: 'very hot bodies, the Sun, special lamps', used: 'killing germs; absorbed by the ozone layer' },
  { from: 3e16, name: 'X-rays', made: 'fast electrons stopped by a metal target', used: 'pictures of bones, studying crystals' },
  { from: 3e19, name: 'Gamma rays', made: 'nuclei, in radioactive decay', used: 'treating tumours' },
];
const bandOf = (frequency: number) => [...BANDS].reverse().find((b) => frequency >= b.from)!;
const PLANCK_EV = 4.135_667_696e-15;
/** The wavelength in the unit that suits it: 589 for sodium light, to go with an axis in nm. */
const shownWavelength = (p: Values) => {
  const lambda = C / 10 ** p.power!;
  return lambda / prefixFor(lambda)[0];
};

const spectrum: Lesson = {
  id: 'electromagnetic-spectrum',
  chapter: LIGHT_CHAPTER,
  title: 'The electromagnetic spectrum',
  description:
    'Radio waves, light and X-rays are the same thing at different frequencies, all travelling at c in empty space. Slide the frequency up through twenty powers of ten and watch the wavelength shrink from kilometres to less than an atom.',
  params: [{ id: 'power', label: 'Frequency, as a power of ten: 10ˣ Hz', unit: '', min: 4, max: 22, step: 0.05, value: 14.7 }],
  // Six wavelengths, whatever their size: it is the unit on the axis that changes.
  domain: (p) => [0, 6 * shownWavelength(p)],
  parts: (p) => [sine(1, shownWavelength(p), 10 ** p.power!)],
  height: () => 1,
  facts: (p) => {
    const frequency = 10 ** p.power!;
    const band = bandOf(frequency);
    return [
      { label: 'Band', value: band.name },
      { label: 'Frequency', value: frequency >= 1e15 ? `${formatNumber(frequency)} Hz` : prefixed(frequency, 'Hz') },
      { label: 'Wavelength, λ = c/f', value: prefixed(C / frequency, 'm') },
      { label: 'Energy of one photon, hf', value: prefixed(PLANCK_EV * frequency, 'eV') },
      { label: 'Made by', value: band.made },
      { label: 'Used for', value: band.used },
    ];
  },
  marks: (p) => [{ kind: 'spectrum', power: p.power!, bands: BANDS }],
  formulas: [
    { label: 'One speed for all of it', tex: String.raw`c = f\lambda`, note: 'In empty space every band travels at c, so a higher frequency always means a shorter wavelength.' },
    { label: 'The bands, by wavelength', tex: String.raw`\underset{>\,0.1\ \text{m}}{\text{radio}} \;\; \underset{1\ \text{mm}}{\text{microwave}} \;\; \underset{700\ \text{nm}}{\text{infrared}} \;\; \underset{400\ \text{nm}}{\text{visible}} \;\; \underset{1\ \text{nm}}{\text{ultraviolet}} \;\; \underset{10^{-3}\ \text{nm}}{\text{X-rays}} \;\; \gamma`, note: 'The edges are conventions, and neighbouring bands overlap.' },
  ],
  medium: 'light',
  yUnit: '',
  xUnit: (p) => `${prefixFor(C / 10 ** p.power!)[1]}m`,
  lightSpeed: () => C,
};
const displacementCurrent: Lesson = {
  id: 'displacement-current',
  chapter: LIGHT_CHAPTER,
  title: 'Displacement current',
  description:
    'While a capacitor charges, current flows in the wires but no charge crosses the gap. What there is in the gap is an electric field that is growing, and Maxwell saw that it must count as a current too: it makes the same magnetic field, and it is exactly as large as the current in the wires.',
  params: [
    { id: 'voltage', label: 'Battery', unit: 'V', min: 1, max: 24, step: 0.5, value: 12, hardMin: 0.1, hardMax: 1000 },
    { id: 'resistance', label: 'Resistance', unit: 'MΩ', min: 0.1, max: 5, step: 0.1, value: 1, hardMin: 0.001, hardMax: 100 },
    { id: 'radius', label: 'Radius of the plates', unit: 'cm', min: 2, max: 20, step: 0.5, value: 10, hardMin: 0.5, hardMax: 100 },
    { id: 'gap', label: 'Gap between the plates', unit: 'mm', min: 0.5, max: 5, step: 0.1, value: 1, hardMin: 0.05, hardMax: 50 },
  ],
  domain: () => [0, 1],
  parts: () => [],
  height: () => 1,
  facts: () => [],
  formulas: [
    { label: 'Charging through a resistance', tex: String.raw`q = CV\left(1 - e^{-t/RC}\right), \qquad i_c = \frac{dq}{dt} = \frac{V}{R}\, e^{-t/RC}` },
    { label: 'Displacement current', tex: String.raw`i_d = \varepsilon_0\, \frac{d\Phi_E}{dt} = \varepsilon_0 A\, \frac{dE}{dt} = \frac{dq}{dt} = i_c`, note: 'Between the plates E = q/ε₀A, so the growing field is worth exactly the current that feeds it.' },
    { label: 'The law, completed', tex: String.raw`\oint \vec B \cdot d\vec l = \mu_0 \left( i_c + \varepsilon_0\, \frac{d\Phi_E}{dt} \right)`, note: 'Ampère’s law with Maxwell’s term. Without it the law gives two answers for the same loop.' },
    { label: 'Magnetic field round the gap', tex: String.raw`B = \frac{\mu_0\, i_d}{2\pi R}\ \text{at the rim}, \qquad B = \frac{\mu_0\, i_d\, r}{2\pi R^2}\ \text{inside}` },
  ],
  medium: 'light',
  yUnit: 'μA',
  build: (p, startAt) => new CapacitorScene({ voltage: p.voltage!, resistance: p.resistance! * 1e6, radius: p.radius! * 0.01, gap: p.gap! * 0.001 }, displacementCurrent, startAt),
};

// ---------------------------------------------------------------- class 12: wave optics

export const WAVE_OPTICS = 'Class 12 · Wave optics';

const lightColour: Param = { id: 'wavelength', label: 'Wavelength of the light', unit: 'nm', min: 400, max: 700, step: 5, value: 590 };
const toScreen: Param = { id: 'distance', label: 'Distance to the screen', unit: 'm', min: 0.5, max: 3, step: 0.1, value: 1.5 };
const sinc = (u: number) => (Math.abs(u) < 1e-9 ? 1 : Math.sin(u) / u);
const css = (nm: number) => `rgb(${colourOf(nm).join(' ')})`;
/** Points across a screen from −half to +half, in millimetres. */
const across = (half: number) => Float64Array.from({ length: 1201 }, (_, i) => -half + (2 * half * i) / 1200);

/** A lesson that is a steady pattern and not a wave along a line: the wave fields are filled in for form's sake. */
const pattern = (make: (p: Values) => Pattern) => ({
  domain: (): [number, number] => [0, 1],
  parts: (): Component[] => [],
  height: () => 1,
  facts: (): Fact[] => [],
  medium: 'light' as const,
  yUnit: '',
  build(this: Lesson, p: Values) {
    return new PatternScene(this, make(p));
  },
});

const doubleSlit: Lesson = {
  id: 'youngs-double-slit',
  chapter: WAVE_OPTICS,
  title: 'Young’s double slit',
  description:
    'Light from two narrow slits falls on a screen. Where the two paths differ by a whole number of wavelengths the waves arrive in step and the screen is bright; where they differ by a half, they cancel and it is dark. The even stripes are how the wavelength of light was first measured.',
  params: [
    lightColour,
    { id: 'separation', label: 'Distance between the slits', unit: 'mm', min: 0.1, max: 1, step: 0.01, value: 0.25 },
    toScreen,
    { id: 'width', label: 'Width of each slit', unit: 'mm', min: 0.01, max: 0.2, step: 0.005, value: 0.04 },
  ],
  formulas: [
    { label: 'Path difference at a point y from the centre', tex: String.raw`\Delta = \frac{y\,d}{D}`, note: 'For a screen far away compared with the distance between the slits.' },
    { label: 'Bright and dark', tex: String.raw`\Delta = n\lambda \ \text{(bright)}, \qquad \Delta = \left(n + \tfrac12\right)\lambda \ \text{(dark)}` },
    { label: 'Fringe width', tex: String.raw`\beta = \frac{\lambda D}{d}`, note: 'The same from one fringe to the next. Redder light, a more distant screen or closer slits all widen them.' },
    { label: 'Brightness', tex: String.raw`I = 4I_0 \cos^2\frac{\varphi}{2}, \qquad \varphi = \frac{2\pi}{\lambda}\,\Delta`, note: 'Four times one slit’s light at a bright fringe, none at a dark one: the energy is moved, not lost.' },
  ],
  ...pattern((p) => {
    const lambda = p.wavelength! * 1e-9;
    const [d, big, a] = [p.separation! * 1e-3, p.distance!, p.width! * 1e-3];
    const fringe = (lambda * big) / d;
    // Wide enough for a dozen fringes, in millimetres.
    const half = 6.2 * fringe * 1e3;
    const x = across(half);
    const single = x.map((mm) => sinc((Math.PI * a * mm * 1e-3) / (lambda * big)) ** 2);
    const intensity = x.map((mm, i) => Math.cos((Math.PI * d * mm * 1e-3) / (lambda * big)) ** 2 * single[i]!);
    const beta = fringe * 1e3;
    return {
      x,
      xUnit: 'mm',
      xLabel: 'position on the screen',
      intensity,
      envelope: single,
      facts: [
        { label: 'Fringe width, λD/d', value: q(beta, 'mm') },
        { label: 'Angle between neighbouring fringes, λ/d', value: `${formatNumber((lambda / d) * 1e3)} mrad` },
        { label: 'Third bright fringe from the centre', value: q(3 * beta, 'mm') },
        { label: 'First dark fringe', value: q(0.5 * beta, 'mm') },
        { label: 'Fringes inside the central hump of one slit, 2d/a', value: formatNumber((2 * d) / a) },
      ],
      marks: [{ kind: 'span', from: 0, to: beta, at: 1.05, label: `β = ${q(beta, 'mm')}` }],
      picture: { kind: 'fringes', values: intensity, color: css(p.wavelength!) },
      read: (mm) => {
        const path = (mm * 1e-3 * d) / big;
        const waves = path / lambda;
        const off = Math.abs(waves - Math.round(waves));
        return [
          { label: 'Path difference', value: `${q(path * 1e9, 'nm')} = ${formatNumber(waves)} λ` },
          { label: 'Phase difference', value: `${formatNumber((((waves % 1) + 1) % 1) * 360)}°` },
          { label: 'The two waves here', value: off < 0.08 ? 'arrive in step: bright' : off > 0.42 ? 'arrive out of step: dark' : 'partly cancel' },
        ];
      },
    };
  }),
};

const singleSlit: Lesson = {
  id: 'single-slit-diffraction',
  chapter: WAVE_OPTICS,
  title: 'Diffraction at a single slit',
  description:
    'Light through one narrow slit does not make a sharp shadow. It spreads into a broad bright band with fainter bands either side. Make the slit narrower and the light spreads more, not less: this is where the idea of a ray stops working.',
  params: [lightColour, { id: 'width', label: 'Width of the slit', unit: 'mm', min: 0.02, max: 0.5, step: 0.005, value: 0.1 }, toScreen],
  formulas: [
    { label: 'Dark bands', tex: String.raw`a\sin\theta = n\lambda, \qquad n = \pm1, \pm2, \dots`, note: 'Each half of the slit then cancels the other half, strip for strip.' },
    { label: 'Width of the central band on the screen', tex: String.raw`\frac{2\lambda D}{a}`, note: 'Twice as wide as the others.' },
    { label: 'Brightness', tex: String.raw`I = I_0 \left(\frac{\sin\alpha}{\alpha}\right)^2, \qquad \alpha = \frac{\pi a \sin\theta}{\lambda}`, note: 'The first side band is under a twentieth as bright as the middle.' },
    { label: 'How far a beam stays a beam', tex: String.raw`z_F = \frac{a^2}{\lambda}`, note: 'The Fresnel distance. Much nearer than this, ray optics is good enough.' },
  ],
  ...pattern((p) => {
    const lambda = p.wavelength! * 1e-9;
    const [a, big] = [p.width! * 1e-3, p.distance!];
    const first = ((lambda * big) / a) * 1e3;
    const x = across(4.2 * first);
    const intensity = x.map((mm) => sinc((Math.PI * a * mm * 1e-3) / (lambda * big)) ** 2);
    return {
      x,
      xUnit: 'mm',
      xLabel: 'position on the screen',
      intensity,
      facts: [
        { label: 'First dark band, λD/a from the centre', value: q(first, 'mm') },
        { label: 'Width of the central bright band, 2λD/a', value: q(2 * first, 'mm') },
        { label: 'Angle to the first dark band, λ/a', value: `${formatNumber((lambda / a) * 1e3)} mrad` },
        { label: 'Brightness of the first side band', value: '4.7 % of the middle' },
        { label: 'Fresnel distance, a²/λ', value: q((a * a) / lambda, 'm') },
      ],
      marks: [{ kind: 'span', from: -first, to: first, at: 1.05, label: `2λD/a = ${q(2 * first, 'mm')}` }],
      picture: { kind: 'fringes', values: intensity, color: css(p.wavelength!) },
      read: (mm) => {
        const alpha = (Math.PI * a * mm * 1e-3) / (lambda * big);
        return [
          { label: 'Brightness here', value: `${formatNumber(100 * sinc(alpha) ** 2)} % of the middle` },
          { label: 'Path difference between the two edges of the slit', value: `${formatNumber(alpha / Math.PI)} λ` },
        ];
      },
    };
  }),
};

const malus: Lesson = {
  id: 'malus-law',
  chapter: WAVE_OPTICS,
  title: 'Polarisation and Malus’s law',
  description:
    'Ordinary light vibrates in every direction across its path. A polaroid lets through only the part along its own axis, half of the light. A second polaroid then passes all of that, some of it or none, depending on the angle between the two. That light can be blocked this way shows it is a transverse wave.',
  params: [{ id: 'angle', label: 'Angle between the two polaroids', unit: '°', min: 0, max: 180, step: 1, value: 40 }],
  formulas: [
    { label: 'Through the first polaroid', tex: String.raw`I_1 = \tfrac12 I_0`, note: 'Unpolarised light has no favoured direction, so half gets through whichever way the polaroid is turned.' },
    { label: 'Malus’s law, through the second', tex: String.raw`I_2 = I_1 \cos^2\theta`, note: 'Only the part of the vibration along the second axis passes, and brightness goes as its square.' },
    { label: 'Crossed', tex: String.raw`\theta = 90^\circ \ \Longrightarrow\ I_2 = 0` },
  ],
  ...pattern((p) => {
    const x = Float64Array.from({ length: 721 }, (_, i) => i / 4);
    const intensity = x.map((degrees) => 0.5 * Math.cos((degrees * Math.PI) / 180) ** 2);
    const through = 0.5 * Math.cos((p.angle! * Math.PI) / 180) ** 2;
    return {
      x,
      xUnit: '°',
      xLabel: 'angle between the polaroids',
      intensity,
      yUnit: 'of the light arriving',
      top: 0.62,
      facts: [
        { label: 'After the first polaroid, I₀/2', value: '50 % of the light' },
        { label: 'After the second, ½ I₀ cos²θ', value: `${formatNumber(100 * through)} % of the light` },
        { label: 'Share of the first polaroid’s light that the second passes, cos²θ', value: `${formatNumber(200 * through)} %` },
        { label: 'Angle at which half of that gets through', value: '45°' },
      ],
      marks: [{ kind: 'now', x: p.angle! }],
      picture: { kind: 'polaroids', angle: p.angle!, afterFirst: 0.5, afterSecond: through },
      read: (degrees) => [
        { label: 'Light getting through both', value: `${formatNumber(50 * Math.cos((degrees * Math.PI) / 180) ** 2)} % of what arrived` },
        { label: 'cos²θ', value: formatNumber(Math.cos((degrees * Math.PI) / 180) ** 2) },
      ],
    };
  }),
};

export const lessons: Lesson[] = [travelling, longitudinal, onString, superposition, crossing, reflection(false), reflection(true), standing, pipe(true), pipe(false), beats, displacementCurrent, lightWave, lightStanding, spectrum, doubleSlit, singleSlit, malus];

export const findLesson = (id: string | null) => lessons.find((lesson) => lesson.id === id);

export const defaults = (lesson: Lesson): Values => Object.fromEntries(lesson.params.map((p) => [p.id, p.value]));
