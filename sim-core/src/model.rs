use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ReturnMode {
    Real,
    Nominal,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WithdrawalTiming {
    StartOfYear,
    EndOfYear,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SpendingPath {
    FixedReal { annual_amount: f64 },
    GrowingNominal { initial_amount: f64, annual_growth: f64 },
    CustomNominal { yearly_amounts: Vec<f64> },
}

#[derive(Debug, Clone, PartialEq)]
pub enum WithdrawalRule {
    FixedAmount {
        timing: WithdrawalTiming,
    },
    FixedPercentage {
        rate: f64,
        timing: WithdrawalTiming,
    },
    Guardrail {
        initial_rate: f64,
        floor_rate: f64,
        ceiling_rate: f64,
        adjust_fraction: f64,
        timing: WithdrawalTiming,
    },
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RebalanceRule {
    Annual,
    None,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SimulationInput {
    pub initial_assets: f64,
    pub current_age: u32,
    pub retirement_years: usize,
    pub stock_weight: f64,
    pub bond_weight: f64,
    pub stock_return_mean: f64,
    pub stock_return_volatility: f64,
    pub bond_return_mean: f64,
    pub bond_return_volatility: f64,
    pub stock_bond_correlation: f64,
    pub inflation_mean: f64,
    pub inflation_volatility: f64,
    pub tax_rate: f64,
    pub fee_rate: f64,
    pub spending_path: SpendingPath,
    pub withdrawal_rule: WithdrawalRule,
    pub rebalance_rule: RebalanceRule,
    pub transaction_cost_rate: f64,
    pub return_mode: ReturnMode,
    pub simulation_paths: usize,
    pub random_seed: u64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct QuantileSummary {
    pub p10: f64,
    pub p50: f64,
    pub p90: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SimulationOutput {
    pub yearly_assets_by_path: Vec<Vec<f64>>,
    pub failure_year_by_path: Vec<Option<usize>>,
    pub final_asset_quantiles: QuantileSummary,
    pub success_rate: f64,
    pub p10_asset_curve: Vec<f64>,
    pub p50_asset_curve: Vec<f64>,
    pub p90_asset_curve: Vec<f64>,
    pub max_drawdown_by_path: Vec<f64>,
    pub failure_year_distribution: BTreeMap<usize, usize>,
}
