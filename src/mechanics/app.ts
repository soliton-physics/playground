import { closePopover, popover, slider, toast } from '../controls';
import { mechanics_catalogue } from '../engine';
import { icon, type IconName } from '../icons';
import type { Shell } from '../shell';
import { clamp, el, formatNumber, formatTime } from '../ui';
import { Answers } from './answers';
import { Dock, type ViewOptions } from './dock';
import { Editor, TOOL_KEYS, emptySandbox, orbitSandbox } from './editor';
import { openGallery, type GalleryChoice } from './gallery';
import { HANDLES, type Handle } from './handles';
import { Inspector } from './inspector';
import { Session, type Source } from './session';
import { downloadScene, loadSandbox, saveSandbox, sceneFromUrl, shareLink } from './share';
import { Renderer, aggregateForces, fitArrows, scales, type Frame, type Painter } from './stage/renderer';
import { STATE_STRIDE, type ForceInfo, type Param, type SceneFile, type ScenarioSpec, type SketchInfo, type Vec, type View } from './types';

const GRAVITIES: [string, number][] = [
  ['Earth  9.8 m/s²', 9.8],
  ['Mars  3.7 m/s²', 3.7],
  ['Moon  1.6 m/s²', 1.6],
  ['No gravity', 0],
];

/** How close, in pixels, a press must be to a knob to take it. */
const KNOB_REACH = 16;

type Drag =
  | { kind: 'pan'; x: number; y: number }
  | { kind: 'press'; body: number; x: number; y: number; at: Vec }
  | { kind: 'grab' }
  | { kind: 'move'; body: number; origin: Vec; at: Vec }
  | { kind: 'velocity'; body: number }
  | { kind: 'handle'; handle: Handle };

