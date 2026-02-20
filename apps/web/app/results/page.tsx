'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { defaultSimulationInput, runMonteCarlo, type MonteCarloResult, type SimulationInput } from '@tpaw/sim-core';
import { NavTabs } from '@/components/NavTabs';
import { asCurrency, asPercent } from '@/lib/format';

type SpendingRule = 'inflation-linked' | 'flat';

interface ScenarioRecord {
  name: string;
  input: SimulationInput;
  spendingRule: SpendingRule;
}

const STORAGE_KEY = 'tpaw-scenarios-v1';
const baseInput: SimulationInput = { ...defaultSimulationInput, iterations: 600 };

export default function ResultsPage() {
  const [input, setInput] = useState<SimulationInput>(baseInput);
  const [spendingRule, setSpendingRule] = useState<SpendingRule>('inflation-linked');
  const [debouncedInput, setDebouncedInput] = useState<SimulationInput>(baseInput);
  const [debouncedRule, setDebouncedRule] = useState<SpendingRule>('inflation-linked');
  const [scenarioName, setScenarioName] = useState('My Scenario');
  const [savedScenarios, setSavedScenarios] = useState<ScenarioRecord[]>([]);
  const [compareNames, setCompareNames] = useState<string[]>([]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedInput(input);
      setDebouncedRule(spendingRule);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [input, spendingRule]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      setSavedScenarios(JSON.parse(raw) as ScenarioRecord[]);
    } catch {
      setSavedScenarios([]);
    }
  }, []);

  const effectiveInput = useMemo(
    () => ({ ...debouncedInput, inflationRate: debouncedRule === 'flat' ? 0 : debouncedInput.inflationRate }),
    [debouncedInput, debouncedRule]
  );

  const result = useMemo(() => runMonteCarlo(effectiveInput), [effectiveInput]);
  const fanChartData = useMemo(() => buildFanChartData(result, effectiveInput), [result, effectiveInput]);
  const withdrawalRange = useMemo(() => estimateWithdrawalRange(effectiveInput), [effectiveInput]);

  const strategyData = useMemo(() => {
    const allocations = [
      { name: '60/40', stock: 0.6 },
      { name: '80/20', stock: 0.8 },
      { name: '目前配置', stock: effectiveInput.stockAllocation }
    ];

    return allocations.map((allocation) => {
      const strategyResult = runMonteCarlo({
        ...effectiveInput,
        stockAllocation: allocation.stock,
        bondAllocation: 1 - allocation.stock
      });
      const stats = getPercentiles(strategyResult.endingAssets);
      return {
        label: allocation.name,
        successRate: Number((strategyResult.successRate * 100).toFixed(1)),
        medianEnding: Math.round(stats.p50 / 10_000)
      };
    });
  }, [effectiveInput]);

  const comparisonData = useMemo(() => {
    const selected = savedScenarios.filter((scenario) => compareNames.includes(scenario.name));
    return selected.map((scenario) => {
      const scenarioInput = {
        ...scenario.input,
        inflationRate: scenario.spendingRule === 'flat' ? 0 : scenario.input.inflationRate
      };
      const scenarioResult = runMonteCarlo(scenarioInput);
      const stats = getPercentiles(scenarioResult.endingAssets);
      return {
        label: scenario.name,
        successRate: Number((scenarioResult.successRate * 100).toFixed(1)),
        medianEnding: Math.round(stats.p50 / 10_000)
      };
    });
  }, [compareNames, savedScenarios]);

  const saveScenario = () => {
    const next = [...savedScenarios.filter((scenario) => scenario.name !== scenarioName), { name: scenarioName, input, spendingRule }];
    setSavedScenarios(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const loadScenario = (name: string) => {
    const found = savedScenarios.find((scenario) => scenario.name === name);
    if (!found) {
      return;
    }
    setInput(found.input);
    setSpendingRule(found.spendingRule);
    setScenarioName(found.name);
  };

  return (
    <section>
      <h1 className="mb-2 text-3xl font-semibold">Results</h1>
      <p className="mb-6 text-slate-600">互動參數、即時重算、scenario 管理與多圖表比較。</p>
      <NavTabs />

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px,1fr]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">參數面板（Debounce 350ms）</h2>
          <NumberField label="模擬次數" value={input.iterations} min={100} max={5000} step={100} onChange={(v) => setInput({ ...input, iterations: v })} />
          <NumberField label="退休年限" value={input.terminalAge - input.retirementAge} min={10} max={50} onChange={(v) => setInput({ ...input, terminalAge: input.retirementAge + v })} />
          <NumberField label="年支出" value={input.annualSpending} min={100000} step={10000} onChange={(v) => setInput({ ...input, annualSpending: v })} />
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">支出調整規則</span>
            <select className="w-full rounded-md border border-slate-300 p-2" value={spendingRule} onChange={(event) => setSpendingRule(event.target.value as SpendingRule)}>
              <option value="inflation-linked">通膨調整</option>
              <option value="flat">固定金額</option>
            </select>
          </label>
          <NumberField label="資產配置（股票 %）" value={Math.round(input.stockAllocation * 100)} min={0} max={100} onChange={(v) => setInput({ ...input, stockAllocation: v / 100, bondAllocation: 1 - v / 100 })} />
          <p className="text-xs text-slate-500">債券配置：{Math.round(input.bondAllocation * 100)}%</p>

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold">情境管理</p>
            <input className="w-full rounded-md border border-slate-300 p-2" value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} placeholder="Scenario 名稱" />
            <div className="flex gap-2">
              <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={saveScenario}>
                儲存
              </button>
              <select className="flex-1 rounded border border-slate-300 p-2 text-sm" onChange={(event) => loadScenario(event.target.value)}>
                <option value="">載入 scenario</option>
                {savedScenarios.map((scenario) => (
                  <option key={scenario.name} value={scenario.name}>
                    {scenario.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">比較 scenario：</p>
            <div className="max-h-28 space-y-1 overflow-auto rounded border border-slate-200 p-2 text-sm">
              {savedScenarios.map((scenario) => (
                <label key={scenario.name} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={compareNames.includes(scenario.name)}
                    onChange={(event) =>
                      setCompareNames(
                        event.target.checked
                          ? [...compareNames, scenario.name]
                          : compareNames.filter((name) => name !== scenario.name)
                      )
                    }
                  />
                  {scenario.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card title="成功率" value={asPercent(result.successRate)} />
            <Card title="可持續提款區間" value={`${asCurrency(withdrawalRange.low)} ~ ${asCurrency(withdrawalRange.high)}`} />
            <Card title="最壞年份資產" value={asCurrency(Math.min(...result.endingAssets))} />
            <Card title="破產機率（最終）" value={asPercent(result.bankruptcyTimeline[result.bankruptcyTimeline.length - 1]?.bankruptcyProbability ?? 0)} />
          </div>

          <ChartCard title="財富路徑 Fan Chart（P10/P25/P50/P75/P90）">
            <SimpleLineChart
              data={fanChartData}
              series={[
                { key: 'p10', color: '#cbd5e1' },
                { key: 'p25', color: '#94a3b8' },
                { key: 'p50', color: '#0f172a' },
                { key: 'p75', color: '#475569' },
                { key: 'p90', color: '#1e293b' }
              ]}
              xKey="age"
            />
          </ChartCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="成功 / 失敗比例圖">
              <SimplePie successRate={result.successRate} />
            </ChartCard>
            <ChartCard title="策略比較（60/40 vs 80/20）">
              <SimpleBarChart data={strategyData} />
            </ChartCard>
          </div>

          <ChartCard title="破產機率時間軸">
            <SimpleLineChart
              data={result.bankruptcyTimeline}
              series={[{ key: 'bankruptcyProbability', color: '#ef4444' }]}
              xKey="age"
              yFormatter={(value) => asPercent(value)}
            />
          </ChartCard>

          {comparisonData.length > 0 && (
            <ChartCard title="多 scenario 同頁比較">
              <SimpleBarChart data={comparisonData} />
            </ChartCard>
          )}
        </div>
      </div>
    </section>
  );
}

function SimplePie({ successRate }: { successRate: number }) {
  const success = Math.round(successRate * 1000) / 10;
  const fail = Math.round((100 - success) * 10) / 10;
  return (
    <div className="flex items-center gap-6">
      <div className="h-36 w-36 rounded-full" style={{ background: `conic-gradient(#0f172a 0 ${success}%, #cbd5e1 ${success}% 100%)` }} />
      <div className="space-y-1 text-sm">
        <p>成功：{success}%</p>
        <p>失敗：{fail}%</p>
      </div>
    </div>
  );
}

function SimpleBarChart({ data }: { data: Array<{ label: string; successRate: number; medianEnding: number }> }) {
  const max = Math.max(...data.map((point) => Math.max(point.successRate, point.medianEnding / 2)), 1);
  return (
    <div className="space-y-2">
      {data.map((point) => (
        <div key={point.label} className="space-y-1">
          <p className="text-sm font-medium">{point.label}</p>
          <div className="h-3 overflow-hidden rounded bg-slate-100">
            <div className="h-full bg-slate-900" style={{ width: `${(point.successRate / max) * 100}%` }} />
          </div>
          <div className="h-3 overflow-hidden rounded bg-slate-100">
            <div className="h-full bg-sky-500" style={{ width: `${((point.medianEnding / 2) / max) * 100}%` }} />
          </div>
          <p className="text-xs text-slate-600">成功率 {point.successRate}%｜期末中位資產 {point.medianEnding} 萬</p>
        </div>
      ))}
    </div>
  );
}

function SimpleLineChart({
  data,
  series,
  xKey,
  yFormatter
}: {
  data: Array<Record<string, number>>;
  series: Array<{ key: string; color: string }>;
  xKey: string;
  yFormatter?: (value: number) => string;
}) {
  const width = 840;
  const height = 220;
  const padding = 24;
  const allY = data.flatMap((point) => series.map((item) => Number(point[item.key])));
  const minY = Math.min(...allY, 0);
  const maxY = Math.max(...allY, 1);

  const x = (index: number) => padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2);
  const y = (value: number) => height - padding - ((value - minY) / Math.max(maxY - minY, 1)) * (height - padding * 2);

  return (
    <div className="space-y-2 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[640px]">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" />
        {series.map((item) => (
          <polyline
            key={item.key}
            fill="none"
            stroke={item.color}
            strokeWidth="2"
            points={data.map((point, index) => `${x(index)},${y(Number(point[item.key]))}`).join(' ')}
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs">
        {series.map((item) => (
          <span key={item.key} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.key}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        X 軸：{xKey}（{data[0]?.[xKey]} ~ {data[data.length - 1]?.[xKey]}）
        {yFormatter ? `｜Y 軸格式示例：${yFormatter(maxY)}` : ''}
      </p>
    </div>
  );
}

function estimateWithdrawalRange(input: SimulationInput): { low: number; high: number } {
  const sampleIterations = Math.max(200, Math.floor(input.iterations / 2));
  const multipliers = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3];
  const outcomes = multipliers.map((multiplier) => ({
    multiplier,
    successRate: runMonteCarlo({ ...input, annualSpending: input.annualSpending * multiplier, iterations: sampleIterations }).successRate
  }));

  const low = outcomes.find((outcome) => outcome.successRate >= 0.9)?.multiplier ?? 0.7;
  const high = [...outcomes].reverse().find((outcome) => outcome.successRate >= 0.7)?.multiplier ?? 1;

  return { low: input.annualSpending * low, high: input.annualSpending * high };
}

function buildFanChartData(result: MonteCarloResult, input: SimulationInput) {
  const years = input.terminalAge - input.currentAge;
  return Array.from({ length: years }, (_, year) => {
    const values = result.yearlyEndingAssets.map((path) => path[year] ?? 0);
    const stats = getPercentiles(values);
    return { age: input.currentAge + year, p10: stats.p10, p25: stats.p25, p50: stats.p50, p75: stats.p75, p90: stats.p90 };
  });
}

function getPercentiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  return { p10: pick(0.1), p25: pick(0.25), p50: pick(0.5), p75: pick(0.75), p90: pick(0.9) };
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function NumberField({ label, value, min, max, step, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input className="w-full rounded-md border border-slate-300 p-2" type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
