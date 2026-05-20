use actix_web::{web, App, HttpServer, HttpResponse, Responder};
use actix_multipart::Multipart;
use futures_util::StreamExt as _;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use orderbook::*;
use engine::*;
use matching::{SlippageModel, SlippageConfig};
use engine::monte_carlo::{MonteCarloConfig, MonteCarloResult, PathStatistics, SinglePathResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "params")]
enum SlippageModelRequest {
    None,
    Fixed { value: f64 },
    LiquidityBased { impact_factor: f64, max_slippage: f64 },
}

#[derive(Debug, Serialize, Deserialize)]
struct BacktestRequest {
    initial_capital: f64,
    strategy_code: String,
    symbols: Vec<String>,
    slippage: Option<SlippageModelRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StrategyErrorStatsResponse {
    timeouts: u32,
    python_errors: u32,
    execution_errors: u32,
}

#[derive(Debug, Serialize)]
struct BacktestResponse {
    success: bool,
    final_equity: f64,
    return_rate: f64,
    equity_curve: Vec<(i64, f64)>,
    trade_count: usize,
    orderbooks: HashMap<String, Vec<OrderBookSnapshot>>,
    total_slippage_cost: f64,
    avg_slippage_bps: f64,
    strategy_errors: StrategyErrorStatsResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MonteCarloRequest {
    initial_capital: f64,
    strategy_code: String,
    symbols: Vec<String>,
    slippage: Option<SlippageModelRequest>,
    num_simulations: u32,
    use_bootstrap: bool,
    random_seed: Option<u64>,
    volatility_scale: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
struct PathStatisticsResponse {
    mean_return: f64,
    std_return: f64,
    min_return: f64,
    max_return: f64,
    median_return: f64,
    win_rate: f64,
    var_95: f64,
    var_99: f64,
    cvar_95: f64,
}

#[derive(Debug, Clone, Serialize)]
struct MonteCarloResponse {
    success: bool,
    statistics: PathStatisticsResponse,
    return_histogram: Vec<(f64, f64, u32)>,
    num_simulations: u32,
}

struct AppState {
    market_data: Mutex<HashMap<String, Vec<Level2Tick>>>,
}

async fn upload_csv(
    mut payload: Multipart,
    data: web::Data<AppState>,
) -> actix_web::Result<impl Responder> {
    let mut symbol = String::new();
    let mut file_content = Vec::new();

    while let Some(item) = payload.next().await {
        let mut field = item?;
        let content_disposition = field.content_disposition();

        if let Some(name) = content_disposition.get_name() {
            if name == "symbol" {
                let bytes = field.bytes().await?;
                symbol = String::from_utf8_lossy(&bytes).to_string();
            } else if name == "file" {
                while let Some(chunk) = field.next().await {
                    file_content.extend_from_slice(&chunk?);
                }
            }
        }
    }

    if symbol.is_empty() || file_content.is_empty() {
        return Ok(HttpResponse::BadRequest().body("Missing symbol or file"));
    }

    let mut rdr = csv::Reader::from_reader(&file_content[..]);
    let mut ticks = Vec::new();

    for result in rdr.records() {
        match result {
            Ok(record) if record.len() >= 4 => {
                if let (Ok(timestamp), Ok(price), Ok(quantity), Ok(side_str)) = (
                    record[0].parse::<chrono::DateTime<chrono::Utc>>(),
                    record[1].parse::<f64>(),
                    record[2].parse::<f64>(),
                    record[3].parse::<String>(),
                ) {
                    let side = match side_str.to_lowercase().as_str() {
                        "buy" | "bid" | "b" => Side::Buy,
                        "sell" | "ask" | "s" => Side::Sell,
                        _ => continue,
                    };
                    ticks.push(Level2Tick {
                        timestamp,
                        price,
                        quantity,
                        side,
                        symbol: symbol.clone(),
                    });
                }
            }
            _ => continue,
        }
    }

    ticks.sort_by_key(|t| t.timestamp);

    let mut market_data = data.market_data.lock().unwrap();
    market_data.insert(symbol.clone(), ticks);

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "symbol": symbol,
        "tick_count": market_data.get(&symbol).map(|v| v.len()).unwrap_or(0)
    })))
}