export async function mountMechanics(main: HTMLElement, query: URLSearchParams, embedded: boolean, shell: Shell): Promise<void> {
  const catalogue = mechanics_catalogue() as ScenarioSpec[];
  const canvas = el('canvas', { class: 'stage-canvas' });
  const description = el('p');
  const actions = el('div', { class: 'info-actions' });
  const info = el('section', { class: 'info glass overlay' }, [description, actions]);
  const hint = el('div', { class: 'hint glass overlay', hidden: true });
  const banner = el('p', { class: 'banner glass overlay', hidden: true });
  const properties = el('div', { class: 'glass overlay', hidden: true, style: 'left:64px;top:50%;transform:translateY(-50%)' });
  main.append(canvas);

  const renderer = new Renderer(canvas);
  const view: ViewOptions = { forces: true, velocity: true, acceleration: false, trail: true };
  let session!: Session;
  let sandbox = false;
  let spec: ScenarioSpec = catalogue[0]!;
  let values: Record<string, number> = {};
  let drag: Drag | undefined;
  let pointer: Vec | undefined;
  let propertiesKey = '';
  let pendingRebuild = false;

  const editor = new Editor(
    () => rebuildSandbox(),
    (text) => showHint(text),
    () => {
      const { top, bottom } = renderer.camera.bounds;
      return 0.5 * (top - bottom);
    },
  );
  const answers = new Answers();
  const inspector = new Inspector((body) => focusOn(body));
  const dock = new Dock(view, {
    toggle: () => setRunning(!session.running),
    step: () => {
      setRunning(false);
      session.stepOnce();
    },
    restart: () => restart(),
    seekStart: () => setRunning(false),
    seek: (time) => {
      session.seek(time);
      renderer.clearTrail();
      banner.hidden = true;
    },
    fit: () => fit(),
    speed: (value) => (session.speed = value),
  });
  main.append(info, hint, banner, answers.root, editor.rail, properties, inspector.root, dock.root);

  // ---------------------------------------------------------------- loading worlds

  function insets(): void {
    const wide = main.clientWidth >= 1180;
    const phone = main.clientWidth <= 700;
    renderer.camera.insets = embedded
      ? { left: 8, right: 8, top: 8, bottom: 52 }
      : {
          left: sandbox ? 64 : wide ? 344 : 16,
          right: inspector.collapsed || phone ? 16 : inspector.root.offsetWidth + 24,
          top: wide || sandbox ? 16 : info.offsetHeight + 24,
          bottom: 84,
        };
    renderer.axis = { left: sandbox && !phone ? 70 : 8, clearTop: embedded ? 0 : info.offsetTop + info.offsetHeight };
  }

  /** The scene's suggested view, widened if the things in it reach further sideways than its height implies. */
  function framing(): View {
    const view = session.view;
    if (view.half_width) return view;
    const state = session.world.state();
    let reach = 0;
    session.bodies.forEach((body, i) => {
      const shape = body.shape;
      if (shape.kind === 'halfplane') return;
      const [x, y, angle] = [state[i * STATE_STRIDE]!, state[i * STATE_STRIDE + 1]!, state[i * STATE_STRIDE + 2]!];
      const points: Vec[] =
        shape.kind === 'circle'
          ? [[x - shape.radius, y], [x + shape.radius, y]]
          : shape.vertices.map(([vx, vy]) => [x + vx * Math.cos(angle) - vy * Math.sin(angle), y + vx * Math.sin(angle) + vy * Math.cos(angle)]);
      for (const [px, py] of points) {
        if (Math.abs(py - view.center[1]) > view.half_height + 0.5) continue;
        reach = Math.max(reach, Math.min(Math.abs(px - view.center[0]), 4 * view.half_height));
      }
    });
    return reach > 0 ? { ...view, half_width: reach + 0.3 } : view;
  }

  function fit(): void {
    insets();
    renderer.camera.fit(framing());
  }

  /** Replaces the world. Returns false, leaving the old one running, if the engine refuses the scene. */
  function load(source: Source, keepCamera: boolean): boolean {
    let next: Session;
    try {
      next = new Session(source);
    } catch (error) {
      toast(String(error instanceof Error ? error.message : error), 'error');
      return false;
    }
    const previous = session as Session | undefined;
    next.speed = previous?.speed ?? 1;
    if (keepCamera && previous && next.bodies[previous.focus]?.kind !== 'static' && previous.focus < next.bodies.length) next.focus = previous.focus;
    previous?.dispose();
    session = next;
    banner.hidden = true;
    renderer.clearTrail();
    inspector.reset(session);
    answers.reset(session);
    if (!keepCamera) {
      fit();
      const state = session.world.state();
      let [speed, acceleration] = [0, 0];
      session.bodies.forEach((_, i) => {
        speed = Math.max(speed, Math.hypot(state[i * STATE_STRIDE + 3]!, state[i * STATE_STRIDE + 4]!));
        acceleration = Math.max(acceleration, Math.hypot(state[i * STATE_STRIDE + 6]!, state[i * STATE_STRIDE + 7]!));
      });
      const view = framing();
      fitArrows(Math.max(view.half_height, view.half_width ?? 0), speed, acceleration);
    }
    return true;
  }

  function scenarioUrl(): string {
    const url = new URLSearchParams({ mode: 'mechanics', scenario: spec.id });
    for (const p of spec.params) if (values[p.name] !== undefined && values[p.name] !== p.default) url.set(p.name, String(values[p.name]));
    return `?${url}`;
  }

  function startScenario(next: ScenarioSpec, resetValues: boolean, keepCamera = false): void {
    if (resetValues) values = {};
    const entering = sandbox || next !== spec || resetValues;
    spec = next;
    sandbox = false;
    if (!load({ kind: 'scenario', spec, params: { ...values } }, keepCamera)) return;
    if (!embedded) history.replaceState(null, '', scenarioUrl());
    if (entering) present();
  }

  function openSandbox(json: string): void {
    const before = editor.json;
    editor.load(json);
    sandbox = true;
    if (!load({ kind: 'scene', json: editor.json }, false)) {
      editor.load(before);
      sandbox = false;
      return;
    }
    if (!embedded) history.replaceState(null, '', '?mode=mechanics&sandbox');
    saveSandbox(editor.json);
    present();
  }

  /** The editor changed the scene: build it, and undo the change if the engine will not have it. */
  function rebuildSandbox(): void {
    if (!load({ kind: 'scene', json: editor.json }, true)) {
      editor.undo();
      return;
    }
    if (editor.selected !== undefined && session.bodies[editor.selected]?.kind !== 'static') session.focus = editor.selected;
    inspector.setFocus(session.focus);
    saveSandbox(editor.json);
    shell.setTitle('Sandbox', editor.scene.title);
  }

  function restart(): void {
    const running = session.running;
    if (sandbox) load({ kind: 'scene', json: editor.json }, true);
    else startScenario(spec, false, true);
    setRunning(running);
  }

  /** Before changing a world that has been running: take it as it stands now, so the edit applies to what is on screen. */
  function editable(): void {
    setRunning(false);
    if (session.steps === 0) return;
    editor.adopt(session.world.scene_json_now());
    load({ kind: 'scene', json: editor.json }, true);
    toast('Editing from this moment. Undo goes back to where you started.');
  }

  // ---------------------------------------------------------------- chrome

  function action(name: IconName, label: string, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
    const button = el('button', { type: 'button', class: 'text-button outlined' }, [icon(name, 16), label]);
    button.addEventListener('click', () => onClick(button));
    return button;
  }

  /** Sets up the title, the info card and the tool rail for the scenario or sandbox now loaded. */
  function present(): void {
    closePopover();
    editor.rail.hidden = !sandbox;
    // A remixed scene is no longer the textbook's problem, so its answers no longer apply.
    answers.root.hidden = sandbox;
    properties.hidden = true;
    propertiesKey = '';
    hint.hidden = true;
    if (sandbox) {
      editor.setTool('select');
      shell.setTitle('Sandbox', editor.scene.title);
      description.textContent = 'Your own world. Pick a tool on the left and click to add things, press play, then grab anything and throw it.';
      actions.replaceChildren(
        action('sliders', 'Gravity', (button) => openGravity(button)),
        action('download', 'Save', () => downloadScene(editor.json, editor.scene.title)),
        action('upload', 'Open', () => file.click()),
        action('erase', 'Clear', () => {
          openSandbox(JSON.stringify(emptySandbox()));
          toast('Cleared. Undo is gone too, but your last link still works.');
        }),
      );
    } else {
      shell.setTitle(`Class ${spec.syllabus.class} · ${spec.syllabus.chapter}`, spec.title);
      description.textContent = spec.description;
      actions.replaceChildren(
        action('sliders', 'Parameters', (button) => openParameters(button)),
        action('remix', 'Remix', () => {
          openSandbox(session.world.scene_json());
          toast('This is now your copy. Move things, add things, break it.');
        }),
      );
    }
    insets();
  }

  function openParameters(anchor: HTMLElement): void {
    const panel = el('div', { class: 'params' }, [el('h4', { text: 'Parameters' })]);
    for (const p of spec.params) {
      panel.append(
        slider({
          label: p.label,
          min: p.min,
          max: p.max,
          hardMin: limits(p).min,
          hardMax: limits(p).max,
          step: p.step,
          value: values[p.name] ?? p.default,
          format: (v) => `${formatNumber(v)}${p.unit ? ` ${p.unit}` : ''}`,
          onInput: (v) => {
            values[p.name] = v;
            scheduleRebuild();
          },
        }).root,
      );
    }
    const reset = el('button', { type: 'button', class: 'text-button outlined', text: 'Back to the textbook values' });
    reset.addEventListener('click', () => {
      closePopover();
      startScenario(spec, true);
    });
    panel.append(reset);
    popover(anchor, panel, 'below');
  }

  /** Both kinds of gravity a sandbox can have: the uniform pull of a planet you stand on, and bodies pulling on each other. */
  function openGravity(anchor: HTMLElement): void {
    const down = el('div', { class: 'menu', style: 'padding:0' });
    const current = -editor.scene.world.gravity[1];
    for (const [label, g] of GRAVITIES) {
      const row = el('button', { type: 'button', text: label });
      if (Math.abs(current - g) < 1e-9) row.setAttribute('aria-current', 'true');
      row.addEventListener('click', () => {
        closePopover();
        editable();
        editor.setGravity(g);
      });
      down.append(row);
    }
    const attraction = slider({
      label: 'Strength G',
      min: 0,
      max: 5,
      step: 0.1,
      hardMax: 1e6,
      value: editor.attraction,
      format: (v) => (v > 0 ? formatNumber(v) : 'off'),
      onInput: (v) => {
        editable();
        editor.attraction = v;
      },
    });
    const panel = el('div', { class: 'params' }, [
      el('h4', { text: 'Pulling down' }),
      down,
      el('h4', { text: 'Bodies pulling on each other' }),
      attraction.root,
      el('p', {
        class: 'empty',
        text: 'Newton\u2019s law between every pair of moving bodies. The real G is 6.67 \u00d7 10\u207b\u00b9\u00b9, far too weak to see between things this size, so here you choose it. Turn the downward pull off, make one body heavy, and give the others a sideways velocity.',
      }),
    ]);
    popover(anchor, panel, 'below');
  }

  /** Parameter changes arrive faster than frames; build one world per frame at most. */
  function scheduleRebuild(): void {
    if (pendingRebuild) return;
    pendingRebuild = true;
    requestAnimationFrame(() => {
      pendingRebuild = false;
      startScenario(spec, false, drag?.kind === 'handle');
    });
  }

  function showHint(text: string): void {
    hint.textContent = text;
    hint.hidden = !sandbox || embedded || !text;
  }

  function setRunning(running: boolean): void {
    session.running = running;
    if (running) banner.hidden = true;
    hint.hidden = running || !sandbox || embedded || !hint.textContent;
  }

  /** Pauses where the problem ends and says why, so the graphs stop exactly where the textbook question does. */
  function showFinish(): void {
    const finish = session.lastFinish();
    if (!finish) return;
    setRunning(false);
    const at = `t = ${formatTime(finish.time)}`;
    banner.textContent =
      finish.time === 0
        ? 'Nothing moves: the forces balance from the start. Change something, or grab a body.'
        : finish.reason.startsWith('everything came to rest')
          ? `Everything has been at rest since ${at}.`
          : `The problem ends at ${at}: ${finish.reason}. Press play to carry on past it.`;
    banner.hidden = false;
  }

  function focusOn(body: number): void {
    if (session.bodies[body]?.kind === 'static') return;
    session.focus = body;
    inspector.setFocus(body);
    renderer.clearTrail();
  }

  function refreshProperties(): void {
    const index = sandbox && !session.running ? editor.selected : undefined;
    const body = index === undefined ? undefined : editor.scene.bodies[index];
    const key = body ? `${index}|${body.id}|${body.kind}|${Object.keys(body.shape)[0]}` : '';
    if (key === propertiesKey) return;
    propertiesKey = key;
    const panel = key ? editor.properties() : undefined;
    properties.hidden = !panel;
    if (panel) properties.replaceChildren(panel);
  }

  // ---------------------------------------------------------------- the pointer

  const local = (e: PointerEvent | WheelEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  const worldAt = (e: PointerEvent): Vec => renderer.camera.toWorld(...local(e));
  const pixels = (a: Vec, e: PointerEvent): number => {
    const [sx, sy] = renderer.camera.toScreen(a[0], a[1]);
    const [px, py] = local(e);
    return Math.hypot(sx - px, sy - py);
  };
  const reach = () => 12 / renderer.camera.scale;
  const movingAt = (at: Vec) => session.world.body_at(at[0], at[1], 14 / renderer.camera.scale);

  /** The fixed body under a point: platforms, inclines and walls first, and failing those the ground itself. */
  function fixedAt(at: Vec): number | undefined {
    const state = session.world.state();
    let ground: number | undefined;
    for (let i = session.bodies.length - 1; i >= 0; i--) {
      const body = session.bodies[i]!;
      if (body.kind !== 'static') continue;
      if (body.shape.kind === 'halfplane') {
        const { normal, offset } = body.shape;
        if (normal[0] * at[0] + normal[1] * at[1] <= offset) ground ??= i;
        continue;
      }
      const angle = state[i * STATE_STRIDE + 2]!;
      const [dx, dy] = [at[0] - state[i * STATE_STRIDE]!, at[1] - state[i * STATE_STRIDE + 1]!];
      const [lx, ly] = [dx * Math.cos(angle) + dy * Math.sin(angle), -dx * Math.sin(angle) + dy * Math.cos(angle)];
      const shape = body.shape;
      const inside =
        shape.kind === 'circle'
          ? Math.hypot(lx, ly) <= shape.radius
          : shape.vertices.every(([x, y], k) => {
              const [nx, ny] = shape.vertices[(k + 1) % shape.vertices.length]!;
              return (nx - x) * (ly - y) - (ny - y) * (lx - x) >= 0;
            });
      if (inside) return i;
    }
    return ground;
  }

  /** What a press lands on. In the sandbox, paused, fixed bodies can be picked too, so they can be moved and removed. */
  const bodyAt = (at: Vec) => movingAt(at) ?? (sandbox && !session.running ? fixedAt(at) : undefined);

  /** The scenario's knobs, shown before the run starts. */
  function handles(): Handle[] {
    return sandbox || embedded || session.steps > 0 || session.running ? [] : (HANDLES[spec.id] ?? []);
  }

  function current(): Record<string, number> {
    return Object.fromEntries(spec.params.map((p) => [p.name, values[p.name] ?? p.default]));
  }

  /**
   * How far a scenario parameter may go. Masses, lengths, speeds and forces are quantities: the slider's range is
   * a convenience and they may go a hundred times past it. Angles and coefficients keep their range, because
   * past it the scene stops being the one described (an incline beyond vertical, a restitution above one).
   */
  function limits(p: Param): { min: number; max: number } {
    if (!['kg', 'm', 'm/s', 'N', 'N/m', 'km', 'km/s', 'kg/s', 'rad/s'].includes(p.unit)) return { min: p.min, max: p.max };
    const max = 100 * p.max;
    return { min: p.min < 0 ? -max : p.min, max };
  }

  /** A value from a knob on the stage: inside the slider's range and on its steps. */
  function snap(p: Param, value: number): number {
    return Number((Math.round(clamp(value, p.min, p.max) / p.step) * p.step).toFixed(6));
  }

  const touches = new Map<number, [number, number]>();

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    touches.set(e.pointerId, local(e));
    if (touches.size > 1) {
      if (drag?.kind === 'grab') session.release();
      drag = undefined;
      return;
    }
    const at = worldAt(e);
    if (sandbox && editor.tool !== 'select') {
      editable();
      editor.press({ at, body: bodyAt(at), reach: reach() });
      return;
    }
    const knob = handles().find((h) => pixels(h.position(current()), e) < KNOB_REACH);
    if (knob) {
      drag = { kind: 'handle', handle: knob };
      return;
    }
    const tip = sandbox && !session.running ? editor.velocityTip() : undefined;
    if (tip && editor.selected !== undefined && pixels(tip, e) < KNOB_REACH) {
      drag = { kind: 'velocity', body: editor.selected };
      return;
    }
    const body = bodyAt(at);
    if (body === undefined) {
      if (sandbox) editor.selected = undefined;
      drag = { kind: 'pan', x: e.clientX, y: e.clientY };
      return;
    }
    focusOn(body);
    if (sandbox) editor.selected = body;
    if (session.running) {
      session.grab(body, at[0], at[1]);
      drag = { kind: 'grab' };
    } else {
      drag = { kind: 'press', body, x: e.clientX, y: e.clientY, at };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const at = worldAt(e);
    pointer = at;
    if (touches.has(e.pointerId) && touches.size === 2) {
      const before = [...touches.values()];
      touches.set(e.pointerId, local(e));
      const after = [...touches.values()];
      const span = (p: [number, number][]) => Math.hypot(p[0]![0] - p[1]![0], p[0]![1] - p[1]![1]);
      const mid = (p: [number, number][]): [number, number] => [(p[0]![0] + p[1]![0]) / 2, (p[0]![1] + p[1]![1]) / 2];
      const [m0, m1] = [mid(before), mid(after)];
      renderer.camera.zoomAt(m1[0], m1[1], span(after) / Math.max(span(before), 1));
      renderer.camera.pan(m1[0] - m0[0], m1[1] - m0[1]);
      return;
    }
    if (!drag) {
      canvas.classList.toggle('over-body', bodyAt(at) !== undefined || handles().some((h) => pixels(h.position(current()), e) < KNOB_REACH));
      canvas.classList.toggle('placing', sandbox && editor.tool !== 'select');
      return;
    }
    switch (drag.kind) {
      case 'pan':
        renderer.camera.pan(e.clientX - drag.x, e.clientY - drag.y);
        drag.x = e.clientX;
        drag.y = e.clientY;
        break;
      case 'press':
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) break;
        if (sandbox && session.bodies[drag.body]?.shape.kind === 'halfplane') {
          // The ground has no place to be dragged to; a drag that starts on it moves the view.
          drag = { kind: 'pan', x: e.clientX, y: e.clientY };
        } else if (sandbox) {
          editable();
          drag = { kind: 'move', body: drag.body, origin: editor.scene.bodies[drag.body]?.position ?? [0, 0], at: drag.at };
        } else {
          // Pulling on a body is the most direct way to play: the run starts and the hand takes hold.
          setRunning(true);
          session.grab(drag.body, drag.at[0], drag.at[1]);
          session.dragTo(at[0], at[1]);
          drag = { kind: 'grab' };
        }
        break;
      case 'grab':
        session.dragTo(at[0], at[1]);
        break;
      case 'move':
        editor.moveTo(drag.body, drag.origin, at[0] - drag.at[0], at[1] - drag.at[1]);
        break;
      case 'velocity': {
        const [x, y] = editor.scene.bodies[drag.body]?.position ?? [0, 0];
        editor.setVelocity(drag.body, (at[0] - x) / scales.velocity, (at[1] - y) / scales.velocity);
        break;
      }
      case 'handle': {
        const wanted = drag.handle.drag(at, current());
        for (const p of spec.params) if (wanted[p.name] !== undefined) values[p.name] = snap(p, wanted[p.name]!);
        scheduleRebuild();
        break;
      }
    }
    canvas.classList.toggle('holding', drag.kind !== 'pan');
  });

  const lift = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (drag?.kind === 'grab') session.release();
    if (drag?.kind === 'handle') requestAnimationFrame(() => requestAnimationFrame(fit));
    drag = undefined;
    canvas.classList.remove('holding');
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
  canvas.addEventListener('pointerleave', () => (pointer = undefined));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      renderer.camera.zoomAt(...local(e), Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );

  // ---------------------------------------------------------------- keyboard, files, sharing

  function choose(choice: GalleryChoice): void {
    if (choice.scenario) startScenario(catalogue.find((s) => s.id === choice.scenario) ?? spec, true);
    else if (choice.sandbox === 'saved') openSandbox(loadSandbox() ?? JSON.stringify(emptySandbox()));
    else if (choice.sandbox === 'orbits') openSandbox(JSON.stringify(orbitSandbox()));
    else openSandbox(JSON.stringify(emptySandbox()));
  }
  const gallery = () => openGallery(catalogue, sandbox ? undefined : spec.id, loadSandbox(), choose);
  shell.onTitle(gallery);
  shell.onShare(async () => {
    const link = sandbox ? await shareLink(editor.json) : new URL(scenarioUrl(), location.href).toString();
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied. Anyone who opens it gets exactly this.');
    } catch {
      prompt('Copy this link', link);
    }
  });

  const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  main.append(file);
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (chosen) openSandbox(await chosen.text());
    file.value = '';
  });

  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('input:not([type=range]), select, textarea, [contenteditable], .gallery')) return;
    const command = e.ctrlKey || e.metaKey;
    if (command && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      gallery();
    } else if (command && e.key.toLowerCase() === 'z' && sandbox) {
      e.preventDefault();
      setRunning(false);
      e.shiftKey ? editor.redo() : editor.undo();
    } else if (command || e.altKey) {
      return;
    } else if (e.code === 'Space') {
      if (e.repeat) return;
      e.preventDefault();
      setRunning(!session.running);
    } else if (e.key === 'ArrowRight') {
      setRunning(false);
      session.stepOnce();
    } else if (e.key === 'r' || e.key === 'R') {
      restart();
    } else if (e.key === 'f' || e.key === 'F') {
      fit();
    } else if (e.key === '/') {
      e.preventDefault();
      gallery();
    } else if (sandbox && (e.key === 'Delete' || e.key === 'Backspace') && editor.selected !== undefined) {
      editable();
      editor.remove(editor.selected);
    } else if (sandbox && e.key === 'Escape') {
      editor.setTool('select');
    } else if (sandbox && TOOL_KEYS[e.key.toLowerCase()]) {
      editor.setTool(TOOL_KEYS[e.key.toLowerCase()]!);
    }
  });

  // Until the user has moved the camera or the run has started, a resize reframes the scene.
  new ResizeObserver(() =>
    requestAnimationFrame(() => {
      insets();
      if (session.steps === 0 && renderer.camera.following) renderer.camera.fit(framing());
    }),
  ).observe(main);

  // ---------------------------------------------------------------- the frame loop

  function overlay(painter: Painter): void {
    const p = current();
    for (const handle of handles()) {
      const at = handle.position(p);
      const tail = handle.tail?.(p);
      if (tail) painter.dashed([tail, at], handle.color);
      painter.knob(at[0], at[1], handle.color, drag?.kind === 'handle' && drag.handle === handle);
      if (drag?.kind === 'handle' && drag.handle === handle) painter.label(handle.label(p), at[0], at[1] + 22 / painter.camera.scale, handle.color);
    }
    if (sandbox && !session.running) editor.overlay(painter, pointer);
  }

  let last = performance.now();
  let lastPanels = 0;
  function loop(now: number): void {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (session.advance(elapsed)) showFinish();
    const state = session.world.state();
    const forces = aggregateForces(session.world.forces(session.focus) as ForceInfo[]);
    const frame: Frame = {
      bodies: session.bodies,
      state,
      sketches: session.world.sketches() as SketchInfo[],
      forces,
      time: session.time,
      focus: session.bodies[session.focus]?.kind === 'static' ? -1 : session.focus,
      showForces: view.forces,
      showVelocity: view.velocity,
      showAcceleration: view.acceleration,
      showTrail: view.trail,
      grab: session.grabbed(),
      selected: sandbox && !session.running ? editor.selected : undefined,
      overlay,
    };
    renderer.draw(frame, session.running && drag?.kind !== 'grab');
    dock.update(session);
    if (now - lastPanels > 120) {
      lastPanels = now;
      inspector.update(session, forces, state);
      answers.update(session, forces, state);
      refreshProperties();
    }
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- first world

  const shared = query.has('sandbox') ? ((await sceneFromUrl()) ?? loadSandbox() ?? JSON.stringify(emptySandbox() satisfies SceneFile)) : undefined;
  if (shared) openSandbox(shared);
  if (!shared || !(session as Session | undefined)) {
    const initial = catalogue.find((s) => s.id === query.get('scenario')) ?? catalogue[0]!;
    for (const p of initial.params) {
      const given = query.get(p.name);
      if (given !== null && Number.isFinite(Number(given))) values[p.name] = clamp(Number(given), limits(p).min, limits(p).max);
    }
    const given = { ...values };
    startScenario(initial, false);
    values = given;
    present();
  }
  if (import.meta.env.DEV) {
    // For driving the page from a test script: where a body is on screen.
    Object.assign(window, {
      solitonDebug: {
        screenOf: (label: string) => {
          const i = session.bodies.findIndex((b) => b.label === label);
          const state = session.world.state();
          const rect = canvas.getBoundingClientRect();
          const [x, y] = renderer.camera.toScreen(state[i * STATE_STRIDE]!, state[i * STATE_STRIDE + 1]!);
          return [rect.left + x, rect.top + y];
        },
      },
    });
  }
  requestAnimationFrame(loop);
}
