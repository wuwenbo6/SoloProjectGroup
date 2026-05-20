use super::*;
use std::collections::BTreeMap;
use float_ord::FloatOrd;
use log::{warn, debug};

#[derive(Debug, Clone)]
pub enum OrderBookError {
    CancelQuantityExceedsAvailable {
        symbol: String,
        price: f64,
        side: Side,
        cancel_quantity: f64,
        available_quantity: f64,
    },
    PriceLevelNotFound {
        symbol: String,
        price: f64,
        side: Side,
    },
}

pub struct OrderBook {
    symbol: String,
    bids: BTreeMap<FloatOrd<f64>, f64>,
    asks: BTreeMap<FloatOrd<f64>, f64>,
    trades: Vec<Trade>,
    last_update: DateTime<Utc>,
    errors: Vec<OrderBookError>,
}

impl OrderBook {
    pub fn new(symbol: String) -> Self {
        Self {
            symbol,
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            trades: Vec::new(),
            last_update: Utc::now(),
            errors: Vec::new(),
        }
    }

    pub fn update_from_tick(&mut self, tick: &Level2Tick) {
        let price = FloatOrd(tick.price);
        
        if tick.quantity > 0.0 {
            match tick.side {
                Side::Buy => {
                    self.bids.insert(price, tick.quantity);
                }
                Side::Sell => {
                    self.asks.insert(price, tick.quantity);
                }
            }
        } else if tick.quantity == 0.0 {
            match tick.side {
                Side::Buy => {
                    self.bids.remove(&price);
                }
                Side::Sell => {
                    self.asks.remove(&price);
                }
            }
        } else {
            let cancel_quantity = -tick.quantity;
            self.handle_partial_cancel(price, cancel_quantity, tick.side, tick.timestamp);
        }
        
        self.last_update = tick.timestamp;
    }

    fn handle_partial_cancel(&mut self, price: FloatOrd<f64>, cancel_quantity: f64, side: Side, timestamp: DateTime<Utc>) {
        let order_map = match side {
            Side::Buy => &mut self.bids,
            Side::Sell => &mut self.asks,
        };

        if let Some(current_qty) = order_map.get_mut(&price) {
            if cancel_quantity > *current_qty {
                let error = OrderBookError::CancelQuantityExceedsAvailable {
                    symbol: self.symbol.clone(),
                    price: price.0,
                    side,
                    cancel_quantity,
                    available_quantity: *current_qty,
                };
                
                warn!("Order book warning: {:?}", error);
                self.errors.push(error);
                
                order_map.remove(&price);
            } else {
                *current_qty -= cancel_quantity;
                
                if *current_qty <= 0.0 {
                    order_map.remove(&price);
                }
            }
        } else {
            let error = OrderBookError::PriceLevelNotFound {
                symbol: self.symbol.clone(),
                price: price.0,
                side,
            };
            
            debug!("Order book info: {:?}", error);
            self.errors.push(error);
        }
    }

    pub fn errors(&self) -> &[OrderBookError] {
        &self.errors
    }

    pub fn clear_errors(&mut self) {
        self.errors.clear();
    }

    pub fn add_trade(&mut self, trade: Trade) {
        self.trades.push(trade);
    }

    pub fn snapshot(&self, depth: usize) -> OrderBookSnapshot {
        let bids: Vec<(f64, f64)> = self
            .bids
            .iter()
            .rev()
            .take(depth)
            .map(|(k, v)| (k.0, *v))
            .collect();

        let asks: Vec<(f64, f64)> = self
            .asks
            .iter()
            .take(depth)
            .map(|(k, v)| (k.0, *v))
            .collect();

        OrderBookSnapshot {
            symbol: self.symbol.clone(),
            timestamp: self.last_update,
            bids,
            asks,
        }
    }

    pub fn best_bid(&self) -> Option<(f64, f64)> {
        self.bids
            .iter()
            .next_back()
            .map(|(k, v)| (k.0, *v))
    }

    pub fn best_ask(&self) -> Option<(f64, f64)> {
        self.asks
            .iter()
            .next()
            .map(|(k, v)| (k.0, *v))
    }

    pub fn mid_price(&self) -> Option<f64> {
        match (self.best_bid(), self.best_ask()) {
            (Some((bid, _)), Some((ask, _))) => Some((bid + ask) / 2.0),
            _ => None,
        }
    }

    pub fn symbol(&self) -> &str {
        &self.symbol
    }

    pub fn trades(&self) -> &[Trade] {
        &self.trades
    }
}
