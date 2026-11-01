#!/usr/bin/env sh
# Rebuilds the WebAssembly engine from the sibling `soliton` checkout and vendors it into ./engine.
set -eu
cd "$(dirname "$0")/.."
crate=../soliton/crates/soliton-wasm
(cd "$crate" && wasm-pack build --release --target web --scope soliton-physics)
rm -rf engine && mkdir engine
cp "$crate"/pkg/package.json "$crate"/pkg/soliton_wasm.js "$crate"/pkg/soliton_wasm.d.ts \
   "$crate"/pkg/soliton_wasm_bg.wasm "$crate"/pkg/soliton_wasm_bg.wasm.d.ts engine/
echo "engine synced: $(grep '"version"' engine/package.json)"
