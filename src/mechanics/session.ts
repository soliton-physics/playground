import { MechanicsWorld } from '../engine';
import type { BodyInfo, EventInfo, ExactInfo, FinishInfo, GrabInfo, ScenarioSpec, View } from './types';

export type Source =
  | { kind: 'scenario'; spec: ScenarioSpec; params: Record<string, number> }
  | { kind: 'scene'; json: string };

/** What the hand did and on which step, so a run with grabbing in it replays exactly. */
type Input =
  | { step: number; kind: 'grab'; body: number; x: number; y: number }
  | { step: number; kind: 'drag'; x: number; y: number }
  | { step: number; kind: 'release' };

const MAX_STEPS_PER_FRAME = 4000;

/** One world and its clock: playing, stepping, scrubbing and the hand. */
export class Session {
  world!: MechanicsWorld;
  bodies: BodyInfo[] = [];
  view!: View;
  exact: ExactInfo[] = [];
  events: EventInfo[] = [];
  finishes: FinishInfo[] = [];
  title = '';
  /** The problem's time window, zero when the scene has none. */
  horizon = 0;
  dt = 1e-3;
  focus = 0;
  running = false;
  /** How fast the viewer asked for, as a multiple of the scene's own pace. */
  speed = 1;
  /** The scene's own pace: seconds of simulation per second of watching. One, except for scenes that take hours. */
  playback = 1;
  steps = 0;
  /** The furthest step this run has reached; the timeline can scrub up to here. */
  reached = 0;
  private inputs: Input[] = [];
  private accumulator = 0;

  constructor(readonly source: Source) {
    this.build();
    this.focus = this.world.focus();
  }

  private build(): void {
    const source = this.source;
    const make = (recordEvery: number) =>
      source.kind === 'scenario' ? new MechanicsWorld(source.spec.id, source.params, recordEvery) : MechanicsWorld.from_scene(source.json, recordEvery);
    // A sample every five thousandths of a second of watching. The scene has to be built to learn its time step
    // and its pace; when those ask for another interval it is built again.
    let recordEvery = 5;
    let world = make(recordEvery);
    const wanted = Math.max(1, Math.round((0.005 * world.playback()) / world.dt()));
    if (wanted !== recordEvery) {
      world.free();
      recordEvery = wanted;
      world = make(recordEvery);
    }
    this.playback = world.playback();
    this.world?.free();
    this.world = world;
    this.dt = world.dt();
    this.title = world.title();
    this.bodies = world.bodies() as BodyInfo[];
    this.view = world.view() as View;
    this.exact = world.exact() as ExactInfo[];
    this.horizon = world.horizon() ?? 0;
    this.events = world.events() as EventInfo[];
    this.finishes = [];
    this.steps = 0;
    this.accumulator = 0;
  }

  get time(): number {
    return this.world.time();
  }

  /** True once the hand has taken part: the run no longer follows from the scene alone. */
  get live(): boolean {
    return this.inputs.length > 0;
  }

  /** The end of the timeline: the problem's window, or however far the run has got. */
  get span(): number {
    return Math.max(this.horizon, this.reached * this.dt, this.playback);
  }

  /** Steps `count` times. With `stopAtFinish` it stops on the step the problem ends and returns true. */
  private run(count: number, stopAtFinish: boolean): boolean {
    let remaining = count;
    let ended = false;
    while (remaining > 0) {
      const finished = this.world.step(remaining);
      const now = Math.round(this.world.time() / this.dt);
      remaining -= now - this.steps;
      this.steps = now;
      if (!finished) break;
      const finish = this.world.finished() as FinishInfo | null;
      if (finish) this.finishes.push(finish);
      ended = true;
      if (stopAtFinish) break;
    }
    this.events.push(...(this.world.events() as EventInfo[]));
    return ended;
  }

  /** Playing on from an earlier point of the timeline starts a new future. */
  private branch(): void {
    if (this.steps >= this.reached) return;
    this.inputs = this.inputs.filter((input) => input.step < this.steps);
    this.reached = this.steps;
  }

  /** Runs the clock forward; true when the problem ended during this call, which is where the front end pauses. */
  advance(seconds: number): boolean {
    if (!this.running) return false;
    this.accumulator += seconds * this.speed * this.playback;
    const steps = Math.min(MAX_STEPS_PER_FRAME, Math.floor(this.accumulator / this.dt));
    if (steps === 0) return false;
    this.branch();
    const before = this.steps;
    const ended = this.run(steps, true);
    this.accumulator -= (this.steps - before) * this.dt;
    if (ended) this.accumulator = 0;
    this.reached = Math.max(this.reached, this.steps);
    return ended;
  }

  stepOnce(): void {
    this.branch();
    this.run(Math.max(1, Math.round((0.01 * this.playback) / this.dt)), true);
    this.reached = Math.max(this.reached, this.steps);
  }

  /** Moves the clock to `time` within what has been reached, replaying the run and the hand's part in it. */
  seek(time: number): void {
    const target = Math.max(0, Math.min(this.reached, Math.round(time / this.dt)));
    if (target === this.steps) return;
    let next = this.inputs.findIndex((input) => input.step >= this.steps);
    if (target < this.steps) {
      this.build();
      next = 0;
    }
    if (next < 0) next = this.inputs.length;
    while (this.steps < target) {
      const input = this.inputs[next];
      if (input && input.step <= this.steps) {
        this.apply(input);
        next++;
        continue;
      }
      const until = Math.min(target, input ? input.step : target);
      const before = this.steps;
      this.run(until - this.steps, false);
      if (this.steps === before) break;
    }
    this.world.release();
  }

  private apply(input: Input): void {
    if (input.kind === 'grab') this.world.grab(input.body, input.x, input.y);
    else if (input.kind === 'drag') this.world.drag_to(input.x, input.y);
    else this.world.release();
  }

  private act(input: Input): void {
    this.branch();
    this.inputs.push(input);
    this.apply(input);
  }

  grab(body: number, x: number, y: number): boolean {
    if (this.bodies[body]?.kind === 'static') return false;
    this.act({ step: this.steps, kind: 'grab', body, x, y });
    return true;
  }

  dragTo(x: number, y: number): void {
    this.act({ step: this.steps, kind: 'drag', x, y });
  }

  release(): void {
    this.act({ step: this.steps, kind: 'release' });
  }

  grabbed(): GrabInfo | null {
    return this.world.grabbed() as GrabInfo | null;
  }

  lastFinish(): FinishInfo | undefined {
    return this.finishes[this.finishes.length - 1];
  }

  describe(event: EventInfo): string {
    const name = (i: number) => this.bodies[i]?.label ?? `body ${i}`;
    // Name the body that moves first: "ball touches ground", never "ground touches ball".
    const [a, b] = this.bodies[event.bodies[0]!]?.kind === 'static' ? [event.bodies[1]!, event.bodies[0]!] : [event.bodies[0]!, event.bodies[1]!];
    switch (event.kind) {
      case 'contact_begin':
        return `${name(a)} touches ${name(b)}`;
      case 'contact_end':
        return `${name(a)} leaves ${name(b)}`;
      case 'friction_slip':
        return `${name(a)} starts sliding on ${name(b)}`;
      case 'friction_stick':
        return `${name(a)} stops sliding on ${name(b)}`;
      case 'rope_slack':
        return 'the string goes slack';
      case 'rope_taut':
        return 'the string becomes taut';
      default:
        return event.kind;
    }
  }

  dispose(): void {
    this.world.free();
  }
}
