# Quant Backtest System

A high-performance quantitative trading backtest system with Rust backend and Svelte frontend.

## Features

### Backend (Rust)
- **Orderbook Reconstruction**: Parse CSV market data and reconstruct order book with multiple price levels
- **Matching Engine**: Simulate order matching with partial fills and order cancellation
- **Python Strategy Sandbox**: Embed Python strategies using PyO3
- **Multi-symbol Parallel Backtesting**: Support for multiple trading instruments simultaneously
- **REST API**: Actix-web based HTTP interface

### Frontend (Svelte + Chart.js)
- **Equity Curve Chart**: Visualize portfolio performance over time
- **Order Book Depth Chart**: Display bid/ask levels at each timestamp
- **Trade Scatter Plot**: Show executed trades with size indicators

## Project Structure

```
├── orderbook/          # Orderbook reconstruction and snapshot
│   ├── src/
│   │   ├── lib.rs
│   │   ├── types.rs
│   │   ├── orderbook.rs
│   │   └── parser.rs
│   └── Cargo.toml
├── matching/           # Order matching engine
│   ├── src/
│   │   ├── lib.rs
│   │   └── matching_engine.rs
│   └── Cargo.toml
├── engine/             # Backtest engine with Python strategy support
│   ├── src/
│   │   ├── lib.rs
│   │   ├── strategy.rs
│   │   └── backtest.rs
│   └── Cargo.toml
├── api/                # Actix-web REST API
│   ├── src/
│   │   └── main.rs
│   └── Cargo.toml
├── frontend/           # Svelte frontend
│   ├── src/
│   │   ├── App.svelte
│   │   ├── main.js
│   │   ├── FileUpload.svelte
│   │   ├── StrategyEditor.svelte
│   │   ├── EquityChart.svelte
│   │   ├── OrderBookChart.svelte
│   │   └── TradeScatter.svelte
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── data/               # Sample market data
│   └── sample_data.csv
└── Cargo.toml          # Workspace configuration
```

## Installation & Setup

### Prerequisites
- Rust 1.70+
- Python 3.8+ (with development headers)
- Node.js 18+

### Backend Setup

```bash
# Build the Rust workspace
cargo build --release
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Running the System

### Start Backend API

```bash
cd api
cargo run --release
```

The API server will start at `http://localhost:8080`

### Start Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`

## API Endpoints

- `GET /health` - Health check
- `GET /symbols` - List available symbols with tick counts
- `POST /upload` - Upload CSV market data (multipart form with `symbol` and `file` fields)
- `POST /backtest` - Run backtest with strategy code

### Backtest Request Body
```json
{
  "initial_capital": 100000.0,
  "strategy_code": "orders = []\n...",
  "symbols": ["BTC-USDT"]
}
```

## Strategy Development

Strategies are written in Python. The following variables are available:

| Variable | Type | Description |
|----------|------|-------------|
| `bids` | `List[List[float]]` | Bid levels [[price, quantity], ...] |
| `asks` | `List[List[float]]` | Ask levels [[price, quantity], ...] |
| `symbol` | `str` | Current trading symbol |
| `timestamp` | `int` | Current timestamp in milliseconds |
| `capital` | `float` | Remaining capital |
| `position` | `float` | Current position size |

Set the `orders` variable to a list of order objects:
```python
orders = [
    {
        "side": "buy",  # or "sell"
        "price": 45000.0,
        "quantity": 1.0
    }
]
```

### Example Strategy
```python
orders = []

if len(bids) > 0 and len(asks) > 0:
    best_bid = bids[0][0]
    best_ask = asks[0][0]
    mid_price = (best_bid + best_ask) / 2
    
    # Buy if price is 0.1% below mid
    if position <= 0 and best_ask < mid_price * 0.999:
        orders.append({
            "side": "buy",
            "price": best_ask,
            "quantity": 1.0
        })
    
    # Sell if price is 0.1% above mid
    if position > 0 and best_bid > mid_price * 1.001:
        orders.append({
            "side": "sell",
            "price": best_bid,
            "quantity": 1.0
        })
```

## CSV Data Format

Upload CSV files with the following columns:
```
timestamp,price,quantity,side
2024-01-01T00:00:00Z,45000.00,1.5,bid
```

- `timestamp`: ISO 8601 format datetime
- `price`: Float price value
- `quantity`: Float quantity value
- `side`: `bid`/`buy` or `ask`/`sell`

## Development

### Running Tests
```bash
cargo test --all
```

### Code Formatting
```bash
cargo fmt
```

## Technologies

### Backend
- **Rust**: System programming language
- **Actix-web**: Web framework
- **PyO3**: Python <-> Rust bindings
- **Chrono**: Date/time handling
- **UUID**: Unique identifier generation
- **CSV**: CSV parsing

### Frontend
- **Svelte**: UI framework
- **Vite**: Build tool
- **Chart.js**: Charting library

## License

MIT License
