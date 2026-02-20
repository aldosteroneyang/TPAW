import { defaultSimulationInput } from '@tpaw/sim-core';
import { NavTabs } from '@/components/NavTabs';

const fields = [
  ['目前年齡', defaultSimulationInput.currentAge],
  ['退休年齡', defaultSimulationInput.retirementAge],
  ['期初資產', defaultSimulationInput.initialAssets],
  ['年度支出', defaultSimulationInput.annualSpending],
  ['期望報酬', defaultSimulationInput.expectedReturn],
  ['報酬波動', defaultSimulationInput.returnVolatility],
  ['稅率', defaultSimulationInput.taxRate],
  ['再平衡門檻', defaultSimulationInput.rebalanceThreshold]
];

export default function InputPage() {
  return (
    <section>
      <h1 className="mb-2 text-3xl font-semibold">Input</h1>
      <p className="mb-6 text-slate-600">設定退休規劃的核心假設參數（示意頁面）。</p>
      <NavTabs />
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-6">
        {fields.map(([label, value]) => (
          <div key={label} className="grid grid-cols-2 border-b border-slate-100 pb-2 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
