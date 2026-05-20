use matching::*;
use orderbook::*;
use chrono::Utc;

#[test]
fn test_no_slippage_by_default() {
    let mut me = MatchingEngine::new("BTC-USDT".to_string());
    
    let sell_order = Order::new(
        "BTC-USDT".to_string(),
        Side::Sell,
        45000.0,
        1.0,
    );
    me.submit_order(sell_order);
    
    let buy_order = Order::new(
        "BTC-USDT".to_string(),
        Side::Buy,
        45000.0,
        0.5,
    );
    let trades = me.submit_order(buy_order);
    
    assert_eq!(trades.len(), 1);
    assert_eq!(trades[0].price, 45000.0);
}

#[test]
fn test_fixed_slippage_buy_order() {
    let config = SlippageConfig {
        model: SlippageModel::Fixed { value: 10.0 },
        market_order_book: None,
    };
    
    let mut me = MatchingEngine::with_slippage("BTC-USDT".to_string(), config);
    
    let sell_order = Order::new(
        "BTC-USDT".to_string(),
        Side::Sell,
        45000.0,
        1.0,
    );
    me.submit_order(sell_order);
    
    let buy_order = Order::new(
        "BTC-USDT".to_string(),
        Side::Buy,
        45100.0,
        0.5,
    );
    let trades = me.submit_order(buy_order);
    
    assert_eq!(trades.len(), 1);
    assert_eq!(trades[0].price, 45010.0);
}

#[test]
fn test_fixed_slippage_sell_order() {
    let config = SlippageConfig {
        model: SlippageModel::Fixed { value: 10.0 },
        market_order_book: None,
    };
    
    let mut me = MatchingEngine::with_slippage("BTC-USDT".to_string(), config);
    
    let buy_order = Order::new(
        "BTC-USDT".to_string(),
        Side::Buy,
        45000.0,
        1.0,
    );
    me.submit_order(buy_order);
    
    let sell_order = Order::new(
        "BTC-USDT".to_string(),
        Side::Sell,
        44900.0,
        0.5,
    );
    let trades = me.submit_order(sell_order);
    
    assert_eq!(trades.len(), 1);
    assert_eq!(trades[0].price, 44990.0);
}

#[test]
fn test_liquidity_based_slippage_small_order() {
    let ob = OrderBookSnapshot {
        symbol: "BTC-USDT".to_string(),
        timestamp: Utc::now(),
        bids: vec![
            (44990.0, 2.0),
            (44980.0, 3.0),
        ],
        asks: vec![
            (45000.0, 2.0),
            (45010.0, 3.0),
        ],
    };
    
    let config = SlippageConfig {
        model: SlippageModel::LiquidityBased { 
            impact_factor: 0.01, 
            max_slippage: 0.05 
        },
        market_order_book: Some(ob),
    };
    
    let mut me = MatchingEngine::with_slippage("BTC-USDT".to_string(), config);
    
    let sell_order = Order::new(
        "BTC-USDT".to_string(),
        Side::Sell,
        45000.0,
        2.0,
    );
    me.submit_order(sell_order);
    
    let buy_order = Order::new(
        "BTC-USDT".to_string(),
        Side::Buy,
        45100.0,
        0.1,
    );
    let trades = me.submit_order(buy_order);
    
    assert_eq!(trades.len(), 1);
    assert!(trades[0].price >= 45000.0);
}

#[test]
fn test_update_slippage_config() {
    let mut me = MatchingEngine::new("BTC-USDT".to_string());
    
    let config = SlippageConfig {
        model: SlippageModel::Fixed { value: 5.0 },
        market_order_book: None,
    };
    me.update_slippage_config(config);
    
    let sell_order = Order::new(
        "BTC-USDT".to_string(),
        Side::Sell,
        45000.0,
        1.0,
    );
    me.submit_order(sell_order);
    
    let buy_order = Order::new(
        "BTC-USDT".to_string(),
        Side::Buy,
        45000.0,
        0.5,
    );
    let trades = me.submit_order(buy_order);
    
    assert_eq!(trades.len(), 1);
    assert_eq!(trades[0].price, 45005.0);
}

#[test]
fn test_slippage_result_calculation() {
    let ob = OrderBookSnapshot {
        symbol: "BTC-USDT".to_string(),
        timestamp: Utc::now(),
        bids: vec![(44990.0, 2.0)],
        asks: vec![(45000.0, 2.0)],
    };
    
    let config = SlippageConfig {
        model: SlippageModel::Fixed { value: 45.0 },
        market_order_book: Some(ob),
    };
    
    let order = Order::new(
        "BTC-USDT".to_string(),
        Side::Buy,
        45100.0,
        1.0,
    );
    
    let result = config.calculate_slippage(&order, 1.0, 1.0, 45000.0);
    
    assert_eq!(result.original_price, 45000.0);
    assert_eq!(result.executed_price, 45045.0);
    assert_eq!(result.slippage_value, 45.0);
    assert_eq!(result.slippage_bps, 10.0);
}
