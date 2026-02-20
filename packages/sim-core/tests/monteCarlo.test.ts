import { describe, expect, it } from 'vitest';
import { defaultSimulationInput, runMonteCarlo, runSensitivity } from '../src';

describe('runMonteCarlo', () => {
  it('returns normalized success rate and ending assets', () => {
    const result = runMonteCarlo({ ...defaultSimulationInput, iterations: 50 });

    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(1);
    expect(result.endingAssets).toHaveLength(50);
    expect(result.sampledPath.length).toBeGreaterThan(0);
    expect(result.yearlyEndingAssets).toHaveLength(50);
    expect(result.bankruptcyTimeline.length).toBe(defaultSimulationInput.terminalAge - defaultSimulationInput.currentAge);
  });
});

describe('runSensitivity', () => {
  it('generates sensitivity points for each delta', () => {
    const deltas = [-0.1, 0, 0.1];
    const points = runSensitivity({ ...defaultSimulationInput, iterations: 20 }, 'taxRate', deltas);

    expect(points).toHaveLength(deltas.length);
    points.forEach((point) => {
      expect(point.parameter).toBe('taxRate');
      expect(point.successRate).toBeGreaterThanOrEqual(0);
      expect(point.successRate).toBeLessThanOrEqual(1);
    });
  });
});
