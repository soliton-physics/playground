/**
 * The formulas behind each wave preset, in LaTeX. They are long, and nobody carries them in their head: the
 * playground keeps them beside the wave they describe. Conventions match the engine exactly, so the numbers on
 * screen can be checked against them.
 */
export interface Formula {
  /** What the formula is, in a few words. */
  label: string;
  tex: string;
  /** One line on how to read it, if it needs one. */
  note?: string;
}

const KDV: Formula[] = [
  { label: 'The equation', tex: 'u_t + 6\\,u\\,u_x + u_{xxx} = 0', note: 'Steepening (the middle term) against spreading (the last).' },
  {
    label: 'A soliton of speed c',
    tex: 'u(x,t) = \\frac{c}{2}\\,\\operatorname{sech}^2\\!\\left[\\frac{\\sqrt{c}}{2}\\,(x - c\\,t - x_0)\\right]',
    note: 'One number sets everything: height c/2, speed c, width about 2/√c. Taller is faster and narrower.',
  },
];

const KDV_CONSERVED: Formula[] = [
  { label: 'Mass', tex: 'M = \\int u\\,dx' },
  { label: 'Momentum', tex: 'P = \\int u^2\\,dx' },
  { label: 'Energy', tex: 'E = \\int \\left(u^3 - \\tfrac12\\,u_x^2\\right) dx' },
];

const NLS: Formula[] = [
  { label: 'The equation', tex: 'i\\,\\psi_t + \\tfrac12\\,\\psi_{xx} + |\\psi|^2\\,\\psi = 0', note: 'Spreading (the middle term) against self-focusing (the last).' },
  {
    label: 'A bright soliton',
    tex: '\\psi = a\\,\\operatorname{sech}\\!\\big[a\\,(x - v\\,t - x_0)\\big]\\; e^{\\,i\\left[v\\,x + \\frac12 (a^2 - v^2)\\,t\\right]}',
    note: 'Height a, width 1/a, speed v. Unlike KdV, the speed is free: it does not depend on the height.',
  },
];

const NLS_CONSERVED: Formula[] = [
  { label: 'Mass', tex: 'M = \\int |\\psi|^2\\,dx' },
  { label: 'Momentum', tex: 'P = \\int \\operatorname{Im}\\!\\left(\\psi^{*}\\,\\psi_x\\right) dx' },
  { label: 'Energy', tex: 'E = \\int \\left(\\tfrac12\\,|\\psi_x|^2 - \\tfrac12\\,|\\psi|^4\\right) dx' },
];

/** What is particular to one preset: the numbers in it, and the result it is there to show. */
const EXTRA: Record<string, Formula[]> = {
  'kdv-soliton': [{ label: 'This one', tex: 'c = 4:\\quad \\text{height } 2,\\ \\text{speed } 4' }],
  'kdv-collision': [
    { label: 'These two', tex: 'c_1 = 6,\\quad c_2 = 1.5' },
    {
      label: 'What the collision leaves behind',
      tex: '\\Delta x_{\\text{fast}} = +\\frac{2}{\\sqrt{c_1}}\\,\\ln\\frac{\\sqrt{c_1} + \\sqrt{c_2}}{\\sqrt{c_1} - \\sqrt{c_2}}',
      note: 'The fast one ends up ahead of where it would have been. The slow one is set back by the same expression with √c₂ in front. Nothing else changes.',
    },
  ],
  'kdv-fission': [
    { label: 'This start', tex: 'u(x,0) = 3\\,e^{-(x+25)^2/16}', note: 'Not a soliton, so it cannot stay as it is.' },
    {
      label: 'A start that splits exactly',
      tex: 'u(x,0) = N(N+1)\\,\\operatorname{sech}^2 x',
      note: 'This one becomes exactly N solitons, of heights 2, 8, 18, … 2N², and nothing else. Any other hump gives a train of solitons, tallest first, and a little ripple left behind.',
    },
  ],
  'nls-soliton': [{ label: 'This one', tex: 'a = 1,\\quad v = 1' }],
  'nls-collision': [
    { label: 'These two', tex: '(a, v) = (1,\\ 1) \\ \\text{and}\\ (0.8,\\ -0.5)' },
    { label: 'Where they overlap', tex: '|\\psi_1 + \\psi_2|^2 \\neq |\\psi_1|^2 + |\\psi_2|^2', note: 'They interfere, which is the ripple you see as they cross. Each leaves with its own a and v; only positions and phases are shifted.' },
  ],
  'nls-breather': [
    { label: 'This start', tex: '\\psi(x,0) = 2\\,\\operatorname{sech} x', note: 'Twice a soliton: two solitons bound at one place.' },
    {
      label: 'What it does',
      tex: '\\psi = 4\\,e^{\\,i t/2}\\; \\frac{\\cosh 3x + 3\\,e^{\\,4 i t}\\cosh x}{\\cosh 4x + 4\\cosh 2x + 3\\cos 4t}',
      note: 'The shape repeats every π/2. In general N sech x is N solitons bound together.',
    },
  ],
};

export interface FormulaGroup {
  title: string;
  formulas: Formula[];
}

export function formulasFor(preset: { id: string; model: 'kdv' | 'nls' }): FormulaGroup[] {
  const kdv = preset.model === 'kdv';
  return [
    { title: kdv ? 'Korteweg–de Vries' : 'Nonlinear Schrödinger', formulas: kdv ? KDV : NLS },
    { title: 'In this scene', formulas: EXTRA[preset.id] ?? [] },
    { title: 'What stays constant', formulas: kdv ? KDV_CONSERVED : NLS_CONSERVED },
  ].filter((group) => group.formulas.length > 0);
}
