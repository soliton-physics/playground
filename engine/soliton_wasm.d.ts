/* tslint:disable */
/* eslint-disable */

export class CircuitBench {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Moves time on by this many seconds of the circuit.
     */
    advance(seconds: number): void;
    /**
     * `steady`, `transient` or `alternating`.
     */
    analysis(): string;
    /**
     * `[{ name, value, measured }]`: the textbook's answers and what the solved circuit gives.
     */
    answers(): any;
    /**
     * How long a circuit followed in time runs for, s; zero for any other.
     */
    duration(): number;
    /**
     * True once a circuit followed in time has run its course.
     */
    finished(): boolean;
    /**
     * The frequency of the alternating sources, Hz; zero when there are none.
     */
    frequency(): number;
    static from_scene(json: string): CircuitBench;
    /**
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     */
    constructor(id: string, params: any);
    /**
     * The complex amplitudes of each component's alternating voltage and current, as
     * `Re V, Im V, Re I, Im I`; empty for a circuit not solved that way. Each quantity is the imaginary part
     * of its amplitude times `e^{iωt}`.
     */
    phasors(): Float64Array;
    /**
     * Seconds of the circuit to show in one second of watching.
     */
    playback(): number;
    /**
     * `voltage, current` for each component now: volts with its `a` above its `b`, amperes from `a` to `b`.
     */
    readings(): Float64Array;
    /**
     * The circuit as data: junctions and where they are drawn, components, how it is solved.
     */
    scene_json(): string;
    /**
     * One component's `voltage` or `current` at every step so far.
     */
    series(element: number, quantity: string): Float64Array;
    /**
     * The times of every step so far, for a circuit followed in time.
     */
    series_time(): Float64Array;
    time(): number;
    title(): string;
}

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

export class StatRun {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * One step is a sweep of the lattice, a batch of darts, or a step of every walker.
     */
    advance(steps: number): void;
    /**
     * `[{ name, value, measured, within }]`.
     */
    answers(): any;
    /**
     * The critical temperature of the square lattice, `2/ln(1 + √2)`.
     */
    static critical_temperature(): number;
    /**
     * The most recent darts as `x, y, inside` triples.
     */
    darts(): Float64Array;
    finished(): boolean;
    static from_scene(json: string): StatRun;
    /**
     * The thinned record for graphs, as `step, first, second` triples: magnetisation and energy for a
     * lattice, the estimate and its expected error for darts, the walkers' distance and `√steps` for a walk.
     */
    history(): Float64Array;
    /**
     * `ising`, `sweep`, `darts` or `walk`.
     */
    kind(): string;
    /**
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     */
    constructor(id: string, params: any);
    now(): any;
    /**
     * Onsager's exact results for an infinite lattice, at `count` temperatures from `from` to `to`, as
     * `temperature, magnetisation, energy` triples.
     */
    static onsager(from: number, to: number, count: number): Float64Array;
    /**
     * Steps to make in one second of watching.
     */
    playback(): number;
    /**
     * The temperatures a sweep has measured so far, as
     * `temperature, magnetisation, energy, specific heat, susceptibility` for each.
     */
    points(): Float64Array;
    scene_json(): string;
    /**
     * Spins along a side of the lattice; zero when there is none.
     */
    size(): number;
    /**
     * The spins row by row, each `+1` or `−1`.
     */
    spins(): Int8Array;
    title(): string;
    /**
     * Where each walker is, as `x, y` pairs in steps from the start.
     */
    walkers(): Int32Array;
}

