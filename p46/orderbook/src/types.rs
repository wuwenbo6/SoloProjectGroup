use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use float_ord::FloatOrd;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Side {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Level2Tick {
    pub timestamp: DateTime<Utc>,
    pub price: f64,
    pub quantity: f64,
    pub side: Side,
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub symbol: String,
    pub side: Side,
    pub price: f64,
    pub quantity: f64,
    pub filled_quantity: f64,
    pub timestamp: DateTime<Utc>,
    pub status: OrderStatus,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderStatus {
    Pending,
    PartialFilled,
    Filled,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: Uuid,
    pub symbol: String,
    pub price: f64,
    pub quantity: f64,
    pub buyer_order_id: Uuid,
    pub seller_order_id: Uuid,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBookSnapshot {
    pub symbol: String,
    pub timestamp: DateTime<Utc>,
    pub bids: Vec<(f64, f64)>,
    pub asks: Vec<(f64, f64)>,
}

impl Order {
    pub fn new(symbol: String, side: Side, price: f64, quantity: f64) -> Self {
        Self {
            id: Uuid::new_v4(),
            symbol,
            side,
            price,
            quantity,
            filled_quantity: 0.0,
            timestamp: Utc::now(),
            status: OrderStatus::Pending,
        }
    }

    pub fn remaining_quantity(&self) -> f64 {
        self.quantity - self.filled_quantity
    }
}
