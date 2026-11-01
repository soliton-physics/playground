<p align="center">
  <img src="https://raw.githubusercontent.com/soliton-physics/.github/main/logo/soliton.svg" width="120" alt="Soliton Physics">
</p>

<h1 align="center">playground</h1>

<p align="center">Interactive soliton simulations in the browser, powered by the Soliton Physics engine compiled to WebAssembly.</p>

Live at [soliton-physics.github.io/playground](https://soliton-physics.github.io/playground/).

## Scenarios

- KdV: a single soliton, a two-soliton collision, and a smooth bump breaking into a soliton train
- NLS: a moving bright soliton, a two-soliton collision, and the Satsuma–Yajima breather

Every scenario shows the live conserved quantities and their drift, so you can see the solver's accuracy as it runs.

Open a scenario directly with `?preset=<id>`. Add `&embed` for a compact view suitable for iframes, which is how the
[docs](https://github.com/soliton-physics/docs) embed live simulations.

## Development

The playground consumes the WebAssembly package built from the sibling [`soliton`](https://github.com/soliton-physics/soliton) repository,
so clone both side by side:

```
soliton-physics/
  soliton/
  playground/
```

```sh
# build the engine
cd soliton/crates/soliton-wasm
wasm-pack build --release --target web --scope soliton-physics

# run the playground
cd ../../../playground
pnpm install
pnpm dev
```

## Stack

Vite, TypeScript, Canvas 2D for one-dimensional fields. WebGPU rendering arrives with the two-dimensional solvers.

## License

MIT
