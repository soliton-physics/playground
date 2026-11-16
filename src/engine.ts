import init, { CircuitBench, MechanicsWorld, ModernRun, OpticsBench, StatRun, ThermalGas, WaveSimulation, circuits_catalogue, mechanics_catalogue, modern_catalogue, optics_catalogue, statmech_catalogue, thermal_catalogue } from '@soliton-physics/engine';

let ready: Promise<void> | undefined;

export function loadEngine(): Promise<void> {
  ready ??= init().then(() => undefined);
  return ready;
}

export { CircuitBench, MechanicsWorld, ModernRun, OpticsBench, StatRun, ThermalGas, WaveSimulation, circuits_catalogue, mechanics_catalogue, modern_catalogue, optics_catalogue, statmech_catalogue, thermal_catalogue };
