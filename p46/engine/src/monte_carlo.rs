use super::*;
use orderbook::*;
use matching::*;
use std::collections::HashMap;
use chrono::{DateTime, Utc, TimeZone};
use rand::prelude::*;
use rand_distr::{Normal, Distribution};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonteCarloConfig {
    pub num_simulations: u32,
    pub use_bootstrap: bool,
    pub random_seed: Option<u64>,
    pub volatility_scale: f64,
}

impl Default for MonteCarloConfig {
    fn default() -> Self {
        Self {
            num_simulations: 100,
            use_bootstrap: true,
            random_seed: None,
            volatility_scale: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathStatistics {
    pub mean_return: f64,
    pub std_return: f64,
    pub min_return: f64,
    pub max_return: f64,
    pub median_return: f64,
    pub win_rate: f64,
    pub var_95: f64,
    pub var_99: f64,
    pub cvar_95: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SinglePathResult {
    pub path_id: u32,
    pub final_equity: f64,
    pub return_rate: f64,
    pub total_trades: u32,
    pub max_drawdown: f64,
    pub sharpe_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonteCarloResult {
    pub config: MonteCarloConfig,
    pub statistics: PathStatistics,
    pub all_paths: Vec<SinglePathResult>,
    pub return_histogram: Vec<(f64, f64, u32)>,
}

fn calculate_max_drawdown(equity_curve: &[(i64, f64)]) -> f64 {
    if equity_curve.is_empty() {
        return 0.0;
    }

    let mut peak = equity_curve[0].1;
    let mut max_dd = 0.0;

    for (_, equity) in equity_curve {
        if *equity > peak {
            peak = *equity;
        }
        let dd = (peak - equity) / peak;
        if dd > max_dd {
            max_dd = dd;
        }
    }

    max_dd
}

fn calculate_sharpe_ratio(equity_curve: &[(i64, f64)], risk_free_rate: f64) -> f64 {
    if equity_curve.len() < 2 {
        return 0.0;
    }

    let mut returns = Vec::new();
    for i in 1..equity_curve.len() {
        let ret = (equity_curve[i].1 - equity_curve[i-1].1) / equity_curve[i-1].1;
        returns.push(ret);
    }

    if returns.is_empty() {
        return 0.0;
    }

    let mean_ret: f64 = returns.iter().sum::<f64>() / returns.len() as f64;
    let variance: f64 = returns.iter().map(|r| (r - mean_ret).powi(2)).sum::<f64>() / returns.len() as f64;
    let std_ret = variance.sqrt();

    if std_ret == 0.0 {
        return 0.0;
    }

    let annualized_return = (1.0 + mean_ret).powi(252) - 1.0;
    let annualized_std = std_ret * (252.0f64).sqrt();

    (annualized_return - risk_free_rate) / annualized_std
}

fn bootstrap_resample(ticks: &[Level2Tick], rng: &mut impl Rng) -> Vec<Level2Tick> {
    if ticks.is_empty() {
        return Vec::new();
    }

    let n = ticks.len();
    let mut resampled = Vec::with_capacity(n);

    let base_time = ticks[0].timestamp;
    let avg_interval = if n > 1 {
        (ticks.last().unwrap().timestamp - base_time).num_milliseconds().unwrap_or(1) as f64 / (n - 1) as f64
    } else {
        1000.0
    };

    for i in 0..n {
        let idx = rng.gen_range(0..n);
        let mut tick = ticks[idx].clone();
        
        let new_time = base_time + chrono::Duration::milliseconds((i as f64 * avg_interval) as i64);
        tick.timestamp = new_time;
        
        resampled.push(tick);
    }

    resampled.sort_by_key(|t| t.timestamp);
    resampled
}

fn gbm_resample(ticks: &[Level2Tick], rng: &mut impl Rng, volatility_scale: f64) -> Vec<Level2Tick> {
    if ticks.is_empty() {
        return Vec::new();
    }

    let mut resampled = Vec::with_capacity(ticks.len());
    
    let mut bids: Vec<(f64, f64)> = Vec::new();
    let mut asks: Vec<(f64, f64)> = Vec::new();
    
    for tick in ticks {
        match tick.side {
            Side::Buy => bids.push((tick.price, tick.quantity)),
            Side::Sell => asks.push((tick.price, tick.quantity)),
        }
    }

    bids.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    asks.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

    let best_bid = bids.last().map(|(p, _)| *p).unwrap_or(100.0);
    let best_ask = asks.first().map(|(p, _)| *p).unwrap_or(101.0);
    let mid_price = (best_bid + best_ask) / 2.0;

    let volatility = (best_ask - best_bid) / mid_price * volatility_scale;
    let dt = 1.0 / ticks.len() as f64;
    let drift = -0.5 * volatility * volatility * dt;
    let diffusion = volatility * dt.sqrt();

    let normal = Normal::new(0.0, 1.0).unwrap();
    let mut current_price = mid_price;

    for (i, tick) in ticks.iter().enumerate() {
        let z = normal.sample(rng);
        let ret = drift + diffusion * z;
        current_price *= 1.0 + ret;

        let price_ratio = current_price / mid_price;
        
        let mut new_tick = tick.clone();
        new_tick.price = tick.price * price_ratio;
        new_tick.timestamp = tick.timestamp;
        
        resampled.push(new_tick);
    }

    resampled
}

pub async fn run_monte_carlo(
    initial_capital: f64,
    symbols: &[String],
    market_data: &HashMap<String, Vec<Level2Tick>>,
    strategy_code: &str,
    slippage_config: SlippageConfig,
    config: MonteCarloConfig,
) -> MonteCarloResult {
    let mut rng = if let Some(seed) = config.random_seed {
        StdRng::seed_from_u64(seed)
    } else {
        StdRng::from_entropy()
    };

    let mut all_results = Vec::new();
    let strategy = PythonStrategy::new(strategy_code.to_string());

    for path_id in 0..config.num_simulations {
        let mut path_market_data = HashMap::new();

        for symbol in symbols {
            if let Some(ticks) = market_data.get(symbol) {
                let resampled = if config.use_bootstrap {
                    bootstrap_resample(ticks, &mut rng)
                } else {
                    gbm_resample(ticks, &mut rng, config.volatility_scale)
                };
                path_market_data.insert(symbol.clone(), resampled);
            }
        }

        let mut engine = BacktestEngine::new(initial_capital)
            .with_slippage(slippage_config.clone());

        for symbol in symbols {
            if let Some(ticks) = path_market_data.get(symbol) {
                engine.add_symbol(symbol.clone(), ticks.clone(), strategy.clone());
            }
        }

        let result = engine.run().await;
        
        let max_drawdown = calculate_max_drawdown(&result.equity_curve);
        let sharpe_ratio = calculate_sharpe_ratio(&result.equity_curve, 0.02);

        all_results.push(SinglePathResult {
            path_id,
            final_equity: result.final_equity,
            return_rate: result.return_rate,
            total_trades: result.trades.len() as u32,
            max_drawdown,
            sharpe_ratio,
        });
    }

    let mut returns: Vec<f64> = all_results.iter().map(|r| r.return_rate).collect();
    returns.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let n = returns.len() as f64;
    let mean_return = returns.iter().sum::<f64>() / n;
    let variance = returns.iter().map(|r| (r - mean_return).powi(2)).sum::<f64>() / n;
    let std_return = variance.sqrt();

    let median_return = if returns.len() % 2 == 0 {
        (returns[returns.len() / 2 - 1] + returns[returns.len() / 2]) / 2.0
    } else {
        returns[returns.len() / 2]
    };

    let win_count = returns.iter().filter(|&&r| r > 0.0).count();
    let win_rate = win_count as f64 / n * 100.0;

    let var_95_idx = (n * 0.05) as usize;
    let var_99_idx = (n * 0.01) as usize;
    let var_95 = returns[var_95_idx.min(returns.len() - 1)];
    let var_99 = returns[var_99_idx.min(returns.len() - 1)];

    let cvar_95 = returns[0..=var_95_idx].iter().sum::<f64>() / (var_95_idx + 1) as f64;

    let num_bins = 20.min(returns.len() / 5).max(5);
    let min_ret = *returns.first().unwrap_or(&0.0);
    let max_ret = *returns.last().unwrap_or(&0.0);
    let bin_width = (max_ret - min_ret) / num_bins as f64;

    let mut histogram = Vec::new();
    for i in 0..num_bins {
        let bin_start = min_ret + i as f64 * bin_width;
        let bin_end = bin_start + bin_width;
        let count = returns.iter().filter(|&&r| r >= bin_start && r < bin_end).count() as u32;
        histogram.push((bin_start, bin_end, count));
    }

    MonteCarloResult {
        config,
        statistics: PathStatistics {
            mean_return,
            std_return,
            min_return: min_ret,
            max_return: max_ret,
            median_return,
            win_rate,
            var_95,
            var_99,
            cvar_95,
        },
        all_paths,
        return_histogram: histogram,
    }
}
