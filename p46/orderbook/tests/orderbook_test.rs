use orderbook::*;
use chrono::Utc;

#[test]
fn test_normal_order_update() {
    let mut ob = OrderBook::new("BTC-USDT".to_string());
    
    let tick = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: 1.5,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    
    ob.update_from_tick(&tick);
    
    let snapshot = ob.snapshot(5);
    assert_eq!(snapshot.bids.len(), 1);
    assert_eq!(snapshot.bids[0].0, 45000.0);
    assert_eq!(snapshot.bids[0].1, 1.5);
}

#[test]
fn test_full_cancel_with_zero_quantity() {
    let mut ob = OrderBook::new("BTC-USDT".to_string());
    
    let tick_add = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: 1.5,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_add);
    
    let tick_cancel = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: 0.0,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_cancel);
    
    let snapshot = ob.snapshot(5);
    assert_eq!(snapshot.bids.len(), 0);
    assert_eq!(ob.errors().len(), 0);
}

#[test]
fn test_partial_cancel_with_negative_quantity() {
    let mut ob = OrderBook::new("BTC-USDT".to_string());
    
    let tick_add = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: 2.0,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_add);
    
    let tick_partial_cancel = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: -0.5,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_partial_cancel);
    
    let snapshot = ob.snapshot(5);
    assert_eq!(snapshot.bids.len(), 1);
    assert_eq!(snapshot.bids[0].1, 1.5);
    assert_eq!(ob.errors().len(), 0);
}

#[test]
fn test_cancel_quantity_exceeds_available() {
    let mut ob = OrderBook::new("BTC-USDT".to_string());
    
    let tick_add = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: 1.0,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_add);
    
    let tick_cancel = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: -2.0,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_cancel);
    
    let snapshot = ob.snapshot(5);
    assert_eq!(snapshot.bids.len(), 0);
    
    assert_eq!(ob.errors().len(), 1);
    match &ob.errors()[0] {
        OrderBookError::CancelQuantityExceedsAvailable { 
            symbol, price, side, cancel_quantity, available_quantity 
        } => {
            assert_eq!(symbol, "BTC-USDT");
            assert_eq!(*price, 45000.0);
            assert_eq!(*side, Side::Buy);
            assert_eq!(*cancel_quantity, 2.0);
            assert_eq!(*available_quantity, 1.0);
        }
        _ => panic!("Expected CancelQuantityExceedsAvailable error"),
    }
}

#[test]
fn test_cancel_nonexistent_price_level() {
    let mut ob = OrderBook::new("BTC-USDT".to_string());
    
    let tick_cancel = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: -0.5,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_cancel);
    
    assert_eq!(ob.errors().len(), 1);
    match &ob.errors()[0] {
        OrderBookError::PriceLevelNotFound { symbol, price, side } => {
            assert_eq!(symbol, "BTC-USDT");
            assert_eq!(*price, 45000.0);
            assert_eq!(*side, Side::Buy);
        }
        _ => panic!("Expected PriceLevelNotFound error"),
    }
}

#[test]
fn test_ask_side_partial_cancel() {
    let mut ob = OrderBook::new("BTC-USDT".to_string());
    
    let tick_add = Level2Tick {
        timestamp: Utc::now(),
        price: 45005.0,
        quantity: 3.0,
        side: Side::Sell,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_add);
    
    let tick_cancel = Level2Tick {
        timestamp: Utc::now(),
        price: 45005.0,
        quantity: -1.0,
        side: Side::Sell,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_cancel);
    
    let snapshot = ob.snapshot(5);
    assert_eq!(snapshot.asks.len(), 1);
    assert_eq!(snapshot.asks[0].1, 2.0);
    assert_eq!(ob.errors().len(), 0);
}

#[test]
fn test_partial_cancel_until_zero() {
    let mut ob = OrderBook::new("BTC-USDT".to_string());
    
    let tick_add = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: 1.0,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_add);
    
    let tick_cancel = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: -1.0,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_cancel);
    
    let snapshot = ob.snapshot(5);
    assert_eq!(snapshot.bids.len(), 0);
    assert_eq!(ob.errors().len(), 0);
}

#[test]
fn test_clear_errors() {
    let mut ob = OrderBook::new("BTC-USDT".to_string());
    
    let tick_cancel = Level2Tick {
        timestamp: Utc::now(),
        price: 45000.0,
        quantity: -0.5,
        side: Side::Buy,
        symbol: "BTC-USDT".to_string(),
    };
    ob.update_from_tick(&tick_cancel);
    
    assert_eq!(ob.errors().len(), 1);
    
    ob.clear_errors();
    
    assert_eq!(ob.errors().len(), 0);
}
