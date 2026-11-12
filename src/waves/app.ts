import { choice, closePopover, iconButton, popover, slider, toast, toggleButton } from '../controls';
import { icon } from '../icons';
import type { Shell } from '../shell';
import { cssVar, el, formatDuration, formatNumber, formatQuantity } from '../ui';
import { openWaveGallery, type WaveChoice } from './gallery';
import { decodeLab, emptyLab, encodeLab, labEditor, labFrom, resolveLab, savedLab, saveLab, type Lab } from './lab';
import { defaults, findLesson, lessons, type Lesson, type Values } from './lessons';
import { LinePlot, sparkline } from './line';
import { findPreset, presets, type Preset } from './presets';
import { resolve, SolitonScene, TextbookScene, type Reading, type Resolved, type WaveScene } from './scene';

/** What is open: a lesson with its parameters, the reader's own lab, or a soliton the engine integrates. */
type Open = { kind: 'lesson'; lesson: Lesson; values: Values } | { kind: 'lab'; lab: Lab } | { kind: 'soliton'; preset: Preset };

const PROBES = [
  { label: '1', color: '#fbbf24' },
  { label: '2', color: '#f472b6' },
];

export function mountWaves(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): void {
  const canvas = el('canvas', { class: 'stage-canvas' });
  const description = el('p', { class: 'empty' });
  const actions = el('div', { class: 'info-actions' });
  const factsTitle = el('h4', { class: 'panel-title' });
  const facts = el('dl', { class: 'readout facts' });
  const probeBox = el('div', { class: 'probes' });
  const controls = el('div', { class: 'wave-controls' });
  const formulas = el('div', { class: 'formulas' });
  // Open where there is room beside the wave; on a phone the wave comes first and the rest is a tap away.
  const wide = window.innerWidth > 900;
  const controlFold = el('details', { class: 'fold' }, [el('summary', { text: 'Change it' }), controls]);
  const formulaFold = el('details', { class: 'fold' }, [el('summary', { text: 'Formulas' }), formulas]);
  controlFold.open = formulaFold.open = wide;
  const clockTime = el('span');
  // How much the wave is slowed down is worth knowing, but not worth a second line on a phone.
  const clockPace = el('span', { class: 'wide-only' });
  const clock = el('output', { class: 'clock' }, [clockTime, clockPace]);
  const plot = new LinePlot(canvas);

  let open: Open;
  let scene: WaveScene | undefined;
  let running = true;
  let ended = false;
  let speed = 1;
  let showParts = true;
  let drawing = false;
  let sketch: Float64Array | undefined;
  /** Positions of the points being read, at most two. */
  let probes: number[] = [];

  const play = iconButton('pause', 'Pause (Space)', () => toggle(), 'play');
  const speedSlider = slider({ label: 'Speed', min: 0.1, max: 4, step: 0.1, value: speed, format: (v) => `×${formatNumber(v, 2)}`, onInput: (v) => (speed = v) });
  const speedChip = el('button', { type: 'button', class: 'speed-chip wide-only', title: 'Speed', text: 'Speed' });
  speedChip.addEventListener('click', () => popover(speedChip, el('div', { class: 'params' }, [speedSlider.root]), 'above'));
  const partsToggle = toggleButton('parts', 'Show each wave behind the sum', showParts, (on) => (showParts = on));
  const draw = toggleButton('pencil', 'Draw your own wave', false, (on) => {
    drawing = on;
    canvas.classList.toggle('placing', on);
    if (on) {
      running = false;
      probes = [];
      refreshPlay();
      toast('Drag across the plot to draw a wave, then press play.');
    }
  });

  const divider = el('span', { class: 'dock-divider' });
  const dock = el('div', { class: 'dock glass overlay' }, [
    iconButton('restart', 'Start again (R)', () => restart()),
    play,
    iconButton('step', 'One small step (→)', () => step()),
    clock,
    speedChip,
    divider,
    partsToggle,
    draw,
  ]);
  const panel = el('section', { class: 'wave-readout glass overlay' }, [description, actions, factsTitle, facts, probeBox, controlFold, formulaFold]);
  main.append(canvas, panel, dock);

  // The wave is drawn clear of the panel: beside it on a wide screen, above it on a narrow one. An opened fold
  // on a phone may cover the wave, but never takes more than half the height from it.
  const clearPanel = () => {
    const beside = main.clientWidth > 900;
    plot.right = !embedded && beside ? 384 : 16;
    plot.bottom = embedded || beside ? 92 : Math.min(panel.offsetHeight + 92, main.clientHeight / 2);
  };
  for (const watched of [main, panel]) new ResizeObserver(clearPanel).observe(watched);

  /**
   * Typesets the formulas. The typesetter is fetched the first time it is wanted, so it costs nothing to the
   * mechanics mode, and a wave chosen meanwhile is not overwritten by a slower, older request.
   */
  async function showFormulas(): Promise<void> {
    const wanted = scene;
    const [{ default: katex }] = await Promise.all([import('katex'), import('katex/dist/katex.min.css')]);
    if (!wanted || scene?.id !== wanted.id) return;
    const typeset = (tex: string) => {
      const holder = el('div', { class: 'formula-tex' });
      try {
        katex.render(tex, holder, { displayMode: true, throwOnError: false });
      } catch {
        holder.textContent = tex;
      }
      return holder;
    };
    const groups = wanted.formulas();
    formulas.replaceChildren(
      ...groups.flatMap((group) => [
        ...(groups.length > 1 ? [el('h4', { class: 'panel-title', text: group.title })] : []),
        ...group.formulas.map((f) => el('div', { class: 'formula' }, [el('span', { class: 'formula-label', text: f.label }), typeset(f.tex), ...(f.note ? [el('p', { class: 'formula-note', text: f.note })] : [])])),
      ]),
    );
  }

  function refreshPlay(): void {
    play.replaceChildren(icon(running ? 'pause' : 'play', 20));
  }

  function toggle(): void {
    if (ended) return restart();
    running = !running;
    refreshPlay();
  }

  function step(): void {
    running = false;
    refreshPlay();
    scene?.nudge();
  }

  const resolved = (): Resolved | undefined => (open.kind === 'lesson' ? resolve(open.lesson, open.values) : open.kind === 'lab' ? resolveLab(open.lab) : undefined);

  /** Builds the scene again from what is open. Time carries on unless the wave has a beginning and an end. */
  function rebuild(keepTime: boolean): void {
    const spec = resolved();
    const from = keepTime && scene && spec?.duration === undefined ? scene.time() : 0;
    scene?.dispose();
    scene = spec ? new TextbookScene(spec, from) : new SolitonScene((open as { preset: Preset }).preset);
    const [low, high] = [scene.x[0]!, scene.x[scene.x.length - 1]!];
    probes = probes.filter((x) => x >= low && x <= high);
    if (!keepTime || spec?.duration !== undefined) {
      ended = false;
      running = true;
      refreshPlay();
    }
    renderFacts();
    link();
  }

  function restart(): void {
    rebuild(false);
  }

  function link(): void {
    if (embedded) return;
    let url = `?mode=waves&preset=${scene!.id}`;
    if (open.kind === 'lesson') {
      for (const p of open.lesson.params) if (open.values[p.id] !== p.value) url += `&${p.id}=${Number(open.values[p.id]!.toPrecision(6))}`;
    } else if (open.kind === 'lab') {
      url += `&lab=${encodeLab(open.lab)}`;
      saveLab(open.lab);
    }
    history.replaceState(null, '', url);
  }

  function renderFacts(): void {
    if (!scene) return;
    factsTitle.textContent = scene.factsTitle;
    facts.replaceChildren(...scene.facts().flatMap((fact) => [el('dt', { text: fact.label }), el('dd', { text: fact.value })]));
  }

  /** The sliders of a lesson, or the editor of a lab. */
  function renderControls(): void {
    if (open.kind === 'lesson') {
      const { lesson, values } = open;
      const set = (id: string, v: number) => {
        values[id] = v;
        rebuild(true);
      };
      controls.replaceChildren(
        ...lesson.params.map((p) =>
          p.options
            ? choice(p.label, p.options, values[p.id]!, (v) => set(p.id, v))
            : slider({ label: p.label, min: p.min, max: p.max, step: p.step, value: values[p.id]!, hardMin: p.hardMin, hardMax: p.hardMax, format: (v) => (p.unit === '' && p.step >= 1 ? String(Math.round(v)) : formatQuantity(v, p.unit)), onInput: (v) => set(p.id, v) }).root,
        ),
      );
    } else if (open.kind === 'lab') {
      controls.replaceChildren(labEditor(open.lab, () => rebuild(true)));
    } else controls.replaceChildren();
    controlFold.hidden = open.kind === 'soliton';
  }

  function action(name: 'remix' | 'restart' | 'erase', label: string, onClick: () => void): HTMLButtonElement {
    const button = el('button', { type: 'button', class: 'text-button outlined' }, [icon(name, 16), label]);
    button.addEventListener('click', onClick);
    return button;
  }

  /** Opens a wave: sets the title, the panel and the dock for it. */
  function show(next: Open): void {
    closePopover();
    open = next;
    probes = [];
    sketch = undefined;
    if (drawing) draw.click();
    rebuild(false);
    const current = scene!;
    shell.setTitle(current.group, current.title);
    description.textContent = current.description;
    actions.replaceChildren(
      ...(open.kind === 'lesson'
        ? [
            action('remix', 'Remix', () => {
              show({ kind: 'lab', lab: labFrom(resolved()!) });
              toast('This is now your copy, in the wave lab. Change the waves, add more.');
            }),
            action('restart', 'Reset', () => show({ kind: 'lesson', lesson: (open as { lesson: Lesson }).lesson, values: defaults((open as { lesson: Lesson }).lesson) })),
          ]
        : open.kind === 'lab'
          ? [action('erase', 'Start over', () => show({ kind: 'lab', lab: emptyLab() }))]
          : []),
    );
    actions.hidden = open.kind === 'soliton';
    draw.hidden = open.kind !== 'soliton';
    showParts = current.showsParts;
    partsToggle.hidden = current.partCount < 2;
    partsToggle.setAttribute('aria-pressed', String(showParts));
    divider.hidden = partsToggle.hidden && draw.hidden;
    renderControls();
    renderProbes();
    void showFormulas();
  }

  function choose(choice: WaveChoice): void {
    if ('lesson' in choice) {
      const lesson = findLesson(choice.lesson) ?? lessons[0]!;
      show({ kind: 'lesson', lesson, values: defaults(lesson) });
    } else if ('preset' in choice) show({ kind: 'soliton', preset: findPreset(choice.preset) });
    else show({ kind: 'lab', lab: (choice.lab === 'saved' && savedLab()) || emptyLab() });
  }

  const gallery = () => openWaveGallery(scene?.id ?? '', open.kind === 'lab' ? undefined : savedLab(), choose);
  shell.onTitle(gallery);
  shell.onShare(async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied.');
    } catch {
      prompt('Copy this link', location.href);
    }
  });

  /** What each chosen point reads now, and what lies between two of them. */
  function renderProbes(): void {
    if (!scene || embedded) return;
    if (probes.length === 0) {
      probeBox.replaceChildren(el('p', { class: 'probe-hint' }, [icon('cursor', 14), 'Click anywhere on the wave to read that point: displacement, velocity, amplitude and phase. Click a second point to compare the two.']));
      return;
    }
    const unit = scene.xUnit;
    const readings = probes.map((x) => scene!.probe(x));
    const cards = readings.map((reading, i) => {
      const tag = el('span', { class: 'probe-tag', text: PROBES[i]!.label });
      tag.style.background = PROBES[i]!.color;
      const remove = el('button', { type: 'button', class: 'icon-button small', title: 'Remove this point', 'aria-label': `Remove point ${PROBES[i]!.label}` }, [icon('close', 14)]);
      // Readings are rewritten several times a second, so a click would lose its button between down and up.
      remove.addEventListener('pointerdown', () => {
        probes.splice(i, 1);
        renderProbes();
      });
      const card = el('div', { class: 'probe' }, [
        el('div', { class: 'lab-head' }, [tag, el('b', { text: `Point ${PROBES[i]!.label}: x = ${formatQuantity(probes[i]!, unit)}` }), remove]),
        el('dl', { class: 'readout' }, reading.rows.flatMap((row) => [el('dt', { text: row.label }), el('dd', { text: row.value })])),
      ]);
      if (reading.history) {
        const history = el('canvas', { class: 'probe-history' });
        card.append(history, el('small', { class: 'formula-note', text: `This point over the last ${formatDuration(reading.history.span)}; now is at the right.` }));
        requestAnimationFrame(() => sparkline(history, [{ values: reading.history!.values, color: PROBES[i]!.color, width: 1.75 }], reading.history!.limit));
      }
      return card;
    });
    probeBox.replaceChildren(...cards, ...(readings.length === 2 ? [between(readings as [Reading, Reading])] : []));
  }

  function between([a, b]: [Reading, Reading]): HTMLElement {
    const apart = Math.abs(probes[1]! - probes[0]!);
    const rows = [el('dt', { text: 'Distance apart' }), el('dd', { text: formatQuantity(apart, scene!.xUnit) + (scene!.wavelength ? ` = ${formatNumber(apart / scene!.wavelength)} λ` : '') })];
    if (a.phase !== undefined && b.phase !== undefined) {
      const turn = 2 * Math.PI;
      const difference = (((b.phase - a.phase) % turn) + turn) % turn;
      const close = (target: number) => Math.abs(difference - target) < 0.035;
      const verdict = close(0) || close(turn) ? ' · in step' : close(Math.PI) ? ' · exactly out of step' : '';
      rows.push(el('dt', { text: 'Phase of 2 ahead of 1' }), el('dd', { text: `${formatNumber((difference * 180) / Math.PI)}°${verdict}` }));
    }
    return el('div', { class: 'probe' }, [el('div', { class: 'lab-head' }, [el('b', { text: 'Between 1 and 2' })]), el('dl', { class: 'readout' }, rows)]);
  }

  // Pointing at the wave: a click sets a point to read and a drag moves it. With the pencil on (solitons), a
  // drag instead draws the field, each pointer position setting the grid points it passes over.
  let held: number | undefined;
  let previous: [number, number] | undefined;
  const fieldAt = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return plot.toField(e.clientX - rect.left, e.clientY - rect.top);
  };
  const stroke = (e: PointerEvent) => {
    if (!scene || !sketch) return;
    const at = fieldAt(e);
    const from = previous ?? at;
    const [a, b] = from[0] <= at[0] ? [from, at] : [at, from];
    const x = scene.x;
    const dx = x[1]! - x[0]!;
    const first = Math.max(0, Math.ceil((a[0] - x[0]!) / dx));
    const lastIndex = Math.min(x.length - 1, Math.floor((b[0] - x[0]!) / dx));
    for (let i = first; i <= lastIndex; i++) {
      const t = b[0] === a[0] ? 1 : (x[i]! - a[0]) / (b[0] - a[0]);
      sketch[i] = a[1] + t * (b[1] - a[1]);
    }
    previous = at;
  };
  const moveProbe = (e: PointerEvent) => {
    if (held === undefined || !scene) return;
    probes[held] = Math.min(Math.max(fieldAt(e)[0], scene.x[0]!), scene.x[scene.x.length - 1]!);
    renderProbes();
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!scene) return;
    canvas.setPointerCapture(e.pointerId);
    if (drawing) {
      sketch = new Float64Array(scene.x.length);
      previous = undefined;
      return stroke(e);
    }
    // An embed has no panel to show a reading in.
    if (embedded) return;
    const [x] = fieldAt(e);
    if (x < scene.x[0]! || x > scene.x[scene.x.length - 1]!) return;
    const rect = canvas.getBoundingClientRect();
    const distance = (at: number) => Math.abs(plot.toPixelX(at) - (e.clientX - rect.left));
    const nearest = probes.reduce((best, at, i) => (best < 0 || distance(at) < distance(probes[best]!) ? i : best), -1);
    const first = probes.length === 0;
    if (nearest >= 0 && (distance(probes[nearest]!) < 14 || probes.length === PROBES.length)) held = nearest;
    else held = probes.push(x) - 1;
    moveProbe(e);
    renderProbes();
    if (first) probeBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  canvas.addEventListener('pointermove', (e) => (sketch ? stroke(e) : moveProbe(e)));
  canvas.addEventListener('pointerup', () => {
    held = undefined;
    if (!sketch || !(scene instanceof SolitonScene)) return;
    // A hand-drawn line has corners the spectral solver would ring on; a few passes of smoothing round them off.
    let u = sketch;
    for (let pass = 0; pass < 12; pass++) {
      const next = new Float64Array(u.length);
      for (let i = 0; i < u.length; i++) next[i] = 0.25 * u[(i + u.length - 1) % u.length]! + 0.5 * u[i]! + 0.25 * u[(i + 1) % u.length]!;
      u = next;
    }
    scene.setProfile(u);
    sketch = undefined;
  });

  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input:not([type=range]), select, textarea') || document.querySelector('.gallery-backdrop')) return;
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'r' || e.key === 'R') restart();
    else if (e.key === 'ArrowRight') step();
    else if (e.key === '/' && !embedded) {
      e.preventDefault();
      gallery();
    } else if (e.key === 'Escape' && probes.length) {
      probes = [];
      renderProbes();
    }
  });

  let lastFrame = performance.now();
  let lastReadout = 0;
  function loop(now: number): void {
    const elapsed = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    if (scene) {
      if (running && !scene.advance(elapsed, speed)) {
        running = false;
        ended = true;
        refreshPlay();
      }
      const series = sketch ? [{ values: sketch, color: cssVar('--accent'), width: 2.5 }] : scene.series(showParts);
      plot.draw({
        x: scene.x,
        series,
        range: scene.range,
        xUnit: scene.xUnit,
        yUnit: scene.yUnit,
        marks: scene.marks(),
        probes: probes.map((x, i) => ({ x, y: scene!.probe(x).y, ...PROBES[i]! })),
        medium: scene.medium,
        layerGain: scene.layerGain,
      });
      const [time, pace] = scene.clock().split(' · ');
      clockTime.textContent = time!;
      clockPace.textContent = (pace ? ` · ${pace}` : '') + (ended ? ' · ended' : '');
      if (now - lastReadout > 200) {
        lastReadout = now;
        if (scene instanceof SolitonScene) renderFacts();
        if (probes.length && running) renderProbes();
      }
    }
    requestAnimationFrame(loop);
  }

  // What the link asks for: a lab, a lesson with its own numbers, a soliton, or the first lesson.
  const wanted = query.get('preset');
  const lesson = findLesson(wanted);
  const lab = wanted === 'wave-lab' ? (decodeLab(query.get('lab')) ?? savedLab() ?? emptyLab()) : undefined;
  if (lab) show({ kind: 'lab', lab });
  else if (lesson || !presets.some((p) => p.id === wanted)) {
    const chosen = lesson ?? lessons[0]!;
    const values = defaults(chosen);
    for (const p of chosen.params) {
      const given = Number(query.get(p.id) ?? NaN);
      if (Number.isFinite(given)) values[p.id] = Math.min(Math.max(given, p.hardMin ?? p.min), p.hardMax ?? p.max);
    }
    show({ kind: 'lesson', lesson: chosen, values });
  } else show({ kind: 'soliton', preset: findPreset(wanted) });
  requestAnimationFrame(loop);
}
