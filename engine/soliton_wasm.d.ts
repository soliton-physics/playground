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
    drag_to(x: number, y: number): void;
    dt(): number;
    energy(): any;
    /**
     * Events since the previous call.
     */
    events(): any;
    exact(): any;
    /**
     * `{ time, reason }` once the problem has ended, otherwise `null`.
     */
    finished(): any;
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
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     */
    constructor(id: string, params: any, record_every: number);
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

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_mechanicsworld_free: (a: number, b: number) => void;
    readonly __wbg_wavesimulation_free: (a: number, b: number) => void;
    readonly mechanics_catalogue: () => [number, number, number];
    readonly mechanicsworld_bodies: (a: number) => [number, number, number];
    readonly mechanicsworld_body_at: (a: number, b: number, c: number, d: number) => number;
    readonly mechanicsworld_drag_to: (a: number, b: number, c: number) => void;
    readonly mechanicsworld_dt: (a: number) => number;
    readonly mechanicsworld_energy: (a: number) => [number, number, number];
    readonly mechanicsworld_events: (a: number) => [number, number, number];
    readonly mechanicsworld_exact: (a: number) => [number, number, number];
    readonly mechanicsworld_finished: (a: number) => [number, number, number];
    readonly mechanicsworld_focus: (a: number) => number;
    readonly mechanicsworld_forces: (a: number, b: number) => [number, number, number];
    readonly mechanicsworld_from_scene: (a: number, b: number, c: number) => [number, number, number];
    readonly mechanicsworld_grab: (a: number, b: number, c: number, d: number) => number;
    readonly mechanicsworld_grabbed: (a: number) => [number, number, number];
    readonly mechanicsworld_horizon: (a: number) => [number, number];
    readonly mechanicsworld_new: (a: number, b: number, c: any, d: number) => [number, number, number];
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
