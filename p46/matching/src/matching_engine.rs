use orderbook::*;
use std::collections::{BTreeMap, HashMap};
use float_ord::FloatOrd;
use uuid::Uuid;
use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SlippageModel {
    None,
    Fixed { value: f64 },
    LiquidityBased { impact_factor: f64, max_slippage: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlippageConfig {
    pub model: SlippageModel,
    pub market_order_book: Option<OrderBookSnapshot>,
}

impl Default for SlippageConfig {
    fn default() -> Self {
        Self {
            model: SlippageModel::None,
            market_order_book: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlippageResult {
    pub original_price: f64,
    pub executed_price: f64,
    pub slippage_bps: f64,
    pub slippage_value: f64,
    pub levels_penetrated: usize,
}

impl SlippageConfig {
    pub fn calculate_slippage(&self, order: &Order, order_qty: f64, filled_qty: f64, level_price: f64) -> SlippageResult {
        match self.model {
            SlippageModel::None => {
                SlippageResult {
                    original_price: level_price,
                    executed_price: level_price,
                    slippage_bps: 0.0,
                    slippage_value: 0.0,
                    levels_penetrated: 0,
                }
            }
            SlippageModel::Fixed { value } => {
                let slippage_value = match order.side {
                    Side::Buy => value,
                    Side::Sell => -value,
                };
                let executed_price = level_price + slippage_value;
                let slippage_bps = (slippage_value / level_price) * 10000.0;
                
                SlippageResult {
                    original_price: level_price,
                    executed_price,
                    slippage_bps,
                    slippage_value,
                    levels_penetrated: 0,
                }
            }
            SlippageModel::LiquidityBased { impact_factor, max_slippage } => {
                let (levels, total_qty, price_levels) = match order.side {
                    Side::Buy => self.get_ask_levels(),
                    Side::Sell => self.get_bid_levels(),
                };
                
                let (executed_price, levels_penetrated) = 
                    self.calculate_liquidity_slippage(order_qty, filled_qty, &price_levels, order.side, impact_factor, max_slippage);
                
                let slippage_value = executed_price - level_price;
                let slippage_bps = (slippage_value / level_price) * 10000.0;
                
                SlippageResult {
                    original_price: level_price,
                    executed_price,
                    slippage_bps,
                    slippage_value,
                    levels_penetrated,
                }
            }
        }
    }

    fn get_ask_levels(&self) -> (usize, f64, Vec<(f64, f64)>) {
        if let Some(ob) = &self.market_order_book {
            let total_qty: f64 = ob.asks.iter().map(|(_, qty)| *qty).sum();
            (ob.asks.len(), total_qty, ob.asks.clone())
        } else {
            (0, 0.0, Vec::new())
        }
    }

    fn get_bid_levels(&self) -> (usize, f64, Vec<(f64, f64)>) {
        if let Some(ob) = &self.market_order_book {
            let total_qty: f64 = ob.bids.iter().map(|(_, qty)| *qty).sum();
            let mut bids_reversed = ob.bids.clone();
            bids_reversed.reverse();
            (ob.bids.len(), total_qty, bids_reversed)
        } else {
            (0, 0.0, Vec::new())
        }
    }

    fn calculate_liquidity_slippage(
        &self,
        order_qty: f64,
        filled_qty: f64,
        price_levels: &[(f64, f64)],
        side: Side,
        impact_factor: f64,
        max_slippage: f64,
    ) -> (f64, usize) {
        if price_levels.is_empty() || filled_qty <= 0.0 {
            return (price_levels.first().map(|(p, _)| *p).unwrap_or(0.0), 0);
        }

        let mut remaining_qty = filled_qty;
        let mut total_weighted_price = 0.0;
        let mut total_filled = 0.0;
        let mut levels_penetrated = 0;

        for (i, (price, qty)) in price_levels.iter().enumerate() {
            if remaining_qty <= 0.0 {
                break;
            }

            let fill_qty = remaining_qty.min(*qty);
            let level_impact = impact_factor * (filled_qty / qty.max(0.0001)).sqrt();
            
            let slippage_at_level = match side {
                Side::Buy => price.abs() * level_impact.min(max_slippage),
                Side::Sell => -price.abs() * level_impact.min(max_slippage),
            };

            let adjusted_price = price + slippage_at_level;
            total_weighted_price += adjusted_price * fill_qty;
            total_filled += fill_qty;
            remaining_qty -= fill_qty;

            if fill_qty > 0.0 {
                levels_penetrated = i + 1;
            }
        }

        let avg_price = if total_filled > 0.0 {
            total_weighted_price / total_filled
        } else {
            price_levels[0].0
        };

        (avg_price, levels_penetrated)
    }
}

pub struct MatchingEngine {
    symbol: String,
    buy_orders: BTreeMap<FloatOrd<f64>, Vec<Order>>,
    sell_orders: BTreeMap<FloatOrd<f64>, Vec<Order>>,
    order_map: HashMap<Uuid, Order>,
    trades: Vec<Trade>,
    slippage_config: SlippageConfig,
}

impl MatchingEngine {
    pub fn new(symbol: String) -> Self {
        Self {
            symbol,
            buy_orders: BTreeMap::new(),
            sell_orders: BTreeMap::new(),
            order_map: HashMap::new(),
            trades: Vec::new(),
            slippage_config: SlippageConfig::default(),
        }
    }

    pub fn with_slippage(symbol: String, config: SlippageConfig) -> Self {
        Self {
            symbol,
            buy_orders: BTreeMap::new(),
            sell_orders: BTreeMap::new(),
            order_map: HashMap::new(),
            trades: Vec::new(),
            slippage_config: config,
        }
    }

    pub fn update_slippage_config(&mut self, config: SlippageConfig) {
        self.slippage_config = config;
    }

    pub fn update_market_orderbook(&mut self, orderbook: OrderBookSnapshot) {
        self.slippage_config.market_order_book = Some(orderbook);
    }

    pub fn submit_order(&mut self, mut order: Order) -> Vec<Trade> {
        let order_qty = order.quantity;
        let mut trades = Vec::new();

        match order.side {
            Side::Buy => {
                trades = self.match_buy_order(&mut order, order_qty);
            }
            Side::Sell => {
                trades = self.match_sell_order(&mut order, order_qty);
            }
        }

        if order.remaining_quantity() > 0.0 && order.status != OrderStatus::Cancelled {
            self.add_order_to_book(order.clone());
        }

        self.order_map.insert(order.id, order);
        self.trades.extend(trades.clone());

        trades
    }

    pub fn cancel_order(&mut self, order_id: Uuid) -> Option<Order> {
        if let Some(mut order) = self.order_map.remove(&order_id) {
            order.status = OrderStatus::Cancelled;
            self.remove_order_from_book(&order);
            self.order_map.insert(order_id, order.clone());
            Some(order)
        } else {
            None
        }
    }

    fn match_buy_order(&mut self, buy_order: &mut Order, order_qty: f64) -> Vec<Trade> {
        let mut trades = Vec::new();
        let mut total_filled = 0.0;

        while buy_order.remaining_quantity() > 0.0 {
            let best_ask_price = self.sell_orders.keys().next().copied();

            match best_ask_price {
                Some(ask_price) if ask_price.0 <= buy_order.price => {
                    let sell_orders = self.sell_orders.get_mut(&ask_price).unwrap();

                    while let Some(sell_order) = sell_orders.first_mut() {
                        if buy_order.remaining_quantity() <= 0.0 {
                            break;
                        }

                        let trade_quantity = buy_order
                            .remaining_quantity()
                            .min(sell_order.remaining_quantity());
                        total_filled += trade_quantity;

                        let slippage_result = self.slippage_config.calculate_slippage(
                            buy_order,
                            order_qty,
                            total_filled,
                            ask_price.0,
                        );
                        let trade_price = slippage_result.executed_price;

                        buy_order.filled_quantity += trade_quantity;
                        sell_order.filled_quantity += trade_quantity;

                        if buy_order.filled_quantity == buy_order.quantity {
                            buy_order.status = OrderStatus::Filled;
                        } else {
                            buy_order.status = OrderStatus::PartialFilled;
                        }

                        if sell_order.filled_quantity == sell_order.quantity {
                            sell_order.status = OrderStatus::Filled;
                            self.order_map.insert(sell_order.id, sell_order.clone());
                        } else {
                            sell_order.status = OrderStatus::PartialFilled;
                            self.order_map.insert(sell_order.id, sell_order.clone());
                        }

                        let trade = Trade {
                            id: Uuid::new_v4(),
                            symbol: self.symbol.clone(),
                            price: trade_price,
                            quantity: trade_quantity,
                            buyer_order_id: buy_order.id,
                            seller_order_id: sell_order.id,
                            timestamp: Utc::now(),
                        };
                        trades.push(trade);

                        if sell_order.status == OrderStatus::Filled {
                            sell_orders.remove(0);
                        } else {
                            break;
                        }
                    }

                    if sell_orders.is_empty() {
                        self.sell_orders.remove(&ask_price);
                    }
                }
                _ => break,
            }
        }

        trades
    }

    fn match_sell_order(&mut self, sell_order: &mut Order, order_qty: f64) -> Vec<Trade> {
        let mut trades = Vec::new();
        let mut total_filled = 0.0;

        while sell_order.remaining_quantity() > 0.0 {
            let best_bid_price = self.buy_orders.keys().next_back().copied();

            match best_bid_price {
                Some(bid_price) if bid_price.0 >= sell_order.price => {
                    let buy_orders = self.buy_orders.get_mut(&bid_price).unwrap();

                    while let Some(buy_order) = buy_orders.first_mut() {
                        if sell_order.remaining_quantity() <= 0.0 {
                            break;
                        }

                        let trade_quantity = sell_order
                            .remaining_quantity()
                            .min(buy_order.remaining_quantity());
                        total_filled += trade_quantity;

                        let slippage_result = self.slippage_config.calculate_slippage(
                            sell_order,
                            order_qty,
                            total_filled,
                            bid_price.0,
                        );
                        let trade_price = slippage_result.executed_price;

                        sell_order.filled_quantity += trade_quantity;
                        buy_order.filled_quantity += trade_quantity;

                        if sell_order.filled_quantity == sell_order.quantity {
                            sell_order.status = OrderStatus::Filled;
                        } else {
                            sell_order.status = OrderStatus::PartialFilled;
                        }

                        if buy_order.filled_quantity == buy_order.quantity {
                            buy_order.status = OrderStatus::Filled;
                            self.order_map.insert(buy_order.id, buy_order.clone());
                        } else {
                            buy_order.status = OrderStatus::PartialFilled;
                            self.order_map.insert(buy_order.id, buy_order.clone());
                        }

                        let trade = Trade {
                            id: Uuid::new_v4(),
                            symbol: self.symbol.clone(),
                            price: trade_price,
                            quantity: trade_quantity,
                            buyer_order_id: buy_order.id,
                            seller_order_id: sell_order.id,
                            timestamp: Utc::now(),
                        };
                        trades.push(trade);

                        if buy_order.status == OrderStatus::Filled {
                            buy_orders.remove(0);
                        } else {
                            break;
                        }
                    }

                    if buy_orders.is_empty() {
                        self.buy_orders.remove(&bid_price);
                    }
                }
                _ => break,
            }
        }

        trades
    }

    fn add_order_to_book(&mut self, order: Order) {
        let price = FloatOrd(order.price);
        match order.side {
            Side::Buy => {
                self.buy_orders
                    .entry(price)
                    .or_insert_with(Vec::new)
                    .push(order);
            }
            Side::Sell => {
                self.sell_orders
                    .entry(price)
                    .or_insert_with(Vec::new)
                    .push(order);
            }
        }
    }

    fn remove_order_from_book(&mut self, order: &Order) {
        let price = FloatOrd(order.price);
        match order.side {
            Side::Buy => {
                if let Some(orders) = self.buy_orders.get_mut(&price) {
                    orders.retain(|o| o.id != order.id);
                    if orders.is_empty() {
                        self.buy_orders.remove(&price);
                    }
                }
            }
            Side::Sell => {
                if let Some(orders) = self.sell_orders.get_mut(&price) {
                    orders.retain(|o| o.id != order.id);
                    if orders.is_empty() {
                        self.sell_orders.remove(&price);
                    }
                }
            }
        }
    }

    pub fn get_order(&self, order_id: Uuid) -> Option<&Order> {
        self.order_map.get(&order_id)
    }

    pub fn trades(&self) -> &[Trade] {
        &self.trades
    }

    pub fn order_book_snapshot(&self, depth: usize) -> OrderBookSnapshot {
        let bids: Vec<(f64, f64)> = self
            .buy_orders
            .iter()
            .rev()
            .take(depth)
            .map(|(k, v)| {
                let total_qty: f64 = v.iter().map(|o| o.remaining_quantity()).sum();
                (k.0, total_qty)
            })
            .collect();

        let asks: Vec<(f64, f64)> = self
            .sell_orders
            .iter()
            .take(depth)
            .map(|(k, v)| {
                let total_qty: f64 = v.iter().map(|o| o.remaining_quantity()).sum();
                (k.0, total_qty)
            })
            .collect();

        OrderBookSnapshot {
            symbol: self.symbol.clone(),
            timestamp: Utc::now(),
            bids,
            asks,
        }
    }
}
