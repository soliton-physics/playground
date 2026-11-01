import init, { MechanicsWorld, WaveSimulation, mechanics_catalogue } from '@soliton-physics/soliton-wasm';

let ready: Promise<void> | undefined;

export function loadEngine(): Promise<void> {
  ready ??= init().then(() => undefined);
  return ready;
}

export { MechanicsWorld, WaveSimulation, mechanics_catalogue };
