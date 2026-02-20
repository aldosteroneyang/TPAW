export interface SimulationInput {
  currentAge: number;
  retirementAge: number;
  terminalAge: number;
  initialAssets: number;
  annualSpending: number;
  expectedReturn: number;
  returnVolatility: number;
  inflationRate: number;
  taxRate: number;
  rebalanceThreshold: number;
  stockAllocation: number;
  bondAllocation: number;
  iterations: number;
}

export interface SimulationPath {
  year: number;
  age: number;
  startingAssets: number;
  withdrawal: number;
  taxes: number;
  endingAssets: number;
}

export interface YearlySuccessPoint {
  year: number;
  age: number;
  bankruptcyProbability: number;
}

export interface MonteCarloResult {
  successRate: number;
  endingAssets: number[];
  sampledPath: SimulationPath[];
  yearlyEndingAssets: number[][];
  bankruptcyTimeline: YearlySuccessPoint[];
}

export interface SensitivityPoint {
  parameter: string;
  value: number;
  successRate: number;
}
