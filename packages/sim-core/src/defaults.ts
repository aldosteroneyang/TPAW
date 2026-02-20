import type { SimulationInput } from './types';

export const defaultSimulationInput: SimulationInput = {
  currentAge: 35,
  retirementAge: 60,
  terminalAge: 95,
  initialAssets: 8_000_000,
  annualSpending: 420_000,
  expectedReturn: 0.055,
  returnVolatility: 0.12,
  inflationRate: 0.02,
  taxRate: 0.12,
  rebalanceThreshold: 0.05,
  stockAllocation: 0.6,
  bondAllocation: 0.4,
  iterations: 1000
};
