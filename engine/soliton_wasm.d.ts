/* tslint:disable */
/* eslint-disable */

/**
 * A running mechanics scenario, built from the catalogue with chosen parameters.
 */
export class MechanicsWorld {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Static description of every body: label, kind, mass, shape.
     */
    bodies(): any;
    /**
     * The movable body under a world point, or the nearest one within `slop` metres.
     */
    body_at(x: number, y: number, slop: number): number | undefined;
    /**
     * The fixed wires, sheets and shells of charge in the scene, for drawing.
     */
    distributions(): any;
    drag_to(x: number, y: number): void;
    dt(): number;
    energy(): any;
    /**
     * Events since the previous call.
     */
    events(): any;
    exact(): any;
    /**
     * `[Ex, Ey, V, Bz, Bx, By]` at a point: electric field in N/C, potential in volts, magnetic field out of
     * the page and then in the plane, in tesla. The potential leaves out any field that has none (one held
     * between plates, or alternating).
     */
    field_at(x: number, y: number): Float64Array;
    /**
     * Field lines of the charges, `per_charge` from the largest, followed until they end on a charge or run
     * `reach` from `(cx, cy)`. Points as `x, y` pairs, each line closed by a pair of `NaN`s.
     */
    field_lines(per_charge: number, cx: number, cy: number, reach: number): Float64Array;
    /**
     * The same at the centre of a body, leaving out the field of the body's own magnet: what a compass or a
     * sample placed there is in.
     */
    field_on(body: number): Float64Array;
    /**
     * The uniform electric and magnetic fields in the scene, for drawing.
     */
    fields(): any;
    /**
     * `{ time, reason }` once the problem has ended, otherwise `null`.
     */
    finished(): any;
    /**
     * `[Bx, By]` in tesla at a point, of the fixed magnets and the background alone: the field a compass put
     * there would line up with.
     */
    fixed_field_at(x: number, y: number): Float64Array;
    /**
     * The electric flux out of a sphere centred at `(cx, cy)` in the page, N·m²/C, summed over its surface.
     */
    flux_through(cx: number, cy: number, radius: number): number;
    focus(): number;
    /**
     * The free-body diagram of one body at the current state.
     */
    forces(body: number): any;
    /**
     * Builds a world from scene JSON (design 004).
     */
    static from_scene(json: string, record_every: number): MechanicsWorld;
    /**
     * Takes hold of a body at a world point (design 008). From now until `release`, a spring pulls that point
     * towards wherever `drag_to` last put the hand. Returns false for a body that cannot be moved.
     */
    grab(body: number, x: number, y: number): boolean;
    /**
     * The held body and where the hand is, as `{ body, point: [x, y], target: [x, y] }`, or `null`.
     */
    grabbed(): any;
    /**
     * The problem's time window, when the scene has one.
     */
    horizon(): number | undefined;
    /**
     * Lines of the magnetic field of the fixed bar magnets, from north poles round to south, in the same form.
     */
    magnetic_field_lines(per_pole: number, cx: number, cy: number, reach: number): Float64Array;
    /**
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     */
    constructor(id: string, params: any, record_every: number);
    /**
     * Seconds of the simulation to show per second of watching; one unless the scene says otherwise.
     */
    playback(): number;
    release(): void;
    /**
     * The scene this world was built from, as JSON.
     */
    scene_json(): string;
    /**
     * The scene as it stands now, as JSON: current positions and velocities, lengths written out, times counted
     * from this moment. Loading it carries on from here.
     */
    scene_json_now(): string;
    /**
     * A recorded quantity of one body: `x`, `y`, `vx`, `vy`, `speed`, `ax`, `ay`, `angle`, `omega`.
     */
    series(body: number, quantity: string): Float64Array;
    /**
     * Recorded energy ledger: `kinetic`, `potential`, `dissipated`, `external_work`, `conserved`.
     */
    series_energy(quantity: string): Float64Array;
    /**
     * The recorded net force with `label` on one body, as `[fx, fy]` pairs flattened.
     */
    series_force(body: number, label: string): Float64Array;
    series_time(): Float64Array;
    /**
     * Ropes, pulleys, rods, springs and pivots at the current state.
     */
    sketches(): any;
    /**
     * `[x, y, angle, vx, vy, omega, ax, ay]` per body, flattened.
     */
    state(): Float64Array;
    /**
     * Steps, stopping early the moment the problem ends so a front end can pause exactly there.
     * Returns true when this call reached the end; later calls carry on past it, and stop once more if
     * everything then comes to rest.
     */
    step(steps: number): boolean;
    time(): number;
    title(): string;
    view(): any;
}

export class OpticsBench {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * `[{ name, value, measured }]`: the textbook's answer and what the traced rays give.
     */
    answers(): any;
    /**
     * Two points on the principal axis, or `undefined`.
     */
    axis(): any;
    elements(): any;
    static from_scene(json: string): OpticsBench;
    /**
     * The refractive index at a point.
     */
    index_at(x: number, y: number): number;
    /**
     * Named points: `[{ at, label }]`.
     */
    marks(): any;
    /**
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     */
    constructor(id: string, params: any);
    /**
     * Each object with its paraxial image.
     */
    objects(): any;
    rays(): any;
    scene_json(): string;
    title(): string;
    /**
     * `{ center, half_width, half_height }`, or `undefined` for a scene that suggests none.
     */
    view(): any;
}

/**
 * A running simulation of one of the supported wave equations.
 */
