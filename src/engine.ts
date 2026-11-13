import init, { MechanicsWorld, OpticsBench, WaveSimulation, mechanics_catalogue, optics_catalogue } from '@soliton-physics/engine';

let ready: Promise<void> | undefined;

export function loadEngine(): Promise<void> {
  ready ??= init().then(() => undefined);
  return ready;
}

export { MechanicsWorld, OpticsBench, WaveSimulation, mechanics_catalogue, optics_catalogue };
