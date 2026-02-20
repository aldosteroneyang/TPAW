use std::collections::BTreeMap;

use crate::model::{
    QuantileSummary, RebalanceRule, ReturnMode, SimulationInput, SimulationOutput, SpendingPath,
    WithdrawalRule, WithdrawalTiming,
};

#[derive(Debug, Clone, Copy)]
struct YearMarketSample {
    stock_nominal_return: f64,
    bond_nominal_return: f64,
    inflation: f64,
}

pub fn run_simulation(input: &SimulationInput) -> SimulationOutput {
    validate_input(input);

    let mut rng = DeterministicRng::new(input.random_seed);
    let mut yearly_assets_by_path = Vec::with_capacity(input.simulation_paths);
    let mut failure_year_by_path = Vec::with_capacity(input.simulation_paths);
    let mut max_drawdown_by_path = Vec::with_capacity(input.simulation_paths);

    for _ in 0..input.simulation_paths {
        let market_path = generate_market_path(input, &mut rng);
        let path_result = simulate_one_path(input, &market_path);
        yearly_assets_by_path.push(path_result.yearly_assets);
        failure_year_by_path.push(path_result.failure_year);
        max_drawdown_by_path.push(path_result.max_drawdown);
    }

    let final_assets: Vec<f64> = yearly_assets_by_path
        .iter()
        .map(|assets| *assets.last().unwrap_or(&0.0))
        .collect();
    let success_count = failure_year_by_path.iter().filter(|year| year.is_none()).count();
    let success_rate = success_count as f64 / input.simulation_paths as f64;

    let final_asset_quantiles = QuantileSummary {
        p10: compute_quantile(&final_assets, 0.10),
        p50: compute_quantile(&final_assets, 0.50),
        p90: compute_quantile(&final_assets, 0.90),
    };

    let (p10_asset_curve, p50_asset_curve, p90_asset_curve) =
        aggregate_asset_curves(&yearly_assets_by_path, input.retirement_years + 1);

    let mut failure_year_distribution = BTreeMap::new();
    for year in failure_year_by_path.iter().flatten() {
        *failure_year_distribution.entry(*year).or_insert(0) += 1;
    }

    SimulationOutput {
        yearly_assets_by_path,
        failure_year_by_path,
        final_asset_quantiles,
        success_rate,
        p10_asset_curve,
        p50_asset_curve,
        p90_asset_curve,
        max_drawdown_by_path,
        failure_year_distribution,
    }
}

#[derive(Debug)]
struct PathResult {
    yearly_assets: Vec<f64>,
    failure_year: Option<usize>,
    max_drawdown: f64,
}

fn simulate_one_path(input: &SimulationInput, market_path: &[YearMarketSample]) -> PathResult {
    let mut yearly_assets = Vec::with_capacity(input.retirement_years + 1);
    let mut total_assets = input.initial_assets;
    let mut stock_assets = total_assets * input.stock_weight;
    let mut bond_assets = total_assets * input.bond_weight;

    let mut failure_year = None;
    let mut previous_withdrawal = None;
    let mut cumulative_inflation = 1.0;

    let mut peak_assets = total_assets;
    let mut max_drawdown: f64 = 0.0;

    yearly_assets.push(total_assets);

    for (year_idx, sample) in market_path.iter().enumerate() {
        cumulative_inflation *= 1.0 + sample.inflation;

        let planned_spending = spending_for_year(&input.spending_path, year_idx, cumulative_inflation);
        let withdrawal_timing = withdrawal_timing(input);

        if matches!(withdrawal_timing, WithdrawalTiming::StartOfYear) {
            let withdrawal = resolve_withdrawal_amount(
                input,
                year_idx,
                total_assets,
                planned_spending,
                sample.inflation,
                previous_withdrawal,
            );
            total_assets = apply_withdrawal(total_assets, withdrawal);
            previous_withdrawal = Some(withdrawal);
            if total_assets <= 0.0 && failure_year.is_none() {
                failure_year = Some(year_idx + 1);
            }
            rebalance_if_needed(input, &mut stock_assets, &mut bond_assets, total_assets);
        }

        stock_assets *= 1.0 + sample.stock_nominal_return;
        bond_assets *= 1.0 + sample.bond_nominal_return;

        let pre_fee_assets = (stock_assets + bond_assets).max(0.0);
        let after_fee_assets = pre_fee_assets * (1.0 - input.fee_rate).max(0.0);
        let taxable_gain = (after_fee_assets - total_assets).max(0.0);
        let taxes = taxable_gain * input.tax_rate;
        total_assets = (after_fee_assets - taxes).max(0.0);

        if matches!(withdrawal_timing, WithdrawalTiming::EndOfYear) {
            let withdrawal = resolve_withdrawal_amount(
                input,
                year_idx,
                total_assets,
                planned_spending,
                sample.inflation,
                previous_withdrawal,
            );
            total_assets = apply_withdrawal(total_assets, withdrawal);
            previous_withdrawal = Some(withdrawal);
            if total_assets <= 0.0 && failure_year.is_none() {
                failure_year = Some(year_idx + 1);
            }
        }

        rebalance_if_needed(input, &mut stock_assets, &mut bond_assets, total_assets);

        peak_assets = peak_assets.max(total_assets);
        if peak_assets > 0.0 {
            let drawdown = (peak_assets - total_assets) / peak_assets;
            max_drawdown = max_drawdown.max(drawdown);
        }

        yearly_assets.push(total_assets);
    }

    PathResult {
        yearly_assets,
        failure_year,
        max_drawdown,
    }
}

