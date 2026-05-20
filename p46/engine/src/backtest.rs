use super::*;
use orderbook::*;
use matching::*;
use crate::strategy::StrategyErrorType;
use std::collections::HashMap;
use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlippageTradeInfo {
    pub original_price: f64,
    pub executed_price: f64,
    pub slippage_bps: f64,
    pub slippage_value: f64,
    pub levels_penetrated: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyErrorStats {
    pub timeouts: u32,
    pub python_errors: u32,
    pub execution_errors: u32,
}

pub struct BacktestResult {
    pub equity_curve: Vec<(i64, f64)>,
    pub trades: Vec<Trade>,
    pub final_equity: f64,
    pub return_rate: f64,
    pub orderbooks: HashMap<String, Vec<OrderBookSnapshot>>,
    pub total_slippage_cost: f64,
    pub slippage_per_trade: Vec<SlippageTradeInfo>,
    pub strategy_errors: StrategyErrorStats,
}

pub struct BacktestEngine {
    initial_capital: f64,
    symbols: Vec<String>,
    strategies: HashMap<String, PythonStrategy>,
    market_data: HashMap<String, Vec<Level2Tick>>,
    slippage_config: SlippageConfig,
}

impl BacktestEngine {
    pub fn new(initial_capital: f64) -> Self {
        Self {
            initial_capital,
            symbols: Vec::new(),
            strategies: HashMap::new(),
            market_data: HashMap::new(),
            slippage_config: SlippageConfig::default(),
        }
    }

    pub fn with_slippage(mut self, config: SlippageConfig) -> Self {
        self.slippage_config = config;
        self
    }

    pub fn set_slippage(&mut self, config: SlippageConfig) {
        self.slippage_config = config;
    }

    pub fn add_symbol(&mut self, symbol: String, ticks: Vec<Level2Tick>, strategy: PythonStrategy) {
        self.symbols.push(symbol.clone());
        self.market_data.insert(symbol.clone(), ticks);
        self.strategies.insert(symbol, strategy);
    }

    pub async fn run(&mut self) -> BacktestResult {
        let mut ctx = StrategyContext::new(self.initial_capital);
        let mut orderbooks: HashMap<String, OrderBook> = HashMap::new();
        let mut matching_engines: HashMap<String, MatchingEngine> = HashMap::new();
        let mut snapshots: HashMap<String, Vec<OrderBookSnapshot>> = HashMap::new();
        let mut total_slippage_cost = 0.0;
        let mut slippage_per_trade = Vec::new();
        let mut strategy_errors = StrategyErrorStats {
            timeouts: 0,
            python_errors: 0,
            execution_errors: 0,
        };

        for symbol in &self.symbols {
            orderbooks.insert(symbol.clone(), OrderBook::new(symbol.clone()));
            
            let me = MatchingEngine::with_slippage(
                symbol.clone(), 
                self.slippage_config.clone()
            );
            matching_engines.insert(symbol.clone(), me);
            snapshots.insert(symbol.clone(), Vec::new());
        }

        let mut all_timestamps: Vec<i64> = Vec::new();
        for (_, ticks) in &self.market_data {
            for tick in ticks {
                all_timestamps.push(tick.timestamp.timestamp_millis());
            }
        }
        all_timestamps.sort();
        all_timestamps.dedup();

        let mut current_tick_indices: HashMap<String, usize> = self
            .symbols
            .iter()
            .map(|s| (s.clone(), 0))
            .collect();

        for timestamp in all_timestamps {
            for symbol in &self.symbols {
                let ticks = self.market_data.get(symbol).unwrap();
                let idx = current_tick_indices.get_mut(symbol).unwrap();

                while *idx < ticks.len() && ticks[*idx].timestamp.timestamp_millis() <= timestamp {
                    if let Some(ob) = orderbooks.get_mut(symbol) {
                        ob.update_from_tick(&ticks[*idx]);
                    }
                    *idx += 1;
                }
            }

            let mut current_prices: HashMap<String, f64> = HashMap::new();
            for symbol in &self.symbols {
                if let Some(ob) = orderbooks.get(symbol) {
                    if let Some(mid) = ob.mid_price() {
                        current_prices.insert(symbol.clone(), mid);
                    }
                }
            }

            for symbol in &self.symbols {
                if let Some(ob) = orderbooks.get(symbol) {
                    let snapshot = ob.snapshot(10);
                    
                    if let Some(me) = matching_engines.get_mut(symbol) {
                        me.update_market_orderbook(snapshot.clone());
                    }
                    
                    snapshots.get_mut(symbol).unwrap().push(snapshot.clone());

                    if let Some(strategy) = self.strategies.get(symbol) {
                        match strategy.execute(&mut ctx, &snapshot, timestamp) {
                            Ok(orders) => {
                                if let Some(me) = matching_engines.get_mut(symbol) {
                                    for order in orders {
                                        let original_best_price = match order.side {
                                            Side::Buy => snapshot.asks.first().map(|(p, _)| *p),
                                            Side::Sell => snapshot.bids.first().map(|(p, _)| *p),
                                        };
                                        
                                        let trades = me.submit_order(order);
                                        
                                        for trade in &trades {
                                            if let Some(original_price) = original_best_price {
                                                let slippage_value = trade.price - original_price;
                                                let slippage_bps = (slippage_value / original_price) * 10000.0;
                                                
                                                let slippage_cost = slippage_value * trade.quantity;
                                                total_slippage_cost += slippage_cost.abs();
                                                
                                                slippage_per_trade.push(SlippageTradeInfo {
                                                    original_price,
                                                    executed_price: trade.price,
                                                    slippage_bps,
                                                    slippage_value,
                                                    levels_penetrated: 0,
                                                });
                                            }
                                            
                                            ctx.capital -= trade.price * trade.quantity;
                                            ctx.update_position(symbol, trade.quantity);
                                            ctx.trades.push(trade.clone());
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                match e.error_type {
                                    StrategyErrorType::Timeout => strategy_errors.timeouts += 1,
                                    StrategyErrorType::PythonError => strategy_errors.python_errors += 1,
                                    StrategyErrorType::ExecutionError => strategy_errors.execution_errors += 1,
                                }
                            }
                        }
                    }
                }
            }

            let equity = ctx.total_equity(&current_prices);
            ctx.equity_curve.push((timestamp, equity));
        }

        let final_equity = ctx.equity_curve.last().map(|(_, e)| *e).unwrap_or(self.initial_capital);
        let return_rate = (final_equity - self.initial_capital) / self.initial_capital * 100.0;

        BacktestResult {
            equity_curve: ctx.equity_curve,
            trades: ctx.trades,
            final_equity,
            return_rate,
            orderbooks: snapshots,
            total_slippage_cost,
            slippage_per_trade,
            strategy_errors,
        }
    }
}
