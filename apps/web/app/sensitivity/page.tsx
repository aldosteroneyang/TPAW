import { defaultSimulationInput, runSensitivity } from '@tpaw/sim-core';
import { NavTabs } from '@/components/NavTabs';
import { asPercent } from '@/lib/format';

const deltas = [-0.2, -0.1, 0, 0.1, 0.2];

export default function SensitivityPage() {
  const points = runSensitivity({ ...defaultSimulationInput, iterations: 200 }, 'expectedReturn', deltas);

  return (
    <section>
      <h1 className="mb-2 text-3xl font-semibold">Sensitivity</h1>
      <p className="mb-6 text-slate-600">關鍵參數（期望報酬）變動對成功率影響。</p>
      <NavTabs />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">Scenario</th>
              <th className="py-2">Expected Return</th>
              <th className="py-2">Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, idx) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-2">{`${(deltas[idx] * 100).toFixed(0)}%`}</td>
                <td className="py-2">{asPercent(point.value)}</td>
                <td className="py-2 font-medium">{asPercent(point.successRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