export class ThermalGas {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Runs the gas on by this many picoseconds.
     */
    advance(picoseconds: number): void;
    /**
     * `[{ name, value, measured, tolerance }]`: the textbook's answers and what the gas gives so far.
     */
    answers(): any;
    /**
     * True once the last stage has ended, for a scene whose last stage has an end.
     */
    finished(): boolean;
    static from_scene(json: string): ThermalGas;
    /**
     * The kinds of molecule in the box, in the order of their species numbers.
     */
    groups(): any;
    /**
     * The pressure an ideal gas of this many molecules would have at this volume and temperature, atm.
     */
    ideal_pressure(): number;
    /**
     * Maxwell's distribution for a molecule of `mass` amu at `temperature` K: the probability density per
     * m/s at each of `points` speeds evenly spaced from zero to `fastest` m/s.
     */
    static maxwell(mass: number, temperature: number, points: number, fastest: number): Float64Array;
    /**
     * Every molecule as `x, y, z, radius, species`, in nm.
     */
    molecules(): Float64Array;
    /**
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     */
    constructor(id: string, params: any);
    /**
     * The state of the gas at this moment.
     */
    now(): any;
    /**
     * Where the partition stands along x, while there is one.
     */
    partition(): number | undefined;
    /**
     * Whether the piston is moving, and which way: +1 out, −1 in, 0 at rest.
     */
    piston(): number;
    /**
     * Picoseconds of the gas to show in one second of watching.
     */
    playback(): number;
    scene_json(): string;
    /**
     * The record kept once a picosecond, one quantity at a time: `time` (ps), `volume` (nm³), `pressure`
     * (atm), `temperature` (K), `work`, `heat`, `energy` (10⁻²¹ J).
     */
    series(quantity: string): Float64Array;
    /**
     * The share of one kind of molecule found in the left half of the box, at each sample of the record.
     */
    series_share(species: number): Float64Array;
    /**
     * The box as it is now, `[x, y, z]` in nm; x is where the piston stands.
     */
    size(): Float64Array;
    /**
     * How one kind of molecule is spread over speed from zero to `fastest` m/s, as a probability density per
     * m/s in `bins` equal steps. A negative `species` takes every kind together.
     */
    speed_histogram(species: number, bins: number, fastest: number): Float64Array;
    /**
     * The stage in progress and what it is called.
     */
    stage(): number;
    stage_count(): number;
    stage_label(): string;
    title(): string;
    /**
     * The temperature each wall is held at, in K, in the order low x, high x, low y, high y, low z, high z;
     * `NaN` for a wall that is insulated.
     */
    walls(): Float64Array;
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
 * The circuit scenarios with their parameter schemas.
 */
export function circuits_catalogue(): any;

/**
 * The scenario catalogue with parameter schemas, for building the picker and the sliders.
 */
export function mechanics_catalogue(): any;

/**
 * The optics scenarios with their parameter schemas.
 */
export function optics_catalogue(): any;

/**
 * The statistical scenarios with their parameter schemas.
 */
export function statmech_catalogue(): any;

/**
 * The thermal scenarios with their parameter schemas.
 */
export function thermal_catalogue(): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_circuitbench_free: (a: number, b: number) => void;
    readonly __wbg_mechanicsworld_free: (a: number, b: number) => void;
    readonly __wbg_opticsbench_free: (a: number, b: number) => void;
    readonly __wbg_statrun_free: (a: number, b: number) => void;
    readonly __wbg_thermalgas_free: (a: number, b: number) => void;
    readonly __wbg_wavesimulation_free: (a: number, b: number) => void;
    readonly circuitbench_advance: (a: number, b: number) => [number, number];
    readonly circuitbench_analysis: (a: number) => [number, number];
    readonly circuitbench_answers: (a: number) => [number, number, number];
    readonly circuitbench_duration: (a: number) => number;
    readonly circuitbench_finished: (a: number) => number;
    readonly circuitbench_frequency: (a: number) => number;
    readonly circuitbench_from_scene: (a: number, b: number) => [number, number, number];
    readonly circuitbench_new: (a: number, b: number, c: any) => [number, number, number];
    readonly circuitbench_phasors: (a: number) => any;
    readonly circuitbench_playback: (a: number) => number;
    readonly circuitbench_readings: (a: number) => any;
    readonly circuitbench_scene_json: (a: number) => [number, number];
    readonly circuitbench_series: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly circuitbench_series_time: (a: number) => any;
    readonly circuitbench_time: (a: number) => number;
    readonly circuitbench_title: (a: number) => [number, number];
    readonly circuits_catalogue: () => [number, number, number];
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
    readonly statmech_catalogue: () => [number, number, number];
    readonly statrun_advance: (a: number, b: number) => void;
    readonly statrun_answers: (a: number) => [number, number, number];
    readonly statrun_critical_temperature: () => number;
    readonly statrun_darts: (a: number) => any;
    readonly statrun_finished: (a: number) => number;
    readonly statrun_from_scene: (a: number, b: number) => [number, number, number];
    readonly statrun_history: (a: number) => any;
    readonly statrun_kind: (a: number) => [number, number];
    readonly statrun_new: (a: number, b: number, c: any) => [number, number, number];
    readonly statrun_now: (a: number) => [number, number, number];
    readonly statrun_onsager: (a: number, b: number, c: number) => any;
    readonly statrun_playback: (a: number) => number;
    readonly statrun_points: (a: number) => any;
    readonly statrun_scene_json: (a: number) => [number, number];
    readonly statrun_size: (a: number) => number;
    readonly statrun_spins: (a: number) => any;
    readonly statrun_title: (a: number) => [number, number];
    readonly statrun_walkers: (a: number) => any;
    readonly thermal_catalogue: () => [number, number, number];
    readonly thermalgas_advance: (a: number, b: number) => void;
    readonly thermalgas_answers: (a: number) => [number, number, number];
    readonly thermalgas_finished: (a: number) => number;
    readonly thermalgas_from_scene: (a: number, b: number) => [number, number, number];
    readonly thermalgas_groups: (a: number) => [number, number, number];
    readonly thermalgas_ideal_pressure: (a: number) => number;
    readonly thermalgas_maxwell: (a: number, b: number, c: number, d: number) => any;
    readonly thermalgas_molecules: (a: number) => any;
    readonly thermalgas_new: (a: number, b: number, c: any) => [number, number, number];
    readonly thermalgas_now: (a: number) => [number, number, number];
    readonly thermalgas_partition: (a: number) => [number, number];
    readonly thermalgas_piston: (a: number) => number;
    readonly thermalgas_playback: (a: number) => number;
    readonly thermalgas_scene_json: (a: number) => [number, number];
    readonly thermalgas_series: (a: number, b: number, c: number) => [number, number, number];
    readonly thermalgas_series_share: (a: number, b: number) => any;
    readonly thermalgas_size: (a: number) => any;
    readonly thermalgas_speed_histogram: (a: number, b: number, c: number, d: number) => any;
    readonly thermalgas_stage: (a: number) => number;
    readonly thermalgas_stage_count: (a: number) => number;
    readonly thermalgas_stage_label: (a: number) => [number, number];
    readonly thermalgas_title: (a: number) => [number, number];
    readonly thermalgas_walls: (a: number) => any;
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
