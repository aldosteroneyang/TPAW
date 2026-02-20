import { defaultSimulationInput, runMonteCarlo } from '@tpaw/sim-core';
import { NavTabs } from '@/components/NavTabs';
import { asCurrency, asPercent } from '@/lib/format';

export default function ResultsPage() {
  const result = runMonteCarlo({ ...defaultSimulationInput, iterations: 200 });
  const sorted = [...result.endingAssets].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];

  return (
    <section>
      <h1 className="mb-2 text-3xl font-semibold">Results</h1>
      <p className="mb-6 text-slate-600">成功率、資產分布、提款路徑摘要。</p>
      <NavTabs />
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="成功率" value={asPercent(result.successRate)} />
        <Card title="資產分布 (P10/P50/P90)" value={`${asCurrency(p10)} / ${asCurrency(p50)} / ${asCurrency(p90)}`} />
        <Card
          title="示例提款路徑"
          value={`${result.sampledPath.length} 年，首年提款 ${asCurrency(result.sampledPath[0]?.withdrawal ?? 0)}`}
        />
      </div>
    </section>
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
