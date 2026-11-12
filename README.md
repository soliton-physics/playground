<p align="center">
  <img src="https://raw.githubusercontent.com/soliton-physics/.github/main/logo/soliton.svg" width="120" alt="Soliton Physics">
</p>

<h1 align="center">playground</h1>

<p align="center">A physics playground in the browser. Grab things, throw them, build your own worlds.<br>Every number comes from the Soliton Physics engine, compiled to WebAssembly.</p>

Live at [soliton-playground.vercel.app](https://soliton-playground.vercel.app/).

## What you can do

**Play a scenario** (`?mode=mechanics&scenario=<id>`). The NCERT class 11 catalogue, from free fall to the simple
pendulum. Press `/` to open the gallery.

- Drag the knobs on the stage before you press play: the launch arrow, the top of the incline, the pendulum bob.
  The same values are in the Parameters panel when you want an exact number.
- Press play, then press on any body and pull. A spring ties it to your pointer; it is a real force, so it shows in the
  free-body diagram and in the energy ledger as work done.
- Scrub the timeline to go back. A run you took part in replays exactly, hand included.
- The inspector on the right has the free-body diagram, the energy ledger, graphs and the event log.
- Textbook answers sit at the bottom left, with what the engine measures beside them.

**Build your own** (`?mode=mechanics&sandbox`). Choose Remix on any scenario, or start from bare ground.

- Tools on the left: ball, box, any shape you draw corner by corner, fixed platform, incline, wall or ramp, rope, rod,
  spring, pin, erase.
- Select a body to change its mass, size, friction and bounce, or drag its arrow to give it a velocity.
- Click a rope, rod or spring to change its length, or a spring's stiffness and natural length.
- Shift-click to select several bodies, or shift-drag a box round them; drag one to move them all. Copy, paste and
  duplicate take the ropes, rods and springs between them along.
- Undo and redo, autosave in the browser, Save and Open as JSON, and Share for a link that carries the whole scene.
- Editing while a run is paused carries on from that moment.

**Waves** (`?mode=waves&preset=<id>`). KdV and NLS solitons, collisions, a bump breaking into a soliton train, the
Satsuma–Yajima breather. Switch on the pencil and draw your own wave.

Add `&embed` for a compact view suitable for iframes, which is how the [docs](https://github.com/soliton-physics/docs)
embed live simulations, and `&theme=light` or `&theme=dark` to fix the theme.

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
  styles/                  design tokens (dark and light) and the stylesheet
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
```

## Deployment

Deployed on Vercel from `main`. Set `VITE_DOCS_URL` in the project settings if the docs live somewhere other than the default in `.env`.

## Stack

Vite, TypeScript, Canvas 2D, no framework. Nothing physical is computed in the browser code: forces, energies, events
and contact all come from the engine. The playground changes scenes, which are data, and asks the engine what happens.

## License

MIT