async fn run_backtest(
    req: web::Json<BacktestRequest>,
    data: web::Data<AppState>,
) -> actix_web::Result<impl Responder> {
    let market_data = data.market_data.lock().unwrap();

    let slippage_model = match &req.slippage {
        Some(SlippageModelRequest::None) | None => SlippageModel::None,
        Some(SlippageModelRequest::Fixed { value }) => SlippageModel::Fixed { value: *value },
        Some(SlippageModelRequest::LiquidityBased { impact_factor, max_slippage }) => 
            SlippageModel::LiquidityBased { 
                impact_factor: *impact_factor, 
                max_slippage: *max_slippage 
            },
    };

    let slippage_config = SlippageConfig {
        model: slippage_model,
        market_order_book: None,
    };

    let mut engine = BacktestEngine::new(req.initial_capital)
        .with_slippage(slippage_config);
    
    let strategy = PythonStrategy::new(req.strategy_code.clone());

    for symbol in &req.symbols {
        if let Some(ticks) = market_data.get(symbol) {
            engine.add_symbol(symbol.clone(), ticks.clone(), strategy.clone());
        }
    }

    let result = engine.run().await;
    
    let avg_slippage_bps = if !result.slippage_per_trade.is_empty() {
        result.slippage_per_trade.iter()
            .map(|s| s.slippage_bps.abs())
            .sum::<f64>() / result.slippage_per_trade.len() as f64
    } else {
        0.0
    };

    Ok(HttpResponse::Ok().json(BacktestResponse {
        success: true,
        final_equity: result.final_equity,
        return_rate: result.return_rate,
        equity_curve: result.equity_curve,
        trade_count: result.trades.len(),
        orderbooks: result.orderbooks,
        total_slippage_cost: result.total_slippage_cost,
        avg_slippage_bps,
        strategy_errors: StrategyErrorStatsResponse {
            timeouts: result.strategy_errors.timeouts,
            python_errors: result.strategy_errors.python_errors,
            execution_errors: result.strategy_errors.execution_errors,
        },
    }))
}

async fn run_monte_carlo(
    req: web::Json<MonteCarloRequest>,
    data: web::Data<AppState>,
) -> actix_web::Result<impl Responder> {
    let market_data = data.market_data.lock().unwrap();

    let slippage_model = match &req.slippage {
        Some(SlippageModelRequest::None) | None => SlippageModel::None,
        Some(SlippageModelRequest::Fixed { value }) => SlippageModel::Fixed { value: *value },
        Some(SlippageModelRequest::LiquidityBased { impact_factor, max_slippage }) => 
            SlippageModel::LiquidityBased { 
                impact_factor: *impact_factor, 
                max_slippage: *max_slippage 
            },
    };

    let slippage_config = SlippageConfig {
        model: slippage_model,
        market_order_book: None,
    };

    let mc_config = MonteCarloConfig {
        num_simulations: req.num_simulations.clamp(10, 1000),
        use_bootstrap: req.use_bootstrap,
        random_seed: req.random_seed,
        volatility_scale: req.volatility_scale.unwrap_or(1.0),
    };

    let result = engine::monte_carlo::run_monte_carlo(
        req.initial_capital,
        &req.symbols,
        &market_data,
        &req.strategy_code,
        slippage_config,
        mc_config,
    ).await;

    Ok(HttpResponse::Ok().json(MonteCarloResponse {
        success: true,
        statistics: PathStatisticsResponse {
            mean_return: result.statistics.mean_return,
            std_return: result.statistics.std_return,
            min_return: result.statistics.min_return,
            max_return: result.statistics.max_return,
            median_return: result.statistics.median_return,
            win_rate: result.statistics.win_rate,
            var_95: result.statistics.var_95,
            var_99: result.statistics.var_99,
            cvar_95: result.statistics.cvar_95,
        },
        return_histogram: result.return_histogram,
        num_simulations: result.config.num_simulations,
    }))
}

async fn get_symbols(data: web::Data<AppState>) -> impl Responder {
    let market_data = data.market_data.lock().unwrap();
    let symbols: Vec<_> = market_data
        .iter()
        .map(|(k, v)| serde_json::json!({
            "symbol": k,
            "tick_count": v.len()
        }))
        .collect();

    HttpResponse::Ok().json(symbols)
}

async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({ "status": "ok" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Starting Quant Backtest Server...");
    println!("Listening on http://localhost:8080");

    let state = web::Data::new(AppState {
        market_data: Mutex::new(HashMap::new()),
    });

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(actix_web::middleware::Logger::default())
            .wrap(actix_cors::Cors::permissive())
            .route("/health", web::get().to(health))
            .route("/symbols", web::get().to(get_symbols))
            .route("/upload", web::post().to(upload_csv))
            .route("/backtest", web::post().to(run_backtest))
            .route("/monte_carlo", web::post().to(run_monte_carlo))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