fn rebalance_if_needed(
    input: &SimulationInput,
    stock_assets: &mut f64,
    bond_assets: &mut f64,
    total_assets: f64,
) {
    if !matches!(input.rebalance_rule, RebalanceRule::Annual) {
        return;
    }

    let target_stock = total_assets * input.stock_weight;
    let target_bond = total_assets * input.bond_weight;
    let trade_volume = (target_stock - *stock_assets).abs() + (target_bond - *bond_assets).abs();
    let transaction_cost = trade_volume * input.transaction_cost_rate * 0.5;
    let adjusted_assets = (total_assets - transaction_cost).max(0.0);

    *stock_assets = adjusted_assets * input.stock_weight;
    *bond_assets = adjusted_assets * input.bond_weight;
}

fn apply_withdrawal(total_assets: f64, amount: f64) -> f64 {
    (total_assets - amount.max(0.0)).max(0.0)
}

fn withdrawal_timing(input: &SimulationInput) -> WithdrawalTiming {
    match input.withdrawal_rule {
        WithdrawalRule::FixedAmount { timing }
        | WithdrawalRule::FixedPercentage { timing, .. }
        | WithdrawalRule::Guardrail { timing, .. } => timing,
    }
}

fn resolve_withdrawal_amount(
    input: &SimulationInput,
    year_idx: usize,
    total_assets: f64,
    planned_spending: f64,
    inflation: f64,
    previous_withdrawal: Option<f64>,
) -> f64 {
    match input.withdrawal_rule {
        WithdrawalRule::FixedAmount { .. } => planned_spending,
        WithdrawalRule::FixedPercentage { rate, .. } => total_assets * rate,
        WithdrawalRule::Guardrail {
            initial_rate,
            floor_rate,
            ceiling_rate,
            adjust_fraction,
            ..
        } => {
            if year_idx == 0 || previous_withdrawal.is_none() {
                return total_assets * initial_rate;
            }

            let mut next_withdrawal = previous_withdrawal.unwrap() * (1.0 + inflation.max(-0.99));
            let current_rate = if total_assets > 0.0 {
                next_withdrawal / total_assets
            } else {
                ceiling_rate + 1.0
            };

            if current_rate > ceiling_rate {
                next_withdrawal *= 1.0 - adjust_fraction;
            } else if current_rate < floor_rate {
                next_withdrawal *= 1.0 + adjust_fraction;
            }

            next_withdrawal.max(planned_spending.min(next_withdrawal))
        }
    }
}

