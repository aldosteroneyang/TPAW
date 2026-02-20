import type { MonteCarloResult, SensitivityPoint, SimulationInput, SimulationPath } from './types';

function randomNormal(mean = 0, std = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * std + mean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function runMonteCarlo(input: SimulationInput): MonteCarloResult {
  const years = input.terminalAge - input.currentAge;
  const endingAssets: number[] = [];
  let successCount = 0;
  let sampledPath: SimulationPath[] = [];

  for (let i = 0; i < input.iterations; i += 1) {
    let assets = input.initialAssets;
    const path: SimulationPath[] = [];

    for (let year = 0; year < years; year += 1) {
      const age = input.currentAge + year;
      const isRetired = age >= input.retirementAge;
      const inflationAdjustedSpend = input.annualSpending * (1 + input.inflationRate) ** year;
      const withdrawal = isRetired ? inflationAdjustedSpend : inflationAdjustedSpend * 0.3;
      const taxes = Math.max(0, withdrawal * input.taxRate);
      const netOutflow = withdrawal + taxes;

      const startAssets = assets;
      assets = Math.max(0, assets - netOutflow);

      const annualReturn = randomNormal(input.expectedReturn, input.returnVolatility);
      const allocationDrift = randomNormal(0, input.rebalanceThreshold / 2);
      const effectiveStockAllocation = clamp(input.stockAllocation + allocationDrift, 0, 1);
      const effectiveBondAllocation = 1 - effectiveStockAllocation;
      const blendedReturn =
        annualReturn * effectiveStockAllocation + (input.expectedReturn * 0.4) * effectiveBondAllocation;

      assets *= 1 + blendedReturn;

      path.push({
        year,
        age,
        startingAssets: startAssets,
        withdrawal,
        taxes,
        endingAssets: assets
      });

      if (assets <= 0) {
        break;
      }
    }

    endingAssets.push(assets);
    if (assets > 0) {
      successCount += 1;
    }

    if (i === 0) {
      sampledPath = path;
    }
  }

  return {
    successRate: successCount / input.iterations,
    endingAssets,
    sampledPath
  };
}

export function runSensitivity(
  input: SimulationInput,
  parameter: keyof Pick<SimulationInput, 'expectedReturn' | 'annualSpending' | 'taxRate'>,
  deltas: number[]
): SensitivityPoint[] {
  return deltas.map((delta) => {
    const scenario = { ...input, [parameter]: input[parameter] * (1 + delta) };
    const result = runMonteCarlo(scenario);
    return {
      parameter,
      value: scenario[parameter] as number,
      successRate: result.successRate
    };
  });
}
