<p align="center">
  <img src="https://raw.githubusercontent.com/soliton-physics/.github/main/logo/soliton.svg" width="120" alt="Soliton Physics">
</p>

<h1 align="center">playground</h1>

<p align="center">Interactive physics in the browser, powered by the Soliton Physics engine compiled to WebAssembly.</p>

Live at [soliton-playground.vercel.app](https://soliton-playground.vercel.app/).

## Two modes

**Mechanics** (`?mode=mechanics&scenario=<id>`): the NCERT class 11 scenario catalogue in chapter order, from free
fall to the simple pendulum. Sliders are generated from each scenario's parameter schema. The view shows the bodies,
ropes and springs, the velocity and acceleration vectors, and the free-body diagram of the selected body drawn from the
engine's own force breakdown. Panels show the textbook answers beside the live readout, the energy ledger, position and
velocity graphs, and the event log (a rope going slack, a block starting to slide). Click a body to select it; drag to
pan and scroll to zoom.

**Waves** (`?mode=waves&preset=<id>`): KdV and NLS solitons, collisions, a bump breaking into a soliton train, and the
Satsuma–Yajima breather, with live conserved quantities and their drift.

Add `&embed` to either for a compact view suitable for iframes, which is how the
[docs](https://github.com/soliton-physics/docs) embed live simulations. The theme follows the system and can be toggled
in the header.

## Development

```sh
pnpm install
pnpm dev
```

The compiled engine lives in `engine/`, vendored from the sibling [`soliton`](https://github.com/soliton-physics/soliton)
repository so that Vercel can build this repo without a Rust toolchain. After changing the engine, clone both repos side by side
and run:

```sh
pnpm sync-engine
```

which rebuilds the WebAssembly package with `wasm-pack` and copies it into `engine/`.

## Deployment

Deployed on Vercel from `main`. Set `VITE_DOCS_URL` in the project settings if the docs live somewhere other than the default in `.env`.

## Stack

Vite, TypeScript, Canvas 2D, no framework. Nothing physical is computed in the browser code: forces, energies and events all come from the engine.

## License

MIT
