use sim_core::{
    run_simulation, RebalanceRule, ReturnMode, SimulationInput, SpendingPath, WithdrawalRule,
    WithdrawalTiming,
};

fn approx_eq(a: f64, b: f64, tol: f64) {
    assert!((a - b).abs() <= tol, "expected {b}, got {a}");
}

#[test]
fn deterministic_case_matches_expected_path() {
    let input = SimulationInput {
        initial_assets: 1_000_000.0,
        current_age: 65,
        retirement_years: 3,
        stock_weight: 0.6,
        bond_weight: 0.4,
        stock_return_mean: 0.05,
        stock_return_volatility: 0.0,
        bond_return_mean: 0.03,
        bond_return_volatility: 0.0,
        stock_bond_correlation: 0.0,
        inflation_mean: 0.02,
        inflation_volatility: 0.0,
        tax_rate: 0.0,
        fee_rate: 0.0,
        spending_path: SpendingPath::FixedReal {
            annual_amount: 40_000.0,
        },
        withdrawal_rule: WithdrawalRule::FixedAmount {
            timing: WithdrawalTiming::StartOfYear,
        },
        rebalance_rule: RebalanceRule::Annual,
        transaction_cost_rate: 0.0,
        return_mode: ReturnMode::Nominal,
        simulation_paths: 1,
        random_seed: 42,
    };

    let output = run_simulation(&input);
    let path = &output.yearly_assets_by_path[0];

    assert_eq!(path.len(), 4);
    approx_eq(path[0], 1_000_000.0, 1e-6);
    approx_eq(path[1], 999_486.4, 1e-6);
    approx_eq(path[2], 998_100.9568, 1e-6);
    approx_eq(path[3], 995_790.0475456002, 1e-6);

    approx_eq(output.success_rate, 1.0, 1e-12);
    assert_eq!(output.failure_year_by_path, vec![None]);
    approx_eq(output.final_asset_quantiles.p50, 995_790.0475456002, 1e-6);
}

#[test]
fn small_sample_seeded_run_is_stable() {
    let input = SimulationInput {
        initial_assets: 500_000.0,
        current_age: 60,
        retirement_years: 5,
        stock_weight: 0.7,
        bond_weight: 0.3,
        stock_return_mean: 0.06,
        stock_return_volatility: 0.15,
        bond_return_mean: 0.02,
        bond_return_volatility: 0.05,
        stock_bond_correlation: 0.2,
        inflation_mean: 0.02,
        inflation_volatility: 0.01,
        tax_rate: 0.1,
        fee_rate: 0.005,
        spending_path: SpendingPath::GrowingNominal {
            initial_amount: 25_000.0,
            annual_growth: 0.02,
        },
        withdrawal_rule: WithdrawalRule::Guardrail {
            initial_rate: 0.05,
            floor_rate: 0.04,
            ceiling_rate: 0.06,
            adjust_fraction: 0.1,
            timing: WithdrawalTiming::EndOfYear,
        },
        rebalance_rule: RebalanceRule::Annual,
        transaction_cost_rate: 0.001,
        return_mode: ReturnMode::Real,
        simulation_paths: 4,
        random_seed: 7,
    };

    let output = run_simulation(&input);

    approx_eq(output.success_rate, 1.0, 1e-12);
    approx_eq(output.final_asset_quantiles.p10, 345_011.2234980033, 1e-6);
    approx_eq(output.final_asset_quantiles.p50, 478_756.76583945326, 1e-6);
    approx_eq(output.final_asset_quantiles.p90, 584_095.2913306322, 1e-6);

    assert_eq!(output.failure_year_distribution.len(), 0);
    assert_eq!(output.p50_asset_curve.len(), 6);
    approx_eq(output.p50_asset_curve[0], 500_000.0, 1e-6);
    approx_eq(output.p50_asset_curve[5], 478_756.76583945326, 1e-6);
}
