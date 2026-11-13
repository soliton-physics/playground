<p align="center">
  <img src="https://raw.githubusercontent.com/soliton-physics/.github/main/logo/soliton.svg" width="120" alt="Soliton Physics">
</p>

<h1 align="center">playground</h1>

<p align="center">A physics playground in the browser. Grab things, throw them, build your own worlds.<br>Every number comes from the Soliton Physics engine, compiled to WebAssembly.</p>

Live at [soliton-playground.vercel.app](https://soliton-playground.vercel.app/).

## What you can do

**Play a scenario** (`?mode=mechanics&scenario=<id>`). The NCERT class 11 catalogue, from free fall to the simple
pendulum, and class 12's charges and fields, Gauss's law, and magnets and matter. Press `/` to open the gallery.

- Drag the knobs on the stage before you press play: the launch arrow, the top of the incline, the pendulum bob.
  The same values are in the Parameters panel when you want an exact number.
- Press play, then press on any body and pull. A spring ties it to your pointer; it is a real force, so it shows in the
  free-body diagram and in the energy ledger as work done.
- Scrub the timeline to go back. A run you took part in replays exactly, hand included.
- The inspector on the right has the free-body diagram, the energy ledger, graphs and the event log.
- Textbook answers sit at the bottom left, with what the engine measures beside them.
- In a scene with charges or fields, positive charges are red with a plus and negative ones blue with a minus;
  electric fields are arrows, magnetic fields dots (out of the page) or crosses (into it). Move the pointer over the
  stage to read the field and the potential there. The field button in the dock hides all of it.
- A bar magnet is red at its north pole and blue at its south. The small needles across the stage are compasses,
  red end along the field; they fade where the field is weak, which is how a neutral point shows.

**Trace rays** (`?mode=optics&scenario=<id>`). The class 12 chapter on ray optics: spherical mirrors, refraction and
total internal reflection, lenses, the prism, the telescope and the microscope.

- Drag the knob on the bench: the top of the object, the start of a ray, the eyepiece. The engine traces every ray
  again as you move it. Parameters has the rest, and a scenario's numbers go in the link.
- The blue arrow is the image the formulas are about, found from rays near the axis; dashed when it is virtual, with
  the rays produced back to it. The red rays are exact, so a tall object or a wide beam shows spherical aberration.
- Each textbook answer has the traced value beside it.

**Build your own** (`?mode=mechanics&sandbox`). Choose Remix on any scenario, or start from bare ground.

- Tools on the left: ball, box, any shape you draw corner by corner, fixed platform, incline, wall or ramp, rope, rod,
  spring, pin, erase.
- Select a body to change its mass, size, friction and bounce, or drag its arrow to give it a velocity.
- Click a rope, rod or spring to change its length, or a spring's stiffness and natural length.
- Shift-click to select several bodies, or shift-drag a box round them; drag one to move them all. Copy, paste and
  duplicate take the ropes, rods and springs between them along.
- Undo and redo, autosave in the browser, Save and Open as JSON, and Share for a link that carries the whole scene.
- Editing while a run is paused carries on from that moment.

**Waves** (`?mode=waves&preset=<id>`), in four groups.

- **Class 11 · Waves.** The NCERT chapter: a travelling wave, a sound wave, the speed of a wave on a string, two waves
  adding, two pulses crossing, reflection at a fixed and at a free end, standing waves on a string, air columns closed
  and open, beats. Each has sliders, the numbers worth knowing (wavelength, period, speed, k, ω…), and its formulas.
  A lesson's parameters go in the link: `?mode=waves&preset=standing-wave&harmonic=5`.
- **Class 12 · Electromagnetic waves.** Displacement current in a charging capacitor, the travelling wave of E and
  B (in empty space, water or glass), standing radio waves off a metal sheet, and the spectrum from radio to gamma
  rays. The electric field is the graph; the magnetic field is drawn with it on a slanting axis.
- **Reading a point.** Click anywhere on a wave: displacement, the velocity and acceleration of the medium there, the
  amplitude and phase of that point, and its own history as a small graph. Drag it along. A second click adds a
  second point and gives the distance and phase difference between them. Escape clears them.
- **Wave lab** (`preset=wave-lab`). Up to five sine waves and pulses of your own, added together. Remix on any
  lesson opens it in the lab as its parts. The link carries the whole lab.
- **Beyond the textbook · Solitons.** KdV and NLS solitons, collisions, a bump breaking into a soliton train, the
  Satsuma–Yajima breather, integrated by the engine. Switch on the pencil and draw your own wave.

The textbook waves are closed forms, sums of `A sin(kx ∓ ωt + φ)` and of pulses `f(x ∓ vt)`, evaluated in
`src/waves/model.ts`; nothing is integrated, which is why any point can be read exactly at any time. This is the one
place the playground does its own arithmetic and does not ask the engine. Reflection uses the mirror-image pulse.
Formulas are typeset with KaTeX, fetched only when the wave mode is opened.

Add `&embed` for a compact view suitable for iframes, which is how the [docs](https://github.com/soliton-physics/docs)
embed live simulations, and `&theme=light` or `&theme=dark` to fix the theme. Add `&present` to open in projector mode: larger text, heavier lines, light
theme. The screen button in the top bar, or `T`, switches it on and off.

| Key | Does |
| --- | --- |
| Space | play or pause |
| → | one step |
| R | restart |
| F | fit the view |
| / or Ctrl+K | gallery |
| V B X G P I W O D S N E | sandbox tools: select, ball, box, shape, platform, incline, wall, rope, rod, spring, pin, erase |
| Enter, Esc | finish the shape being drawn; drop it |
| Ctrl+Z, Ctrl+Shift+Z | undo, redo |
| Ctrl+C, Ctrl+V, Ctrl+D | copy, paste, duplicate the selection |
| Ctrl+A | select everything |
| Shift-click, Shift-drag | add to the selection; select a box |
| Delete | remove what is selected |

## Development

```sh
pnpm install
pnpm dev
```

The compiled engine lives in `engine/`, vendored from the sibling [`soliton`](https://github.com/soliton-physics/soliton)
repository so that Vercel can build this repo without a Rust toolchain. After changing the engine, clone both repos
side by side and run:

```sh
pnpm sync-engine
```

which rebuilds the WebAssembly package with `wasm-pack` and copies it into `engine/`.

## Layout

```
src/
  main.ts, shell.ts        entry and the top bar
  controls.ts, icons.ts    sliders, popovers, toasts, the icon set
  styles/                  design tokens (light, dark, projector) and the stylesheet
  mechanics/
    app.ts                 ties everything together: loading worlds, the pointer, the frame loop
    session.ts             one world and its clock: play, step, scrub, the hand
    stage/                 the camera and the canvas renderer
    dock.ts                the transport and timeline
    inspector.ts           forces, energy, graphs, events
    handles.ts             the knobs each scenario puts on the stage
    editor.ts              the sandbox: tools, edits, undo, properties
    gallery.ts, answers.ts, share.ts
  waves/                   the wave mode
  optics/                  the optics bench: renderer, handles, gallery
    model.ts               sine waves and pulses as closed forms; the motion of one point
    lessons.ts             the class 11 lessons: parameters, parts, facts, marks, formulas
    lab.ts                 the wave lab: its state, its link, its editor
    scene.ts               what is on the plot: a textbook wave, or a soliton from the engine
    line.ts                the plot: curve, beads or layers of air, marks, chosen points
    app.ts, gallery.ts, presets.ts, formulas.ts
```

## Deployment

Deployed on Vercel from `main`. Set `VITE_DOCS_URL` in the project settings if the docs live somewhere other than the default in `.env`.

## Stack

Vite, TypeScript, Canvas 2D, no framework. Nothing physical is computed in the browser code: forces, energies, events
and contact all come from the engine. The playground changes scenes, which are data, and asks the engine what happens.

## License

MIT
