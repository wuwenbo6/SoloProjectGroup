use pyo3::prelude::*;
use pyo3::types::PyDict;
use pyo3::exceptions::PyException;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::time::Duration;
use crossbeam_channel::{bounded, Receiver, RecvTimeoutError};
use uuid::Uuid;
use orderbook::*;

#[derive(Debug, Clone)]
pub struct StrategyExecutionError {
    pub message: String,
    pub error_type: StrategyErrorType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StrategyErrorType {
    Timeout,
    ExecutionError,
    PythonError,
}

impl std::fmt::Display for StrategyExecutionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.error_type, self.message)
    }
}

impl std::error::Error for StrategyExecutionError {}

impl From<PyErr> for StrategyExecutionError {
    fn from(err: PyErr) -> Self {
        Self {
            message: err.to_string(),
            error_type: StrategyErrorType::PythonError,
        }
    }
}

const STRATEGY_EXECUTION_TIMEOUT: Duration = Duration::from_secs(5);

pub struct StrategyContext {
    pub capital: f64,
    pub positions: HashMap<String, f64>,
    pub orders: Vec<Order>,
    pub trades: Vec<Trade>,
    pub equity_curve: Vec<(i64, f64)>,
}

impl StrategyContext {
    pub fn new(initial_capital: f64) -> Self {
        Self {
            capital: initial_capital,
            positions: HashMap::new(),
            orders: Vec::new(),
            trades: Vec::new(),
            equity_curve: Vec::new(),
        }
    }

    pub fn get_position(&self, symbol: &str) -> f64 {
        *self.positions.get(symbol).unwrap_or(&0.0)
    }

    pub fn update_position(&mut self, symbol: &str, quantity: f64) {
        *self.positions.entry(symbol.to_string()).or_insert(0.0) += quantity;
    }

    pub fn total_equity(&self, current_prices: &HashMap<String, f64>) -> f64 {
        let mut equity = self.capital;
        for (symbol, qty) in &self.positions {
            if let Some(price) = current_prices.get(symbol) {
                equity += qty * price;
            }
        }
        equity
    }
}

pub struct PythonStrategy {
    code: String,
}

impl PythonStrategy {
    pub fn new(code: String) -> Self {
        Self { code }
    }

    pub fn execute(
        &self,
        ctx: &mut StrategyContext,
        orderbook: &OrderBookSnapshot,
        timestamp: i64,
    ) -> Result<Vec<Order>, StrategyExecutionError> {
        let code = self.code.clone();
        let symbol = orderbook.symbol.clone();
        let bids = orderbook.bids.clone();
        let asks = orderbook.asks.clone();
        let capital = ctx.capital;
        let position = ctx.get_position(&orderbook.symbol);

        let interrupted = Arc::new(AtomicBool::new(false));

        let (tx, rx) = bounded(1);

        let handle = std::thread::spawn(move || {
            let result = Python::with_gil(|py| {
                let locals = PyDict::new(py);
                
                let setup_code = r#"
import signal
import sys

def timeout_handler(signum, frame):
    raise TimeoutError("Strategy execution timed out")

try:
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.setitimer(signal.ITIMER_REAL, 4.5)
except:
    pass
"#;
                
                let _ = py.run(setup_code, None, Some(locals));

                match (|| -> PyResult<_> {
                    locals.set_item("bids", bids)?;
                    locals.set_item("asks", asks)?;
                    locals.set_item("symbol", symbol.as_str())?;
                    locals.set_item("timestamp", timestamp)?;
                    locals.set_item("capital", capital)?;
                    locals.set_item("position", position)?;
                    Ok(())
                })() {
                    Ok(_) => {}
                    Err(e) => {
                        eprintln!("Failed to set strategy locals: {}", e);
                        return Ok(Vec::new());
                    }
                }

                let exec_result = py.run(&code, None, Some(locals));
                
                let _ = py.run("signal.setitimer(signal.ITIMER_REAL, 0)", None, Some(locals));

                match exec_result {
                    Ok(_) => {
                        let orders_result: PyResult<Vec<PyObject>> = locals
                            .get_item("orders")
                            .and_then(|o| o.extract().ok())
                            .ok_or_else(|| PyException::new_err("'orders' variable not found"));

                        if let Ok(orders) = orders_result {
                            let mut strategy_orders = Vec::new();
                            
                            for order_dict in orders {
                                if let Ok(dict) = order_dict.downcast::<PyDict>(py) {
                                    let side: String = dict
                                        .get_item("side")
                                        .and_then(|s| s.extract().ok())
                                        .unwrap_or_else(|| "buy".to_string());
                                    let price: f64 = dict
                                        .get_item("price")
                                        .and_then(|p| p.extract().ok())
                                        .unwrap_or(0.0);
                                    let quantity: f64 = dict
                                        .get_item("quantity")
                                        .and_then(|q| q.extract().ok())
                                        .unwrap_or(0.0);

                                    let order_side = match side.to_lowercase().as_str() {
                                        "buy" => Side::Buy,
                                        "sell" => Side::Sell,
                                        _ => continue,
                                    };

                                    strategy_orders.push(Order::new(
                                        symbol.clone(),
                                        order_side,
                                        price,
                                        quantity,
                                    ));
                                }
                            }
                            
                            Ok(strategy_orders)
                        } else {
                            Ok(Vec::new())
                        }
                    }
                    Err(e) => {
                        let error_msg = e.to_string();
                        if error_msg.contains("TimeoutError") || error_msg.contains("timed out") {
                            Err(StrategyExecutionError {
                                message: "Strategy execution timed out".to_string(),
                                error_type: StrategyErrorType::Timeout,
                            })
                        } else {
                            Err(StrategyExecutionError {
                                message: error_msg,
                                error_type: StrategyErrorType::PythonError,
                            })
                        }
                    }
                }
            });

            let _ = tx.send(result);
        });

        match rx.recv_timeout(STRATEGY_EXECUTION_TIMEOUT) {
            Ok(result) => result,
            Err(RecvTimeoutError::Timeout) => {
                interrupted.store(true, Ordering::SeqCst);
                
                Python::with_gil(|py| {
                    unsafe {
                        pyo3::ffi::PyErr_SetInterrupt();
                    }
                });

                let _ = handle.join();

                Err(StrategyExecutionError {
                    message: "Strategy execution timed out after 5 seconds".to_string(),
                    error_type: StrategyErrorType::Timeout,
                })
            }
            Err(RecvTimeoutError::Disconnected) => {
                let _ = handle.join();
                Err(StrategyExecutionError {
                    message: "Strategy execution thread disconnected".to_string(),
                    error_type: StrategyErrorType::ExecutionError,
                })
            }
        }
    }
}
