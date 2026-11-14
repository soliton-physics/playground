/* @ts-self-types="./soliton_wasm.d.ts" */

export class CircuitBench {
    static __wrap(ptr) {
        const obj = Object.create(CircuitBench.prototype);
        obj.__wbg_ptr = ptr;
        CircuitBenchFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CircuitBenchFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_circuitbench_free(ptr, 0);
    }
    /**
     * Moves time on by this many seconds of the circuit.
     * @param {number} seconds
     */
    advance(seconds) {
        const ret = wasm.circuitbench_advance(this.__wbg_ptr, seconds);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * `steady`, `transient` or `alternating`.
     * @returns {string}
     */
    analysis() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.circuitbench_analysis(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * `[{ name, value, measured }]`: the textbook's answers and what the solved circuit gives.
     * @returns {any}
     */
    answers() {
        const ret = wasm.circuitbench_answers(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * How long a circuit followed in time runs for, s; zero for any other.
     * @returns {number}
     */
    duration() {
        const ret = wasm.circuitbench_duration(this.__wbg_ptr);
        return ret;
    }
    /**
     * True once a circuit followed in time has run its course.
     * @returns {boolean}
     */
    finished() {
        const ret = wasm.circuitbench_finished(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * The frequency of the alternating sources, Hz; zero when there are none.
     * @returns {number}
     */
    frequency() {
        const ret = wasm.circuitbench_frequency(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string} json
     * @returns {CircuitBench}
     */
    static from_scene(json) {
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.circuitbench_from_scene(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return CircuitBench.__wrap(ret[0]);
    }
    /**
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     * @param {string} id
     * @param {any} params
     */
    constructor(id, params) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.circuitbench_new(ptr0, len0, params);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        CircuitBenchFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * The complex amplitudes of each component's alternating voltage and current, as
     * `Re V, Im V, Re I, Im I`; empty for a circuit not solved that way. Each quantity is the imaginary part
     * of its amplitude times `e^{iωt}`.
     * @returns {Float64Array}
     */
    phasors() {
        const ret = wasm.circuitbench_phasors(this.__wbg_ptr);
        return ret;
    }
    /**
     * Seconds of the circuit to show in one second of watching.
     * @returns {number}
     */
    playback() {
        const ret = wasm.circuitbench_playback(this.__wbg_ptr);
        return ret;
    }
    /**
     * `voltage, current` for each component now: volts with its `a` above its `b`, amperes from `a` to `b`.
     * @returns {Float64Array}
     */
    readings() {
        const ret = wasm.circuitbench_readings(this.__wbg_ptr);
        return ret;
    }
    /**
     * The circuit as data: junctions and where they are drawn, components, how it is solved.
     * @returns {string}
     */
    scene_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.circuitbench_scene_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * One component's `voltage` or `current` at every step so far.
     * @param {number} element
     * @param {string} quantity
     * @returns {Float64Array}
     */
    series(element, quantity) {
        const val2 = +element;
        const ptr0 = passStringToWasm0(quantity, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.circuitbench_series(this.__wbg_ptr, val2, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * The times of every step so far, for a circuit followed in time.
     * @returns {Float64Array}
     */
    series_time() {
        const ret = wasm.circuitbench_series_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    time() {
        const ret = wasm.circuitbench_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    title() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.circuitbench_title(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) CircuitBench.prototype[Symbol.dispose] = CircuitBench.prototype.free;

/**
 * A running mechanics scenario, built from the catalogue with chosen parameters.
 */
export class MechanicsWorld {
    static __wrap(ptr) {
        const obj = Object.create(MechanicsWorld.prototype);
        obj.__wbg_ptr = ptr;
        MechanicsWorldFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MechanicsWorldFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_mechanicsworld_free(ptr, 0);
    }
    /**
     * Static description of every body: label, kind, mass, shape.
     * @returns {any}
     */
    bodies() {
        const ret = wasm.mechanicsworld_bodies(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * The movable body under a world point, or the nearest one within `slop` metres.
     * @param {number} x
     * @param {number} y
     * @param {number} slop
     * @returns {number | undefined}
     */
    body_at(x, y, slop) {
        const ret = wasm.mechanicsworld_body_at(this.__wbg_ptr, x, y, slop);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * The fixed wires, sheets and shells of charge in the scene, for drawing.
     * @returns {any}
     */
    distributions() {
        const ret = wasm.mechanicsworld_distributions(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {number} x
     * @param {number} y
     */
    drag_to(x, y) {
        wasm.mechanicsworld_drag_to(this.__wbg_ptr, x, y);
    }
    /**
     * @returns {number}
     */
    dt() {
        const ret = wasm.mechanicsworld_dt(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {any}
     */
    energy() {
        const ret = wasm.mechanicsworld_energy(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Events since the previous call.
     * @returns {any}
     */
    events() {
        const ret = wasm.mechanicsworld_events(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {any}
     */
    exact() {
        const ret = wasm.mechanicsworld_exact(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * `[Ex, Ey, V, Bz, Bx, By]` at a point: electric field in N/C, potential in volts, magnetic field out of
     * the page and then in the plane, in tesla. The potential leaves out any field that has none (one held
     * between plates, or alternating).
     * @param {number} x
     * @param {number} y
     * @returns {Float64Array}
     */
    field_at(x, y) {
        const ret = wasm.mechanicsworld_field_at(this.__wbg_ptr, x, y);
        return ret;
    }
    /**
     * Field lines of the charges, `per_charge` from the largest, followed until they end on a charge or run
     * `reach` from `(cx, cy)`. Points as `x, y` pairs, each line closed by a pair of `NaN`s.
     * @param {number} per_charge
     * @param {number} cx
     * @param {number} cy
     * @param {number} reach
     * @returns {Float64Array}
     */
    field_lines(per_charge, cx, cy, reach) {
        const ret = wasm.mechanicsworld_field_lines(this.__wbg_ptr, per_charge, cx, cy, reach);
        return ret;
    }
    /**
     * The same at the centre of a body, leaving out the field of the body's own magnet: what a compass or a
     * sample placed there is in.
     * @param {number} body
     * @returns {Float64Array}
     */
    field_on(body) {
        const ret = wasm.mechanicsworld_field_on(this.__wbg_ptr, body);
        return ret;
    }
    /**
     * The uniform electric and magnetic fields in the scene, for drawing.
     * @returns {any}
     */
    fields() {
        const ret = wasm.mechanicsworld_fields(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * `{ time, reason }` once the problem has ended, otherwise `null`.
     * @returns {any}
     */
    finished() {
        const ret = wasm.mechanicsworld_finished(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * `[Bx, By]` in tesla at a point, of the fixed magnets and the background alone: the field a compass put
     * there would line up with.
     * @param {number} x
     * @param {number} y
     * @returns {Float64Array}
     */
    fixed_field_at(x, y) {
        const ret = wasm.mechanicsworld_fixed_field_at(this.__wbg_ptr, x, y);
        return ret;
    }
    /**
     * The electric flux out of a sphere centred at `(cx, cy)` in the page, N·m²/C, summed over its surface.
     * @param {number} cx
     * @param {number} cy
     * @param {number} radius
     * @returns {number}
     */
    flux_through(cx, cy, radius) {
        const ret = wasm.mechanicsworld_flux_through(this.__wbg_ptr, cx, cy, radius);
        return ret;
    }
    /**
     * @returns {number}
     */
    focus() {
        const ret = wasm.mechanicsworld_focus(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * The free-body diagram of one body at the current state.
     * @param {number} body
     * @returns {any}
     */
    forces(body) {
        const ret = wasm.mechanicsworld_forces(this.__wbg_ptr, body);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Builds a world from scene JSON (design 004).
     * @param {string} json
     * @param {number} record_every
     * @returns {MechanicsWorld}
     */
    static from_scene(json, record_every) {
        const val2 = +record_every;
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mechanicsworld_from_scene(ptr0, len0, val2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return MechanicsWorld.__wrap(ret[0]);
    }
    /**
     * Takes hold of a body at a world point (design 008). From now until `release`, a spring pulls that point
     * towards wherever `drag_to` last put the hand. Returns false for a body that cannot be moved.
     * @param {number} body
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    grab(body, x, y) {
        const ret = wasm.mechanicsworld_grab(this.__wbg_ptr, body, x, y);
        return ret !== 0;
    }
    /**
     * The held body and where the hand is, as `{ body, point: [x, y], target: [x, y] }`, or `null`.
     * @returns {any}
     */
    grabbed() {
        const ret = wasm.mechanicsworld_grabbed(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * The problem's time window, when the scene has one.
     * @returns {number | undefined}
     */
    horizon() {
        const ret = wasm.mechanicsworld_horizon(this.__wbg_ptr);
        return ret[0] === 0 ? undefined : ret[1];
    }
    /**
     * Lines of the magnetic field of the fixed bar magnets, from north poles round to south, in the same form.
     * @param {number} per_pole
     * @param {number} cx
     * @param {number} cy
     * @param {number} reach
     * @returns {Float64Array}
     */
    magnetic_field_lines(per_pole, cx, cy, reach) {
        const ret = wasm.mechanicsworld_magnetic_field_lines(this.__wbg_ptr, per_pole, cx, cy, reach);
        return ret;
    }
    /**
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     * @param {string} id
     * @param {any} params
     * @param {number} record_every
     */
    constructor(id, params, record_every) {
        const val2 = +record_every;
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mechanicsworld_new(ptr0, len0, params, val2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        MechanicsWorldFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Seconds of the simulation to show per second of watching; one unless the scene says otherwise.
     * @returns {number}
     */
    playback() {
        const ret = wasm.mechanicsworld_playback(this.__wbg_ptr);
        return ret;
    }
    release() {
        wasm.mechanicsworld_release(this.__wbg_ptr);
    }
    /**
     * The scene this world was built from, as JSON.
     * @returns {string}
     */
    scene_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.mechanicsworld_scene_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * The scene as it stands now, as JSON: current positions and velocities, lengths written out, times counted
     * from this moment. Loading it carries on from here.
     * @returns {string}
     */
    scene_json_now() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.mechanicsworld_scene_json_now(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * A recorded quantity of one body: `x`, `y`, `vx`, `vy`, `speed`, `ax`, `ay`, `angle`, `omega`.
     * @param {number} body
     * @param {string} quantity
     * @returns {Float64Array}
     */
    series(body, quantity) {
        const val2 = +body;
        const ptr0 = passStringToWasm0(quantity, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mechanicsworld_series(this.__wbg_ptr, val2, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Recorded energy ledger: `kinetic`, `potential`, `dissipated`, `external_work`, `conserved`.
     * @param {string} quantity
     * @returns {Float64Array}
     */
    series_energy(quantity) {
        const ptr0 = passStringToWasm0(quantity, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mechanicsworld_series_energy(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * The recorded net force with `label` on one body, as `[fx, fy]` pairs flattened.
     * @param {number} body
     * @param {string} label
     * @returns {Float64Array}
     */
    series_force(body, label) {
        const val2 = +body;
        const ptr0 = passStringToWasm0(label, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mechanicsworld_series_force(this.__wbg_ptr, val2, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {Float64Array}
     */
    series_time() {
        const ret = wasm.mechanicsworld_series_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * Ropes, pulleys, rods, springs and pivots at the current state.
     * @returns {any}
     */
    sketches() {
        const ret = wasm.mechanicsworld_sketches(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * `[x, y, angle, vx, vy, omega, ax, ay]` per body, flattened.
     * @returns {Float64Array}
     */
    state() {
        const ret = wasm.mechanicsworld_state(this.__wbg_ptr);
        return ret;
    }
    /**
     * Steps, stopping early the moment the problem ends so a front end can pause exactly there.
     * Returns true when this call reached the end; later calls carry on past it, and stop once more if
     * everything then comes to rest.
     * @param {number} steps
     * @returns {boolean}
     */
    step(steps) {
        const ret = wasm.mechanicsworld_step(this.__wbg_ptr, steps);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    time() {
        const ret = wasm.mechanicsworld_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    title() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.mechanicsworld_title(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {any}
     */
    view() {
        const ret = wasm.mechanicsworld_view(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
}
if (Symbol.dispose) MechanicsWorld.prototype[Symbol.dispose] = MechanicsWorld.prototype.free;

export class OpticsBench {
    static __wrap(ptr) {
        const obj = Object.create(OpticsBench.prototype);
        obj.__wbg_ptr = ptr;
        OpticsBenchFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OpticsBenchFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_opticsbench_free(ptr, 0);
    }
    /**
     * `[{ name, value, measured }]`: the textbook's answer and what the traced rays give.
     * @returns {any}
     */
    answers() {
        const ret = wasm.opticsbench_answers(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Two points on the principal axis, or `undefined`.
     * @returns {any}
     */
    axis() {
        const ret = wasm.opticsbench_axis(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {any}
     */
    elements() {
        const ret = wasm.opticsbench_elements(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {string} json
     * @returns {OpticsBench}
     */
    static from_scene(json) {
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.opticsbench_from_scene(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return OpticsBench.__wrap(ret[0]);
    }
    /**
     * The refractive index at a point.
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    index_at(x, y) {
        const ret = wasm.opticsbench_index_at(this.__wbg_ptr, x, y);
        return ret;
    }
    /**
     * Named points: `[{ at, label }]`.
     * @returns {any}
     */
    marks() {
        const ret = wasm.opticsbench_marks(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     * @param {string} id
     * @param {any} params
     */
    constructor(id, params) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.opticsbench_new(ptr0, len0, params);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        OpticsBenchFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Each object with its paraxial image.
     * @returns {any}
     */
    objects() {
        const ret = wasm.opticsbench_objects(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {any}
     */
    rays() {
        const ret = wasm.opticsbench_rays(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {string}
     */
    scene_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.opticsbench_scene_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    title() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.opticsbench_title(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * `{ center, half_width, half_height }`, or `undefined` for a scene that suggests none.
     * @returns {any}
     */
    view() {
        const ret = wasm.opticsbench_view(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
}
if (Symbol.dispose) OpticsBench.prototype[Symbol.dispose] = OpticsBench.prototype.free;

export class StatRun {
    static __wrap(ptr) {
        const obj = Object.create(StatRun.prototype);
        obj.__wbg_ptr = ptr;
        StatRunFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StatRunFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_statrun_free(ptr, 0);
    }
    /**
     * One step is a sweep of the lattice, a batch of darts, or a step of every walker.
     * @param {number} steps
     */
    advance(steps) {
        wasm.statrun_advance(this.__wbg_ptr, steps);
    }
    /**
     * `[{ name, value, measured, within }]`.
     * @returns {any}
     */
    answers() {
        const ret = wasm.statrun_answers(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * The critical temperature of the square lattice, `2/ln(1 + √2)`.
     * @returns {number}
     */
    static critical_temperature() {
        const ret = wasm.statrun_critical_temperature();
        return ret;
    }
    /**
     * The most recent darts as `x, y, inside` triples.
     * @returns {Float64Array}
     */
    darts() {
        const ret = wasm.statrun_darts(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {boolean}
     */
    finished() {
        const ret = wasm.statrun_finished(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {string} json
     * @returns {StatRun}
     */
    static from_scene(json) {
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.statrun_from_scene(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return StatRun.__wrap(ret[0]);
    }
    /**
     * The thinned record for graphs, as `step, first, second` triples: magnetisation and energy for a
     * lattice, the estimate and its expected error for darts, the walkers' distance and `√steps` for a walk.
     * @returns {Float64Array}
     */
    history() {
        const ret = wasm.statrun_history(this.__wbg_ptr);
        return ret;
    }
    /**
     * `ising`, `sweep`, `darts` or `walk`.
     * @returns {string}
     */
    kind() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.statrun_kind(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     * @param {string} id
     * @param {any} params
     */
    constructor(id, params) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.statrun_new(ptr0, len0, params);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        StatRunFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {any}
     */
    now() {
        const ret = wasm.statrun_now(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Onsager's exact results for an infinite lattice, at `count` temperatures from `from` to `to`, as
     * `temperature, magnetisation, energy` triples.
     * @param {number} from
     * @param {number} to
     * @param {number} count
     * @returns {Float64Array}
     */
    static onsager(from, to, count) {
        const ret = wasm.statrun_onsager(from, to, count);
        return ret;
    }
    /**
     * Steps to make in one second of watching.
     * @returns {number}
     */
    playback() {
        const ret = wasm.statrun_playback(this.__wbg_ptr);
        return ret;
    }
    /**
     * The temperatures a sweep has measured so far, as
     * `temperature, magnetisation, energy, specific heat, susceptibility` for each.
     * @returns {Float64Array}
     */
    points() {
        const ret = wasm.statrun_points(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    scene_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.statrun_scene_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Spins along a side of the lattice; zero when there is none.
     * @returns {number}
     */
    size() {
        const ret = wasm.statrun_size(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * The spins row by row, each `+1` or `−1`.
     * @returns {Int8Array}
     */
    spins() {
        const ret = wasm.statrun_spins(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    title() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.statrun_title(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Where each walker is, as `x, y` pairs in steps from the start.
     * @returns {Int32Array}
     */
    walkers() {
        const ret = wasm.statrun_walkers(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) StatRun.prototype[Symbol.dispose] = StatRun.prototype.free;

export class ThermalGas {
    static __wrap(ptr) {
        const obj = Object.create(ThermalGas.prototype);
        obj.__wbg_ptr = ptr;
        ThermalGasFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ThermalGasFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_thermalgas_free(ptr, 0);
    }
    /**
     * Runs the gas on by this many picoseconds.
     * @param {number} picoseconds
     */
    advance(picoseconds) {
        wasm.thermalgas_advance(this.__wbg_ptr, picoseconds);
    }
    /**
     * `[{ name, value, measured, tolerance }]`: the textbook's answers and what the gas gives so far.
     * @returns {any}
     */
    answers() {
        const ret = wasm.thermalgas_answers(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * True once the last stage has ended, for a scene whose last stage has an end.
     * @returns {boolean}
     */
    finished() {
        const ret = wasm.thermalgas_finished(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {string} json
     * @returns {ThermalGas}
     */
    static from_scene(json) {
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.thermalgas_from_scene(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ThermalGas.__wrap(ret[0]);
    }
    /**
     * The kinds of molecule in the box, in the order of their species numbers.
     * @returns {any}
     */
    groups() {
        const ret = wasm.thermalgas_groups(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * The pressure an ideal gas of this many molecules would have at this volume and temperature, atm.
     * @returns {number}
     */
    ideal_pressure() {
        const ret = wasm.thermalgas_ideal_pressure(this.__wbg_ptr);
        return ret;
    }
    /**
     * Maxwell's distribution for a molecule of `mass` amu at `temperature` K: the probability density per
     * m/s at each of `points` speeds evenly spaced from zero to `fastest` m/s.
     * @param {number} mass
     * @param {number} temperature
     * @param {number} points
     * @param {number} fastest
     * @returns {Float64Array}
     */
    static maxwell(mass, temperature, points, fastest) {
        const ret = wasm.thermalgas_maxwell(mass, temperature, points, fastest);
        return ret;
    }
    /**
     * Every molecule as `x, y, z, radius, species`, in nm.
     * @returns {Float64Array}
     */
    molecules() {
        const ret = wasm.thermalgas_molecules(this.__wbg_ptr);
        return ret;
    }
    /**
     * `params` is a plain object `{ name: value }`; missing entries take the scenario defaults.
     * @param {string} id
     * @param {any} params
     */
    constructor(id, params) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.thermalgas_new(ptr0, len0, params);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        ThermalGasFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * The state of the gas at this moment.
     * @returns {any}
     */
    now() {
        const ret = wasm.thermalgas_now(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Where the partition stands along x, while there is one.
     * @returns {number | undefined}
     */
    partition() {
        const ret = wasm.thermalgas_partition(this.__wbg_ptr);
        return ret[0] === 0 ? undefined : ret[1];
    }
    /**
     * Whether the piston is moving, and which way: +1 out, −1 in, 0 at rest.
     * @returns {number}
     */
    piston() {
        const ret = wasm.thermalgas_piston(this.__wbg_ptr);
        return ret;
    }
    /**
     * Picoseconds of the gas to show in one second of watching.
     * @returns {number}
     */
    playback() {
        const ret = wasm.thermalgas_playback(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    scene_json() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.thermalgas_scene_json(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * The record kept once a picosecond, one quantity at a time: `time` (ps), `volume` (nm³), `pressure`
     * (atm), `temperature` (K), `work`, `heat`, `energy` (10⁻²¹ J).
     * @param {string} quantity
     * @returns {Float64Array}
     */
    series(quantity) {
        const ptr0 = passStringToWasm0(quantity, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.thermalgas_series(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * The share of one kind of molecule found in the left half of the box, at each sample of the record.
     * @param {number} species
     * @returns {Float64Array}
     */
    series_share(species) {
        const ret = wasm.thermalgas_series_share(this.__wbg_ptr, species);
        return ret;
    }
    /**
     * The box as it is now, `[x, y, z]` in nm; x is where the piston stands.
     * @returns {Float64Array}
     */
    size() {
        const ret = wasm.thermalgas_size(this.__wbg_ptr);
        return ret;
    }
    /**
     * How one kind of molecule is spread over speed from zero to `fastest` m/s, as a probability density per
     * m/s in `bins` equal steps. A negative `species` takes every kind together.
     * @param {number} species
     * @param {number} bins
     * @param {number} fastest
     * @returns {Float64Array}
     */
    speed_histogram(species, bins, fastest) {
        const ret = wasm.thermalgas_speed_histogram(this.__wbg_ptr, species, bins, fastest);
        return ret;
    }
    /**
     * The stage in progress and what it is called.
     * @returns {number}
     */
    stage() {
        const ret = wasm.thermalgas_stage(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    stage_count() {
        const ret = wasm.thermalgas_stage_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {string}
     */
    stage_label() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.thermalgas_stage_label(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {string}
     */
    title() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.thermalgas_title(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * The temperature each wall is held at, in K, in the order low x, high x, low y, high y, low z, high z;
     * `NaN` for a wall that is insulated.
     * @returns {Float64Array}
     */
    walls() {
        const ret = wasm.thermalgas_walls(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) ThermalGas.prototype[Symbol.dispose] = ThermalGas.prototype.free;

/**
 * A running simulation of one of the supported wave equations.
 */
export class WaveSimulation {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WaveSimulationFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wavesimulation_free(ptr, 0);
    }
    /**
     * @param {number} speed
     * @param {number} center
     */
    add_kdv_soliton(speed, center) {
        wasm.wavesimulation_add_kdv_soliton(this.__wbg_ptr, speed, center);
    }
    /**
     * @param {number} amplitude
     * @param {number} velocity
     * @param {number} center
     */
    add_nls_soliton(amplitude, velocity, center) {
        wasm.wavesimulation_add_nls_soliton(this.__wbg_ptr, amplitude, velocity, center);
    }
    clear() {
        wasm.wavesimulation_clear(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    dt() {
        const ret = wasm.wavesimulation_dt(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Float64Array}
     */
    imag() {
        const ret = wasm.wavesimulation_imag(this.__wbg_ptr);
        return ret;
    }
    /**
     * Conserved quantities as a plain `{ name: value }` object.
     * @returns {object}
     */
    invariants() {
        const ret = wasm.wavesimulation_invariants(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    length() {
        const ret = wasm.wavesimulation_length(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Float64Array}
     */
    magnitude() {
        const ret = wasm.wavesimulation_magnitude(this.__wbg_ptr);
        return ret;
    }
    /**
     * `model` is `"kdv"` or `"nls"`.
     * @param {string} model
     * @param {number} points
     * @param {number} length
     * @param {number} dt
     */
    constructor(model, points, length, dt) {
        const val2 = +points;
        const val3 = +length;
        const val4 = +dt;
        const ptr0 = passStringToWasm0(model, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.wavesimulation_new(ptr0, len0, val2, val3, val4);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        WaveSimulationFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    points() {
        const ret = wasm.wavesimulation_points(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Float64Array}
     */
    positions() {
        const ret = wasm.wavesimulation_positions(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Float64Array}
     */
    real() {
        const ret = wasm.wavesimulation_real(this.__wbg_ptr);
        return ret;
    }
    /**
     * Sets the state from interleaved-free real and imaginary arrays.
     * @param {Float64Array | number[]} re
     * @param {Float64Array | number[]} im
     */
    set_state(re, im) {
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passArrayF64ToWasm0(re, wasm.__wbindgen_malloc);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArrayF64ToWasm0(im, wasm.__wbindgen_malloc);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 8, 8); }
            if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 8, 8); }
            throw e;
        }
        const ret = wasm.wavesimulation_set_state(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {number} steps
     */
    step(steps) {
        wasm.wavesimulation_step(this.__wbg_ptr, steps);
    }
    /**
     * @returns {number}
     */
    time() {
        const ret = wasm.wavesimulation_time(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) WaveSimulation.prototype[Symbol.dispose] = WaveSimulation.prototype.free;

/**
 * The circuit scenarios with their parameter schemas.
 * @returns {any}
 */
export function circuits_catalogue() {
    const ret = wasm.circuits_catalogue();
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * The scenario catalogue with parameter schemas, for building the picker and the sliders.
 * @returns {any}
 */
export function mechanics_catalogue() {
    const ret = wasm.mechanics_catalogue();
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * The optics scenarios with their parameter schemas.
 * @returns {any}
 */
export function optics_catalogue() {
    const ret = wasm.optics_catalogue();
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * The statistical scenarios with their parameter schemas.
 * @returns {any}
 */
export function statmech_catalogue() {
    const ret = wasm.statmech_catalogue();
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * The thermal scenarios with their parameter schemas.
 * @returns {any}
 */
export function thermal_catalogue() {
    const ret = wasm.thermal_catalogue();
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_208446807d0d1e30: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_boolean_get_4f1baf9a00be3c74: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_f249a2a76caa9a55: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_function_741ff2bb612836f5: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_c22311b1cc228e3a: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_object_8b968c3ab8e96595: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_undefined_be5b34249ff1fc15: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_b2f214e2e4b30e36: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_934b640d0889af78: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64((arg0 >>> 0) + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_7ce8eee7fd327545: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
            getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_40b008ba32f73991: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_done_57e08d0be6e30c02: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_entries_7bb1459bd9b5c2b9: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_get_635eea311fa1a291: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_d7176cfb76d71114: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_unchecked_e6325ad374eff861: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_instanceof_ArrayBuffer_12cdaa4161423e6b: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_d7aeb0dcb3108fea: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_iterator_e4c5e8f68ada7b58: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_length_186163212ffe79c3: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_b03a0fabb109b1e9: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_13de428334042d26: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_37eb45aaf5eeb820: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_cd4348290afae586: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_from_slice_aaf85a9746711968: function(arg0, arg1) {
            const ret = new Float64Array(getArrayF64FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_from_slice_d9c5662e7fd80ccd: function(arg0, arg1) {
            const ret = new Int8Array(getArrayI8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_from_slice_e0c60a796e12bb7c: function(arg0, arg1) {
            const ret = new Int32Array(getArrayI32FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_with_length_07edd8a7019b8c30: function(arg0) {
            const ret = new Float64Array(arg0 >>> 0);
            return ret;
        },
        __wbg_new_with_length_405f2fe2d5c3a4b0: function(arg0) {
            const ret = new Int8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_new_with_length_861de131a23a8038: function(arg0) {
            const ret = new Int32Array(arg0 >>> 0);
            return ret;
        },
        __wbg_next_178c1651c11432b3: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_next_af5ac6a08bb0a717: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_prototypesetcall_13162965d1fe7aa3: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_set_2793479888329cb6: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_d2d33b52458e984a: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_e4b9a833d288759a: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_value_e0f328965e184931: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbindgen_generic_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_generic_0000000000000003: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            table.set(0, undefined);
            table.set(1024, undefined);
            table.set(1025, null);
            table.set(1026, true);
            table.set(1027, false);
        },
    };
    return {
        __proto__: null,
        "./soliton_wasm_bg.js": import0,
    };
}

const CircuitBenchFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_circuitbench_free(ptr, 1));
const MechanicsWorldFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_mechanicsworld_free(ptr, 1));
const OpticsBenchFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_opticsbench_free(ptr, 1));
const StatRunFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_statrun_free(ptr, 1));
const ThermalGasFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_thermalgas_free(ptr, 1));
const WaveSimulationFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wavesimulation_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function debugString(val) {
    switch (typeof val) {
        // primitive types
        case 'number':
        case 'boolean':
        case 'undefined':
        return `${val}`;
        case 'string':
        return JSON.stringify(val);
        case 'bigint':
        return `${val}n`;
        case 'symbol':
        return val.description !== undefined
            ? `Symbol(${val.description})`
            : 'Symbol';
        case 'function':
        return typeof val.name === 'string' && val.name !== ''
            ? `Function(${val.name})`
            : 'Function';
        case 'object': {
            if (val === null) {
                return 'null';
            }
            // objects
            if (Array.isArray(val)) {
                return '[' + Array.from(val, debugString).join(', ') + ']';
            }
            // errors
            if (val instanceof Error) {
                return `${val.name}: ${val.message}\n${val.stack}`;
            }

            const toStringOutput = toString.call(val);
            // Test for built-in
            const className = /\[object ([^\]]+)\]/.exec(toStringOutput)?.[1];

            // Failed to match the standard '[object ClassName]'
            if (className === undefined) {
                return toStringOutput;
            }
            if (className === 'Object') {
                // we're a user defined class or Object
                // JSON.stringify avoids problems with cycles, and is generally much
                // easier than looping through ownProperties of `val`.
                try {
                    return 'Object(' + JSON.stringify(val) + ')';
                } catch (_) {
                    return 'Object';
                }
            }
            // TODO we could test for more things here, like `Set`s and `Map`s.
            return className;
        }
        // Per MDN: 'This list of values is exhaustive.'
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof#description
    }
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayI8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

let cachedInt8ArrayMemory0 = null;
function getInt8ArrayMemory0() {
    if (cachedInt8ArrayMemory0 === null || cachedInt8ArrayMemory0.byteLength === 0) {
        cachedInt8ArrayMemory0 = new Int8Array(wasm.memory.buffer);
    }
    return cachedInt8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
    numBytesDecoded += bytes.length;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        cachedTextDecoder.decode();
        numBytesDecoded = bytes.length;
    }
    return cachedTextDecoder.decode(bytes);
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedInt32ArrayMemory0 = null;
    cachedInt8ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

let __wbg_init_promise;
async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;
    if (__wbg_init_promise === undefined) {
        __wbg_init_promise = __wbg_init_once(module_or_path);
        __wbg_init_promise.catch(() => { __wbg_init_promise = undefined; });
    }
    return __wbg_init_promise;
}

async function __wbg_init_once(module_or_path) {

    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('soliton_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
