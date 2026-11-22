import { iconButton, popover, slider, toast, toggleButton, type Slider } from '../controls';
import { Matrix } from '../engine';
import type { Shell } from '../shell';
import { el, formatNumber, layoutPx } from '../ui';
import { HOME } from './plane';
import { roomTabs } from './rooms';
import { PlaneStage, SpaceStage, type Show } from './stage';
import { tex } from './tex';

interface Step {
  words: string;
  latex: string | null;
}

interface Facts {
  latex: string;
  transpose: string;
  determinant: { latex: string; steps: Step[] } | null;
  determinant_value: number | null;
  inverse: { latex: string; steps: Step[] } | null;
  no_inverse: string | null;
  trace: string | null;
  rank: number;
  symmetric: string | null;
  skew: string | null;
  square: string | null;
  eigen: {
    polynomial: string;
    values: { latex: string; re: number; im: number; multiplicity: number; exact: boolean }[];
    vectors: { value: number; latex: string; numbers: number[] }[];
  } | null;
  singular: { values: number[] };
}

interface Reduction {
  steps: { words: string; latex: string; matrix: string }[];
  result: string;
  rank: number;
}

interface SystemResult {
  kind: 'unique' | 'none' | 'many';
  steps: Step[];
  reduction: Reduction;
  answer: string | null;
}

interface Complaint {
  message: string;
  row?: number | null;
  col?: number | null;
}

interface Example {
  title: string;
  rows: string[][];
  b?: string[];
  values?: Record<string, number>;
  note: string;
}

const EXAMPLES: Example[] = [
  { title: 'A stretch', rows: [['2', '0'], ['0', '1']], note: 'Twice as wide, as tall as before: the area doubles, and the axes are the eigenvectors.' },
  { title: 'A quarter turn', rows: [['0', '-1'], ['1', '0']], note: 'Every direction turns, so no real eigenvector: the eigenvalues are ±i.' },
  { title: 'A turn by θ', rows: [['cos θ', '-sin θ'], ['sin θ', 'cos θ']], values: { theta: 0.6 }, note: 'θ is in radians. The determinant stays 1: turning keeps area.' },
  { title: 'A shear', rows: [['1', '1'], ['0', '1']], note: 'One direction is kept, the x-axis: the eigenvalue 1 comes twice but has one eigenvector.' },
  { title: 'A reflection in y = x', rows: [['0', '1'], ['1', '0']], note: 'The determinant is −1: the square is turned over.' },
  { title: 'A projection', rows: [['1', '0'], ['0', '0']], note: 'The plane is flattened onto the x-axis: determinant 0, no inverse.' },
  { title: 'A symmetric matrix', rows: [['2', '1'], ['1', '2']], note: 'Its eigenvectors are at right angles, and the circle goes to an ellipse along them.' },
  { title: 'Any 2×2 matrix', rows: [['a', 'b'], ['c', 'd']], values: { a: 1.5, b: 0.5, c: -0.5, d: 1 }, note: 'Letters are sliders; the determinant and inverse are worked out with the letters in.' },
  { title: 'NCERT: a determinant by expansion', rows: [['1', '2', '4'], ['-1', '3', '0'], ['4', '1', '0']], note: 'Open "Determinant" for the expansion along the first row.' },
  { title: 'NCERT: three equations', rows: [['1', '1', '1'], ['0', '1', '3'], ['1', '-2', '1']], b: ['6', '11', '0'], note: 'x + y + z = 6, y + 3z = 11, x − 2y + z = 0, by the matrix method and by row reduction.' },
  { title: 'A turn about the z-axis', rows: [['cos θ', '-sin θ', '0'], ['sin θ', 'cos θ', '0'], ['0', '0', '1']], values: { theta: 0.8 }, note: 'Drag the picture to look from another side.' },
  { title: 'Flattened to a plane', rows: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']], note: 'Rank 2: the cube goes flat. Row reduction shows the row that vanishes.' },
];

const blank = (n: number): string[][] => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? '1' : '0')));

