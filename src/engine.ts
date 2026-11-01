import init, { WaveSimulation } from '@soliton-physics/soliton-wasm';

let ready: Promise<void> | undefined;

export function loadEngine(): Promise<void> {
  ready ??= init().then(() => undefined);
  return ready;
}

export { WaveSimulation };
