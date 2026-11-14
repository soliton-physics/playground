import init, { MechanicsWorld, OpticsBench, ThermalGas, WaveSimulation, mechanics_catalogue, optics_catalogue, thermal_catalogue } from '@soliton-physics/engine';

let ready: Promise<void> | undefined;

export function loadEngine(): Promise<void> {
  ready ??= init().then(() => undefined);
  return ready;
}

export { MechanicsWorld, OpticsBench, ThermalGas, WaveSimulation, mechanics_catalogue, optics_catalogue, thermal_catalogue };