export class WaveSimulation {
    free(): void;
    [Symbol.dispose](): void;
    add_kdv_soliton(speed: number, center: number): void;
    add_nls_soliton(amplitude: number, velocity: number, center: number): void;
    clear(): void;
    dt(): number;
    imag(): Float64Array;
    /**
     * Conserved quantities as a plain `{ name: value }` object.
     */
    invariants(): object;
    length(): number;
    magnitude(): Float64Array;
    /**
     * `model` is `"kdv"` or `"nls"`.
     */
    constructor(model: string, points: number, length: number, dt: number);
    points(): number;
    positions(): Float64Array;
    real(): Float64Array;
    /**
     * Sets the state from interleaved-free real and imaginary arrays.
     */
    set_state(re: Float64Array | number[], im: Float64Array | number[]): void;
    step(steps: number): void;
    time(): number;
}

/**
 * The scenario catalogue with parameter schemas, for building the picker and the sliders.
 */
export function mechanics_catalogue(): any;

/**
 * The optics scenarios with their parameter schemas.
 */
export function optics_catalogue(): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_mechanicsworld_free: (a: number, b: number) => void;
    readonly __wbg_opticsbench_free: (a: number, b: number) => void;
    readonly __wbg_wavesimulation_free: (a: number, b: number) => void;
    readonly mechanics_catalogue: () => [number, number, number];
    readonly mechanicsworld_bodies: (a: number) => [number, number, number];
    readonly mechanicsworld_body_at: (a: number, b: number, c: number, d: number) => number;
    readonly mechanicsworld_distributions: (a: number) => [number, number, number];
    readonly mechanicsworld_drag_to: (a: number, b: number, c: number) => void;
    readonly mechanicsworld_dt: (a: number) => number;
    readonly mechanicsworld_energy: (a: number) => [number, number, number];
    readonly mechanicsworld_events: (a: number) => [number, number, number];
    readonly mechanicsworld_exact: (a: number) => [number, number, number];
    readonly mechanicsworld_field_at: (a: number, b: number, c: number) => any;
    readonly mechanicsworld_field_lines: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly mechanicsworld_field_on: (a: number, b: number) => any;
    readonly mechanicsworld_fields: (a: number) => [number, number, number];
    readonly mechanicsworld_finished: (a: number) => [number, number, number];
    readonly mechanicsworld_fixed_field_at: (a: number, b: number, c: number) => any;
    readonly mechanicsworld_flux_through: (a: number, b: number, c: number, d: number) => number;
    readonly mechanicsworld_focus: (a: number) => number;
    readonly mechanicsworld_forces: (a: number, b: number) => [number, number, number];
    readonly mechanicsworld_from_scene: (a: number, b: number, c: number) => [number, number, number];
    readonly mechanicsworld_grab: (a: number, b: number, c: number, d: number) => number;
    readonly mechanicsworld_grabbed: (a: number) => [number, number, number];
    readonly mechanicsworld_horizon: (a: number) => [number, number];
    readonly mechanicsworld_magnetic_field_lines: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly mechanicsworld_new: (a: number, b: number, c: any, d: number) => [number, number, number];
    readonly mechanicsworld_playback: (a: number) => number;
    readonly mechanicsworld_release: (a: number) => void;
    readonly mechanicsworld_scene_json: (a: number) => [number, number];
    readonly mechanicsworld_scene_json_now: (a: number) => [number, number, number, number];
    readonly mechanicsworld_series: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly mechanicsworld_series_energy: (a: number, b: number, c: number) => [number, number, number];
    readonly mechanicsworld_series_force: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly mechanicsworld_series_time: (a: number) => any;
    readonly mechanicsworld_sketches: (a: number) => [number, number, number];
    readonly mechanicsworld_state: (a: number) => any;
    readonly mechanicsworld_step: (a: number, b: number) => number;
    readonly mechanicsworld_time: (a: number) => number;
    readonly mechanicsworld_title: (a: number) => [number, number];
    readonly mechanicsworld_view: (a: number) => [number, number, number];
    readonly optics_catalogue: () => [number, number, number];
    readonly opticsbench_answers: (a: number) => [number, number, number];
    readonly opticsbench_axis: (a: number) => [number, number, number];
    readonly opticsbench_elements: (a: number) => [number, number, number];
    readonly opticsbench_from_scene: (a: number, b: number) => [number, number, number];
    readonly opticsbench_index_at: (a: number, b: number, c: number) => number;
    readonly opticsbench_marks: (a: number) => [number, number, number];
    readonly opticsbench_new: (a: number, b: number, c: any) => [number, number, number];
    readonly opticsbench_objects: (a: number) => [number, number, number];
    readonly opticsbench_rays: (a: number) => [number, number, number];
    readonly opticsbench_scene_json: (a: number) => [number, number];
    readonly opticsbench_title: (a: number) => [number, number];
    readonly opticsbench_view: (a: number) => [number, number, number];
    readonly wavesimulation_add_kdv_soliton: (a: number, b: number, c: number) => void;
    readonly wavesimulation_add_nls_soliton: (a: number, b: number, c: number, d: number) => void;
    readonly wavesimulation_clear: (a: number) => void;
    readonly wavesimulation_dt: (a: number) => number;
    readonly wavesimulation_imag: (a: number) => any;
    readonly wavesimulation_invariants: (a: number) => any;
    readonly wavesimulation_length: (a: number) => number;
    readonly wavesimulation_magnitude: (a: number) => any;
    readonly wavesimulation_new: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wavesimulation_points: (a: number) => number;
    readonly wavesimulation_positions: (a: number) => any;
    readonly wavesimulation_real: (a: number) => any;
    readonly wavesimulation_set_state: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly wavesimulation_step: (a: number, b: number) => void;
    readonly wavesimulation_time: (a: number) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