fn spending_for_year(spending_path: &SpendingPath, year_idx: usize, cumulative_inflation: f64) -> f64 {
    match spending_path {
        SpendingPath::FixedReal { annual_amount } => annual_amount * cumulative_inflation,
        SpendingPath::GrowingNominal {
            initial_amount,
            annual_growth,
        } => initial_amount * (1.0 + annual_growth).powf(year_idx as f64),
        SpendingPath::CustomNominal { yearly_amounts } => yearly_amounts
            .get(year_idx)
            .copied()
            .unwrap_or_else(|| *yearly_amounts.last().unwrap_or(&0.0)),
    }
}

fn generate_market_path(input: &SimulationInput, rng: &mut DeterministicRng) -> Vec<YearMarketSample> {
    let mut out = Vec::with_capacity(input.retirement_years);
    let cholesky_offdiag = (1.0 - input.stock_bond_correlation.powi(2)).sqrt();

    for _ in 0..input.retirement_years {
        let z1: f64 = rng.sample_standard_normal();
        let z2: f64 = rng.sample_standard_normal();

        let stock_random = z1;
        let bond_random = input.stock_bond_correlation * z1 + cholesky_offdiag * z2;

        let stock_draw = input.stock_return_mean + input.stock_return_volatility * stock_random;
        let bond_draw = input.bond_return_mean + input.bond_return_volatility * bond_random;

        let inflation_z: f64 = rng.sample_standard_normal();
        let inflation = input.inflation_mean + input.inflation_volatility * inflation_z;

        let (stock_nominal_return, bond_nominal_return) = match input.return_mode {
            ReturnMode::Nominal => (stock_draw, bond_draw),
            ReturnMode::Real => (
                (1.0 + stock_draw) * (1.0 + inflation) - 1.0,
                (1.0 + bond_draw) * (1.0 + inflation) - 1.0,
            ),
        };

        out.push(YearMarketSample {
            stock_nominal_return,
            bond_nominal_return,
            inflation,
        });
    }

    out
}

fn aggregate_asset_curves(paths: &[Vec<f64>], total_year_points: usize) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let mut p10 = Vec::with_capacity(total_year_points);
    let mut p50 = Vec::with_capacity(total_year_points);
    let mut p90 = Vec::with_capacity(total_year_points);

    for year in 0..total_year_points {
        let year_assets: Vec<f64> = paths.iter().map(|path| path.get(year).copied().unwrap_or(0.0)).collect();
        p10.push(compute_quantile(&year_assets, 0.10));
        p50.push(compute_quantile(&year_assets, 0.50));
        p90.push(compute_quantile(&year_assets, 0.90));
    }

    (p10, p50, p90)
}

fn compute_quantile(values: &[f64], q: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }

    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let rank = ((sorted.len() - 1) as f64 * q).round() as usize;
    sorted[rank.min(sorted.len() - 1)]
}

fn validate_input(input: &SimulationInput) {
    assert!(input.simulation_paths > 0, "simulation_paths must be > 0");
    assert!(input.retirement_years > 0, "retirement_years must be > 0");
    assert!((input.stock_weight + input.bond_weight - 1.0).abs() < 1e-6);
    assert!(input.stock_bond_correlation.abs() <= 1.0);
}

#[derive(Debug, Clone)]
struct DeterministicRng {
    state: u64,
    cached_normal: Option<f64>,
}

impl DeterministicRng {
    fn new(seed: u64) -> Self {
        Self {
            state: seed.wrapping_add(0x9E3779B97F4A7C15),
            cached_normal: None,
        }
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self
            .state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.state
    }

    fn next_f64_open01(&mut self) -> f64 {
        let bits = self.next_u64() >> 11;
        (bits as f64 + 0.5) / ((1u64 << 53) as f64)
    }

    fn sample_standard_normal(&mut self) -> f64 {
        if let Some(cached) = self.cached_normal.take() {
            return cached;
        }

        let u1 = self.next_f64_open01();
        let u2 = self.next_f64_open01();
        let r = (-2.0 * u1.ln()).sqrt();
        let theta = 2.0 * std::f64::consts::PI * u2;

        let z0 = r * theta.cos();
        let z1 = r * theta.sin();
        self.cached_normal = Some(z1);
        z0
    }
}