/** The Matrices room: a matrix typed, what it does to the plane or to space, and everything the chapter asks of it. */
export function mountMatrices(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  const canvas = el('canvas', { class: 'stage-canvas maths-canvas' });
  const flat = new PlaneStage(canvas);
  const space = new SpaceStage(canvas);

  const sizes = el('div', { class: 'choice', role: 'group', 'aria-label': 'Size' });
  const grid = el('div', { class: 'matrix-grid' });
  const complaint = el('p', { class: 'maths-complaint' });
  const sliders = el('div', { class: 'maths-sliders' });
  const note = el('p', { class: 'maths-note' });
  const left = el('section', { class: 'maths-panel glass overlay' }, [
    roomTabs('matrices'),
    el('h4', { class: 'panel-title', text: 'Matrix A' }),
    sizes,
    el('div', { class: 'matrix-frame' }, [grid]),
    complaint,
    sliders,
    note,
  ]);

  const calculus = el('div', { class: 'maths-calculus-body' });
  const right = el('aside', { class: 'maths-calculus glass overlay' }, [calculus]);

  let t = 1;
  const show: Show = { grid: true, eigen: true, circle: false };
  const progress = slider({ label: 'I → A', min: 0, max: 1, step: 0.01, value: t, format: (v) => `${Math.round(v * 100)} %`, onInput: (v) => {
    t = v;
    draw();
  } });
  progress.root.classList.add('matrix-progress');
  const play = iconButton('play', 'Watch the plane move from I to A', () => animate(), 'play');
  const dock = el('div', { class: 'dock glass overlay maths-dock' }, [
    play,
    progress.root,
    toggleButton('field', 'The grid after A', show.grid, (on) => ((show.grid = on), draw())),
    toggleButton('pin', 'Eigenvectors: directions only stretched', show.eigen, (on) => ((show.eigen = on), draw())),
    toggleButton('ball', 'The unit circle and the ellipse it becomes', show.circle, (on) => ((show.circle = on), draw())),
    iconButton('fit', 'Back to the start ( 0 )', () => home()),
  ]);
  main.append(canvas, left, right, dock);
  if (embedded) main.classList.add('maths-embedded');

  let size = 2;
  let cells = blank(2);
  let b: string[] = ['1', '1'];
  let matrix: Matrix | undefined;
  let title = 'Your matrix';
  const values = new Map<string, number>();
  const sliderOf = new Map<string, Slider>();
  const open = new Set<string>(['determinant', 'eigen']);
  const inputs: HTMLInputElement[][] = [];

  const valuesOf = (m: Matrix) => new Float64Array(m.parameters().map((n) => values.get(n) ?? 1));

  // ---------- the grid of entries ----------

  function buildSizes(): void {
    sizes.replaceChildren(
      ...[2, 3, 4].map((n) => {
        const button = el('button', { type: 'button', text: `${n} × ${n}` });
        button.setAttribute('aria-pressed', String(n === size));
        button.addEventListener('click', () => {
          if (n === size) return;
          resize(n);
          changed();
          requestAnimationFrame(() => home());
        });
        return button;
      }),
    );
  }

  function resize(n: number): void {
    const old = cells;
    cells = blank(n).map((row, i) => row.map((v, j) => old[i]?.[j] ?? v));
    b = Array.from({ length: n }, (_, i) => b[i] ?? '1');
    size = n;
    buildSizes();
    buildGrid();
  }

  function buildGrid(): void {
    inputs.length = 0;
    grid.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
    grid.replaceChildren();
    for (let i = 0; i < size; i++) {
      inputs.push([]);
      for (let j = 0; j < size; j++) {
        const input = el('input', { type: 'text', class: 'matrix-cell', spellcheck: 'false', autocomplete: 'off', 'aria-label': `Row ${i + 1}, column ${j + 1}` });
        input.value = cells[i]![j]!;
        let pause: number | undefined;
        input.addEventListener('input', () => {
          clearTimeout(pause);
          pause = window.setTimeout(() => {
            cells[i]![j] = input.value;
            changed();
          }, 250);
        });
        input.addEventListener('keydown', (e) => {
          e.stopPropagation();
          const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], Enter: [1, 0] };
          const move = moves[e.key];
          if (move) {
            e.preventDefault();
            inputs[(i + move[0] + size) % size]?.[(j + move[1] + size) % size]?.focus();
          }
        });
        input.addEventListener('focus', () => input.select());
        inputs[i]!.push(input);
        grid.append(input);
      }
    }
  }

  function read(): void {
    matrix?.free();
    matrix = undefined;
    complaint.textContent = '';
    for (const row of inputs) for (const input of row) input.classList.remove('wrong');
    try {
      matrix = new Matrix(cells);
    } catch (e) {
      const c = (typeof e === 'object' && e ? e : { message: String(e) }) as Complaint;
      complaint.textContent = c.row != null && c.col != null ? `Row ${c.row + 1}, column ${c.col + 1}: ${c.message}` : c.message;
      if (c.row != null && c.col != null) inputs[c.row]?.[c.col]?.classList.add('wrong');
    }
  }

  function syncSliders(): void {
    const names = matrix?.parameters() ?? [];
    const shown = [...sliderOf.keys()];
    if (shown.length === names.length && shown.every((n, i) => n === names[i])) return;
    sliderOf.clear();
    sliders.replaceChildren(...(names.length ? [el('h4', { class: 'panel-title', text: 'Sliders' })] : []));
    for (const name of names) {
      if (!values.has(name)) values.set(name, 1);
      const s = slider({
        label: name === 'theta' ? 'θ' : name,
        min: -5,
        max: 5,
        step: 0.05,
        value: values.get(name)!,
        hardMin: -1e9,
        hardMax: 1e9,
        format: (v) => formatNumber(v, 4),
        onInput: (v) => {
          values.set(name, v);
          soon();
        },
      });
      sliderOf.set(name, s);
      sliders.append(s.root);
    }
  }

  // ---------- the panel ----------

  function block(source: string): HTMLElement {
    const holder = el('div', { class: 'maths-formula' });
    tex(holder, source, true);
    return holder;
  }

  function steps(list: Step[]): HTMLElement {
    const ol = el('ol', { class: 'maths-steps' });
    for (const step of list) {
      const item = el('li', {}, [el('span', { text: step.words })]);
      if (step.latex) {
        const f = el('div', { class: 'maths-step-formula' });
        tex(f, step.latex, true);
        item.append(f);
      }
      ol.append(item);
    }
    return ol;
  }

  function fold(key: string, heading: string, body: HTMLElement[]): HTMLElement {
    const details = el('details', { class: 'maths-section matrix-fold' }, [el('summary', {}, [el('h4', { class: 'panel-title', text: heading })]), ...body]);
    details.open = open.has(key);
    details.addEventListener('toggle', () => {
      if (details.open) open.add(key);
      else open.delete(key);
    });
    return details;
  }

  // the right-hand side of A x = b stays put while the rest is redrawn, so it can be typed in
  const bFields = el('div', { class: 'matrix-b' });
  const bResult = el('div');

  function buildB(): void {
    bFields.replaceChildren(
      ...b.map((v, i) => {
        const input = el('input', { type: 'text', class: 'matrix-cell', spellcheck: 'false', 'aria-label': `b, row ${i + 1}` });
        input.value = v;
        let pause: number | undefined;
        input.addEventListener('input', () => {
          clearTimeout(pause);
          pause = window.setTimeout(() => {
            b[i] = input.value;
            showSystem();
          }, 300);
        });
        input.addEventListener('keydown', (e) => e.stopPropagation());
        return input;
      }),
    );
  }

  function showSystem(): void {
    if (!matrix) return bResult.replaceChildren();
    try {
      const s = matrix.solve(b, valuesOf(matrix)) as SystemResult;
      const verdict = { unique: 'One solution', none: 'No solution', many: 'Infinitely many solutions' }[s.kind];
      const parts: HTMLElement[] = [el('p', { class: 'matrix-verdict', text: verdict })];
      if (s.answer) parts.push(block(`X = ${s.answer}`));
      parts.push(el('details', { class: 'fold' }, [el('summary', { text: 'How' }), steps(s.steps)]));
      const ops = el('ol', { class: 'maths-steps' });
      for (const op of s.reduction.steps) {
        const f = el('div', { class: 'maths-step-formula' });
        tex(f, `${op.latex} \\qquad ${op.matrix}`, true);
        ops.append(el('li', {}, [f]));
      }
      parts.push(el('details', { class: 'fold' }, [el('summary', { text: 'By row reduction' }), ops]));
      bResult.replaceChildren(...parts);
    } catch (e) {
      const c = (typeof e === 'object' && e ? e : { message: String(e) }) as Complaint;
      bResult.replaceChildren(el('p', { class: 'maths-complaint', text: c.message }));
    }
  }

  function showPanel(): void {
    if (!matrix) {
      calculus.replaceChildren(el('p', { class: 'muted', text: 'Fix the entry marked in red to see what the matrix does.' }));
      return;
    }
    const m = matrix;
    const f = m.facts(valuesOf(m)) as Facts;
    const sections: HTMLElement[] = [block(`A = ${f.latex}`)];

    if (f.determinant) {
      const body = [block(`|A| = ${f.determinant.latex}`)];
      if (f.determinant_value !== null && m.parameters().length) body.push(el('p', { class: 'muted', text: `= ${formatNumber(f.determinant_value, 5)} at the sliders' values` }));
      if (f.determinant.steps.length) body.push(steps(f.determinant.steps));
      sections.push(fold('determinant', 'Determinant', body));
    }

    sections.push(
      fold('inverse', 'Inverse', f.inverse ? [block(`A^{-1} = ${f.inverse.latex}`), el('details', { class: 'fold' }, [el('summary', { text: 'How' }), steps(f.inverse.steps)])] : [el('p', { class: 'muted', text: f.no_inverse ?? 'No inverse.' })]),
    );

    if (f.eigen) {
      const e = f.eigen;
      const body: HTMLElement[] = [block(`|A - \\lambda I| = ${e.polynomial}`)];
      const shown = (latex: string) => (latex.startsWith('\\approx') ? latex : `= ${latex}`);
      const list = e.values.map((v) => `\\lambda ${shown(v.latex)}${v.multiplicity > 1 ? `\\ (\\text{${v.multiplicity === 2 ? 'twice' : `${v.multiplicity} times`}})` : ''}`);
      body.push(el('div', { class: 'matrix-pieces' }, list.map(block)));
      if (e.values.some((v) => !v.exact)) body.push(el('p', { class: 'muted', text: 'No exact form is found for some of these, so they are found numerically, to six figures.' }));
      if (e.vectors.length) {
        body.push(el('div', { class: 'matrix-pieces' }, e.vectors.map((v) => block(`\\lambda ${shown(e.values[v.value]!.latex)}:\\ ${v.latex}`))));
      } else {
        body.push(el('p', { class: 'muted', text: 'No real eigenvalue, so no direction is kept: every line through the origin is turned.' }));
      }
      sections.push(fold('eigen', 'Eigenvalues and eigenvectors', body));
    }

    const reduction = m.reduce(valuesOf(m)) as Reduction;
    const ops = el('ol', { class: 'maths-steps' });
    for (const op of reduction.steps) {
      const formula = el('div', { class: 'maths-step-formula' });
      tex(formula, `${op.latex} \\qquad ${op.matrix}`, true);
      ops.append(el('li', {}, [formula]));
    }
    sections.push(
      fold('reduce', 'Row reduction', [
        block(`\\operatorname{rref}(A) = ${reduction.result},\\quad \\operatorname{rank} A = ${reduction.rank}`),
        reduction.steps.length ? ops : el('p', { class: 'muted', text: 'Already reduced.' }),
      ]),
    );

    sections.push(fold('solve', 'Solve A X = B', [el('div', { class: 'matrix-solve' }, [el('span', { class: 'muted', text: 'B =' }), bFields]), bResult]));

    const more: HTMLElement[] = [block(`A^{T} = ${f.transpose}`)];
    if (f.trace) more.push(block(`\\operatorname{tr} A = ${f.trace}`));
    if (f.square) more.push(block(`A^{2} = ${f.square}`));
    if (f.symmetric && f.skew) {
      more.push(el('p', { class: 'muted', text: 'A symmetric part and a skew-symmetric part, which add up to A:' }));
      more.push(block(`\\tfrac{1}{2}(A + A^{T}) = ${f.symmetric}`));
      more.push(block(`\\tfrac{1}{2}(A - A^{T}) = ${f.skew}`));
    }
    more.push(el('p', { class: 'muted', text: `Singular values (the half-axes of the ellipse): ${f.singular.values.map((v) => formatNumber(v, 4)).join(', ')}` }));
    sections.push(fold('more', 'Transpose, trace and more', more));

    calculus.replaceChildren(...sections);
    showSystem();
  }

  // ---------- the stage ----------

  function numbersAt(fraction: number): number[] | undefined {
    if (!matrix) return undefined;
    const a = matrix.numbers(valuesOf(matrix));
    if (a.some((v) => !Number.isFinite(v))) return undefined;
    // (1 − t) I + t A
    return Array.from(a, (v, k) => (Math.floor(k / size) === k % size ? 1 - fraction : 0) + fraction * v);
  }

  function draw(): void {
    const m = numbersAt(t);
    canvas.classList.toggle('matrix-space', size === 3);
    if (!m) {
      flat.plane.draw({ curves: [], areas: [], markers: [] });
      return;
    }
    if (size === 2) flat.draw(m, show);
    else if (size === 3) space.draw(m);
    else {
      flat.plane.draw({ curves: [], areas: [], markers: [] });
    }
    dock.classList.toggle('matrix-dock-3d', size !== 2);
  }

  let pending = false;
  /** Slider moves come many to a frame; the panel is redrawn once per frame. */
  function soon(): void {
    draw();
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      showPanel();
    });
  }

  function changed(): void {
    read();
    syncSliders();
    buildB();
    showPanel();
    draw();
    if (size === 4) note.textContent ||= 'A 4×4 matrix acts on four dimensions, which do not fit on a screen: what it does is worked out on the right.';
    note.hidden = !note.textContent;
    shell.setTitle('Maths · Matrices', title);
    dock.hidden = size === 4;
  }

  let animation = 0;
  function animate(): void {
    cancelAnimationFrame(animation);
    const start = performance.now();
    const step = (now: number) => {
      t = Math.min(1, (now - start) / 1600);
      progress.set(t);
      draw();
      if (t < 1) animation = requestAnimationFrame(step);
    };
    animation = requestAnimationFrame(step);
  }

  function freeCentre(): [number, number] {
    const box = main.getBoundingClientRect();
    const leftEdge = embedded ? 0 : left.getBoundingClientRect().right - box.left;
    const rightEdge = embedded || getComputedStyle(right).display === 'none' ? main.clientWidth : right.getBoundingClientRect().left - box.left;
    const x = rightEdge > leftEdge + 200 ? (leftEdge + rightEdge) / 2 : main.clientWidth / 2;
    return [x, (main.clientHeight - layoutPx(70)) / 2];
  }

  /** Back to the origin, zoomed so that the image of the unit square or cube fits the free space. */
  function home(): void {
    const [x] = freeCentre();
    const m = numbersAt(1) ?? [];
    // the longest image of a basis vector sets the size; the far corner may stick out a little
    const reach = Math.max(1.5, ...Array.from({ length: size }, (_, j) => Math.hypot(...Array.from({ length: size }, (_, i) => m[i * size + j] ?? 0))));
    const room = Math.min(main.clientHeight - layoutPx(140), right.getBoundingClientRect().left - left.getBoundingClientRect().right || main.clientWidth);
    const scale = Math.min(HOME.scale * 1.4, (0.4 * room) / reach);
    flat.plane.camera = { scale, x: -(x - main.clientWidth / 2) / scale, y: 0 };
    space.centre = freeCentre();
    space.zoom = Math.max(0.25, Math.min(1.4, (0.4 * room) / (70 * reach)));
    draw();
  }

  // ---------- pointer ----------

  let dragging: 'pan' | 'turn' | 0 | 1 | undefined;
  let last: [number, number] = [0, 0];
  const local = (e: PointerEvent | WheelEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function tipUnder(px: number, py: number): 0 | 1 | undefined {
    if (size !== 2 || t < 1) return undefined;
    const m = numbersAt(1);
    if (!m) return undefined;
    const tips = flat.tips(m);
    const hit = tips.findIndex(([x, y]) => Math.hypot(px - x, py - y) < 18);
    return hit === 0 || hit === 1 ? hit : undefined;
  }

  /** A dragged column written back into the entries: whole numbers when close, tenths otherwise. */
  function setColumn(col: number, x: number, y: number): void {
    const tidy = (v: number) => {
      const r = Math.round(v);
      const n = Math.abs(v - r) < 0.12 ? r : Math.round(v * 10) / 10;
      return String(Object.is(n, -0) ? 0 : n);
    };
    cells[0]![col] = tidy(x);
    cells[1]![col] = tidy(y);
    inputs[0]![col]!.value = cells[0]![col]!;
    inputs[1]![col]!.value = cells[1]![col]!;
    title = 'Your matrix';
    read();
    syncSliders();
    soon();
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    last = local(e);
    const tip = tipUnder(...last);
    dragging = tip ?? (size === 3 ? 'turn' : 'pan');
    canvas.classList.toggle('holding', true);
  });
  canvas.addEventListener('pointermove', (e) => {
    const [px, py] = local(e);
    if (dragging === undefined) {
      canvas.classList.toggle('over-body', tipUnder(px, py) !== undefined);
      return;
    }
    if (dragging === 0 || dragging === 1) {
      const [x, y] = flat.plane.toPlane(px, py);
      setColumn(dragging, x, y);
    } else if (dragging === 'pan') {
      flat.plane.pan(px - last[0], py - last[1]);
      draw();
    } else {
      space.yaw += (px - last[0]) * 0.01;
      space.pitch = Math.max(-1.5, Math.min(1.5, space.pitch + (py - last[1]) * 0.01));
      draw();
    }
    last = [px, py];
  });
  const release = () => {
    dragging = undefined;
    canvas.classList.remove('holding');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      if (size === 3) space.zoom = Math.max(0.2, Math.min(5, space.zoom * factor));
      else flat.plane.zoom(factor, ...local(e));
      draw();
    },
    { passive: false },
  );

  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select, [contenteditable]');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '0') home();
  });
  const fit = () => {
    flat.plane.resize();
    space.resize();
    space.centre = freeCentre();
    draw();
  };
  window.addEventListener('resize', fit);
  window.addEventListener('themechange', () => draw());

  // ---------- examples and links ----------

  function load(example: Example): void {
    title = example.title;
    note.textContent = example.note;
    values.clear();
    for (const [k, v] of Object.entries(example.values ?? {})) values.set(k, v);
    sliderOf.clear();
    size = example.rows.length;
    cells = example.rows.map((r) => [...r]);
    b = example.b ? [...example.b] : Array.from({ length: size }, () => '1');
    if (example.b) open.add('solve');
    buildSizes();
    buildGrid();
    t = 1;
    progress.set(1);
    changed();
  }

  shell.onTitle(() => {
    const anchor = document.querySelector<HTMLElement>('.title-button')!;
    const menu = el(
      'nav',
      { class: 'menu maths-examples' },
      EXAMPLES.map((example) => {
        const item = el('button', { type: 'button', class: 'subject' }, [el('span', {}, [el('b', { text: example.title }), el('small', { text: example.rows.map((r) => r.join('  ')).join('  |  ') })])]);
        item.addEventListener('click', () => {
          load(example);
          requestAnimationFrame(() => home());
          popover(anchor, el('div'));
        });
        return item;
      }),
    );
    popover(anchor, menu, 'below');
  });

  shell.onShare(() => {
    const link = new URLSearchParams({ mode: 'maths', room: 'matrices', m: cells.map((r) => r.join(',')).join(';') });
    if (open.has('solve')) link.set('b', b.join(','));
    for (const [k, v] of values) link.append('v', `${k}:${v}`);
    const url = `${location.origin}${location.pathname}?${link}`;
    history.replaceState(null, '', url);
    navigator.clipboard?.writeText(url).then(
      () => toast('Link copied: it opens this matrix as it is now.'),
      () => toast(url),
    );
  });

  // ---------- start ----------

  flat.plane.resize();
  space.resize();
  const typed = query.get('m');
  if (typed) {
    const rows = typed.split(';').map((r) => r.split(','));
    const n = Math.min(4, Math.max(2, rows.length));
    const square = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => rows[i]?.[j] ?? '0'));
    load({
      title: 'Shared matrix',
      rows: square,
      b: query.get('b')?.split(','),
      values: Object.fromEntries(query.getAll('v').map((s) => s.split(':')).map(([k, v]) => [k!, Number(v)])),
      note: '',
    });
  } else {
    load(EXAMPLES[6]!);
  }
  requestAnimationFrame(() => home());
}
