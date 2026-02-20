# TPAW 退休規劃 Monte Carlo 原型

本專案採用 **monorepo**：

- `apps/web`: Next.js + TypeScript + Tailwind 的前端頁面
- `packages/sim-core`: 與 UI 解耦的蒙地卡羅模擬核心

## 啟動方式

```bash
npm install
npm run dev
```

預設啟動 `apps/web`，可瀏覽：

- `/input`：輸入參數頁
- `/results`：成功率、資產分布、提款路徑摘要
- `/sensitivity`：敏感度分析頁

## 工程設定

- TypeScript：`tsconfig.base.json` + 各 package `tsconfig.json`
- ESLint：根目錄 `.eslintrc.cjs` 與 `apps/web/.eslintrc.json`
- Prettier：`.prettierrc`
- 測試：`vitest`（`packages/sim-core/tests`）

## 資料假設（預設值）

定義於 `packages/sim-core/src/defaults.ts`：

- 目前年齡 35、退休年齡 60、終點年齡 95
- 初始資產 8,000,000
- 年支出 420,000，通膨率 2%
- 期望報酬 5.5%，波動率 12%
- 稅率 12%
- 再平衡門檻 5%
- 股票/債券配置 60/40

## 計算邏輯與邊界條件

核心在 `packages/sim-core/src/monteCarlo.ts`：

1. 每次模擬逐年更新資產：
   - 退休前提款採年支出的 30%
   - 退休後提款採通膨調整後年支出
   - 稅負以提款金額乘以稅率估算
2. 年報酬使用常態分配抽樣（Box-Muller），並加入再平衡漂移影響有效股債配置。
3. 若資產跌至 0，該路徑提前結束並視為失敗。
4. `successRate = 成功路徑數 / iterations`。
5. 敏感度分析透過對指定參數套用 delta（如 ±10%）並重新執行 Monte Carlo。

### 邊界條件

- 資產不允許為負值（最小為 0）。
- 配置比例會被 clamp 在 `[0, 1]`。
- 若 `iterations` 過低，結果波動會較大。
- 此版本未含：序列風險分群、稅制細節（遞延/分離課稅）、費率、不同資產相關係數矩陣等。

## 驗證指令

```bash
npm run lint
npm run test
```

## 與 TPAW 不同處（目前簡化假設）

> 下列差異是本原型刻意簡化，方便先驗證 UI/互動流程，不代表正式 TPAW 的完整財務模型。

1. **提款規則簡化**
   - 本版僅支援兩種：固定金額、通膨調整。
   - 未納入 guardrail、動態消費上限/下限、市場連動調整等進階規則。
2. **報酬模型簡化**
   - 使用單一常態分配抽樣（均值/波動率），未納入 fat-tail、regime switching、資產間相關矩陣。
3. **稅務與費用簡化**
   - 稅負以提款金額乘固定稅率估算。
   - 尚未拆分帳戶類型、遞延課稅、費率（管理費/交易成本）與法規細節。
4. **情境儲存簡化**
   - 預設使用 `localStorage` 存 scenario，未做帳號同步、權限控管或版本管理。
5. **摘要指標簡化**
   - 「可持續提款區間」採多組支出倍率重新模擬的近似估算，並非最適化求解。

若要貼近正式 TPAW，下一步建議先補強：歷史路徑抽樣、資產類別相關性、動態提款政策、稅制分層與費率模型。
