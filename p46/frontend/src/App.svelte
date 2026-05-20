<script>
  import { onMount } from 'svelte'
  import FileUpload from './FileUpload.svelte'
  import StrategyEditor from './StrategyEditor.svelte'
  import EquityChart from './EquityChart.svelte'
  import OrderBookChart from './OrderBookChart.svelte'
  import TradeScatter from './TradeScatter.svelte'
  import HistogramChart from './HistogramChart.svelte'

  let symbols = []
  let selectedSymbols = []
  let initialCapital = 100000
  
  let slippageType = 'none'
  let fixedSlippageValue = 10
  let impactFactor = 0.01
  let maxSlippage = 0.05
  
  let strategyCode = `
orders = []

if len(bids) > 0 and len(asks) > 0:
    best_bid = bids[0][0]
    best_ask = asks[0][0]
    mid_price = (best_bid + best_ask) / 2
    
    if position <= 0 and best_ask < mid_price * 0.999:
        orders.append({
            "side": "buy",
            "price": best_ask,
            "quantity": 100
        })
    
    if position > 0 and best_bid > mid_price * 1.001:
        orders.append({
            "side": "sell",
            "price": best_bid,
            "quantity": 100
        })
`.trim()

  let backtestResult = null
  let monteCarloResult = null
  let loading = false
  let mcLoading = false
  let currentSymbol = null

  let mcNumSimulations = 100
  let mcUseBootstrap = true
  let mcRandomSeed = ''
  let mcVolatilityScale = 1.0

  onMount(async () => {
    await loadSymbols()
  })

  async function loadSymbols() {
    try {
      const res = await fetch('/api/symbols')
      symbols = await res.json()
    } catch (e) {
      console.error('Failed to load symbols:', e)
    }
  }

  function toggleSymbol(symbol) {
    if (selectedSymbols.includes(symbol)) {
      selectedSymbols = selectedSymbols.filter(s => s !== symbol)
    } else {
      selectedSymbols = [...selectedSymbols, symbol]
    }
  }

  function getSlippageConfig() {
    if (slippageType === 'none') {
      return { type: 'None' }
    } else if (slippageType === 'fixed') {
      return {
        type: 'Fixed',
        params: { value: parseFloat(fixedSlippageValue) }
      }
    } else if (slippageType === 'liquidity') {
      return {
        type: 'LiquidityBased',
        params: {
          impact_factor: parseFloat(impactFactor),
          max_slippage: parseFloat(maxSlippage)
        }
      }
    }
    return null
  }

  async function runBacktest() {
    if (selectedSymbols.length === 0) {
      alert('Please select at least one symbol')
      return
    }

    loading = true
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initial_capital: initialCapital,
          strategy_code: strategyCode,
          symbols: selectedSymbols,
          slippage: getSlippageConfig()
        })
      })
      backtestResult = await res.json()
      if (selectedSymbols.length > 0) {
        currentSymbol = selectedSymbols[0]
      }
    } catch (e) {
      console.error('Backtest failed:', e)
    } finally {
      loading = false
    }
  }

  async function runMonteCarlo() {
    if (selectedSymbols.length === 0) {
      alert('Please select at least one symbol')
      return
    }

    mcLoading = true
    try {
      const res = await fetch('/api/monte_carlo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initial_capital: initialCapital,
          strategy_code: strategyCode,
          symbols: selectedSymbols,
          slippage: getSlippageConfig(),
          num_simulations: parseInt(mcNumSimulations),
          use_bootstrap: mcUseBootstrap,
          random_seed: mcRandomSeed ? parseInt(mcRandomSeed) : null,
          volatility_scale: parseFloat(mcVolatilityScale),
        })
      })
      monteCarloResult = await res.json()
    } catch (e) {
      console.error('Monte Carlo failed:', e)
    } finally {
      mcLoading = false
    }
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }
</script>

<div class="app">
  <header>
    <h1>Quant Backtest System</h1>
  </header>

  <main>
    <div class="sidebar">
      <FileUpload on:uploaded={loadSymbols} />

      <div class="section">
        <h3>Symbols</h3>
        <div class="symbol-list">
          {#each symbols as sym}
            <label class="symbol-item">
              <input
                type="checkbox"
                checked={selectedSymbols.includes(sym.symbol)}
                on:change={() => toggleSymbol(sym.symbol)}
              />
              <span>{sym.symbol}</span>
              <span class="tick-count">({sym.tick_count} ticks)</span>
            </label>
          {/each}
        </div>
      </div>

      <div class="section">
        <h3>Settings</h3>
        <div class="input-group">
          <label>Initial Capital</label>
          <input
            type="number"
            bind:value={initialCapital}
            min="1000"
            step="1000"
          />
        </div>
      </div>

      <div class="section">
        <h3>Slippage Configuration</h3>
        <div class="input-group">
          <label>Slippage Model</label>
          <select bind:value={slippageType}>
            <option value="none">None</option>
            <option value="fixed">Fixed Slippage</option>
            <option value="liquidity">Liquidity Based Slippage</option>
          </select>
        </div>
        
        {#if slippageType === 'fixed'}
          <div class="input-group">
            <label>Fixed Slippage Value</label>
            <input
              type="number"
              bind:value={fixedSlippageValue}
              min="0"
              step="0.1"
            />
          </div>
        {/if}
        
        {#if slippageType === 'liquidity'}
          <div class="input-group">
            <label>Impact Factor (0.001 - 0.1)</label>
            <input
              type="number"
              bind:value={impactFactor}
              min="0.001"
              max="0.1"
              step="0.001"
            />
          </div>
          <div class="input-group">
            <label>Max Slippage (0.01 - 0.1)</label>
            <input
              type="number"
              bind:value={maxSlippage}
              min="0.01"
              max="0.1"
              step="0.001"
            />
          </div>
        {/if}
      </div>

      <div class="section">
        <h3>Monte Carlo Configuration</h3>
        <div class="input-group">
          <label>Number of Simulations</label>
          <input
            type="number"
            bind:value={mcNumSimulations}
            min="10"
            max="1000"
            step="10"
          />
        </div>
        <div class="input-group checkbox-group">
          <input
            type="checkbox"
            bind:checked={mcUseBootstrap}
            id="bootstrapToggle"
          />
          <label for="bootstrapToggle">Use Bootstrap Resampling</label>
        </div>
        {#if !mcUseBootstrap}
          <div class="input-group">
            <label>Volatility Scale</label>
            <input
              type="number"
              bind:value={mcVolatilityScale}
              min="0.1"
              max="5"
              step="0.1"
            />
          </div>
        {/if}
        <div class="input-group">
          <label>Random Seed (Optional)</label>
          <input
            type="number"
            bind:value={mcRandomSeed}
            placeholder="Leave empty for random"
          />
        </div>
      </div>

      <StrategyEditor bind:code={strategyCode} />

      <div class="button-group">
        <button
          class="run-button"
          disabled={loading || selectedSymbols.length === 0}
          on:click={runBacktest}
        >
          {loading ? 'Running...' : 'Run Backtest'}
        </button>
        <button
          class="run-button mc-button"
          disabled={mcLoading || selectedSymbols.length === 0}
          on:click={runMonteCarlo}
        >
          {mcLoading ? 'Running MC...' : 'Run Monte Carlo'}
        </button>
      </div>
    </div>

    <div class="content">
      {#if backtestResult}
        <div class="results-header">
          <div class="metric">
            <span class="label">Final Equity</span>
            <span class="value">{formatCurrency(backtestResult.final_equity)}</span>
          </div>
          <div class="metric">
            <span class="label">Return Rate</span>
            <span class="value" class:positive={backtestResult.return_rate >= 0} class:negative={backtestResult.return_rate < 0}>
              {backtestResult.return_rate.toFixed(2)}%
            </span>
          </div>
          <div class="metric">
            <span class="label">Trades</span>
            <span class="value">{backtestResult.trade_count}</span>
          </div>
          <div class="metric">
            <span class="label">Total Slippage Cost</span>
            <span class="value">{formatCurrency(backtestResult.total_slippage_cost)}</span>
          </div>
          <div class="metric">
            <span class="label">Avg Slippage</span>
            <span class="value">{backtestResult.avg_slippage_bps.toFixed(2)} bps</span>
          </div>
        </div>

        {#if backtestResult.strategy_errors && (
            backtestResult.strategy_errors.timeouts > 0 || 
            backtestResult.strategy_errors.python_errors > 0 ||
            backtestResult.strategy_errors.execution_errors > 0
        )}
          <div class="error-summary">
            <h4>Strategy Execution Issues</h4>
            <div class="error-metrics">
              {#if backtestResult.strategy_errors.timeouts > 0}
                <div class="error-metric warning">
                  <span class="error-label">Timeouts</span>
                  <span class="error-count">{backtestResult.strategy_errors.timeouts}</span>
                </div>
              {/if}
              {#if backtestResult.strategy_errors.python_errors > 0}
                <div class="error-metric error">
                  <span class="error-label">Python Errors</span>
                  <span class="error-count">{backtestResult.strategy_errors.python_errors}</span>
                </div>
              {/if}
              {#if backtestResult.strategy_errors.execution_errors > 0}
                <div class="error-metric error">
                  <span class="error-label">Execution Errors</span>
                  <span class="error-count">{backtestResult.strategy_errors.execution_errors}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}</div>

        <div class="charts">
          <div class="chart-card">
            <h3>Equity Curve</h3>
            <EquityChart data={backtestResult.equity_curve} />
          </div>

          {#if currentSymbol && backtestResult.orderbooks[currentSymbol]}
            <div class="symbol-selector">
              {#each selectedSymbols as sym}
                <button
                  class:active={currentSymbol === sym}
                  on:click={() => currentSymbol = sym}
                >
                  {sym}
                </button>
              {/each}
            </div>

            <div class="chart-card">
              <h3>Order Book Depth - {currentSymbol}</h3>
              <OrderBookChart
                snapshots={backtestResult.orderbooks[currentSymbol]}
              />
            </div>
          {/if}

          {#if backtestResult.trades && backtestResult.trades.length > 0}
            <div class="chart-card">
              <h3>Trade Scatter Plot</h3>
              <TradeScatter trades={backtestResult.trades} />
            </div>
          {/if}
        </div>
      {/if}

      {#if monteCarloResult}
        <div class="mc-results">
          <h3>Monte Carlo Simulation Results ({monteCarloResult.num_simulations} runs)</h3>
          
          <div class="mc-statistics">
            <div class="mc-stat">
              <span class="mc-stat-label">Mean Return</span>
              <span class="mc-stat-value">{monteCarloResult.statistics.mean_return.toFixed(2)}%</span>
            </div>
            <div class="mc-stat">
              <span class="mc-stat-label">Median Return</span>
              <span class="mc-stat-value">{monteCarloResult.statistics.median_return.toFixed(2)}%</span>
            </div>
            <div class="mc-stat">
              <span class="mc-stat-label">Std Dev</span>
              <span class="mc-stat-value">{monteCarloResult.statistics.std_return.toFixed(2)}%</span>
            </div>
            <div class="mc-stat">
              <span class="mc-stat-label">Win Rate</span>
              <span class="mc-stat-value win-rate">{monteCarloResult.statistics.win_rate.toFixed(1)}%</span>
            </div>
            <div class="mc-stat">
              <span class="mc-stat-label">VaR 95%</span>
              <span class="mc-stat-value negative">{monteCarloResult.statistics.var_95.toFixed(2)}%</span>
            </div>
            <div class="mc-stat">
              <span class="mc-stat-label">CVaR 95%</span>
              <span class="mc-stat-value negative">{monteCarloResult.statistics.cvar_95.toFixed(2)}%</span>
            </div>
          </div>

          <div class="chart-card">
            <h3>Return Distribution Histogram</h3>
            <HistogramChart data={monteCarloResult.return_histogram} />
          </div>
        </div>
      {/if}

      {:else}
        <div class="empty-state">
          <h2>Welcome to Quant Backtest System</h2>
          <p>Upload market data CSV files and run backtests on your strategies.</p>
          <ol>
            <li>Upload CSV files with timestamp, price, quantity, side columns</li>
            <li>Select symbols to backtest</li>
            <li>Write your trading strategy in Python</li>
            <li>Click Run Backtest and view results</li>
          </ol>
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .app {
    min-height: 100vh;
    background: #f5f7fa;
  }

  header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 1.5rem 2rem;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }

  h1 {
    margin: 0;
    font-size: 1.8rem;
    font-weight: 600;
  }

  main {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: 2rem;
    padding: 2rem;
    max-width: 1800px;
    margin: 0 auto;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }

  .section h3 {
    margin: 0 0 1rem 0;
    color: #333;
    font-size: 1.1rem;
  }

  .symbol-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .symbol-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .symbol-item:hover {
    background: #f5f7fa;
  }

  .tick-count {
    color: #888;
    font-size: 0.85rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .input-group label {
    font-weight: 500;
    color: #555;
  }

  .input-group input {
    padding: 0.75rem 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .input-group input:focus {
    outline: none;
    border-color: #667eea;
  }

  .run-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, opacity 0.2s;
  }

  .run-button:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .run-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .button-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .mc-button {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }

  .mc-results {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }

  .mc-results h3 {
    margin: 0 0 1.5rem 0;
    color: #333;
    font-size: 1.3rem;
  }

  .mc-statistics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .mc-stat {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }

  .mc-stat-label {
    display: block;
    font-size: 0.85rem;
    color: #666;
    margin-bottom: 0.5rem;
  }

  .mc-stat-value {
    display: block;
    font-size: 1.2rem;
    font-weight: 600;
    color: #333;
  }

  .mc-stat-value.win-rate {
    color: #667eea;
  }

  .mc-stat-value.negative {
    color: #f44336;
  }

  .checkbox-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .checkbox-group input {
    width: auto;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .empty-state {
    background: white;
    border-radius: 16px;
    padding: 4rem 2rem;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }

  .empty-state h2 {
    color: #333;
    margin-bottom: 1rem;
  }

  .empty-state p {
    color: #666;
    margin-bottom: 2rem;
  }

  .empty-state ol {
    text-align: left;
    max-width: 400px;
    margin: 0 auto;
    color: #555;
  }

  .empty-state li {
    padding: 0.5rem 0;
  }

  .results-header {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1.5rem;
  }

  .error-summary {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }

  .error-summary h4 {
    margin: 0 0 1rem 0;
    color: #333;
  }

  .error-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .error-metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    min-width: 100px;
  }

  .error-metric.warning {
    background: #fff3cd;
    border: 1px solid #ffc107;
  }

  .error-metric.error {
    background: #f8d7da;
    border: 1px solid #dc3545;
  }

  .error-label {
    font-size: 0.85rem;
    color: #555;
    margin-bottom: 0.25rem;
  }

  .error-count {
    font-size: 1.5rem;
    font-weight: 600;
    color: #333;
  }

  .metric {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }

  .metric .label {
    display: block;
    color: #888;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  .metric .value {
    display: block;
    font-size: 1.5rem;
    font-weight: 600;
    color: #333;
  }

  .metric .value.positive {
    color: #4caf50;
  }

  .metric .value.negative {
    color: #f44336;
  }

  .charts {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .chart-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }

  .chart-card h3 {
    margin: 0 0 1rem 0;
    color: #333;
    font-size: 1.1rem;
  }

  .symbol-selector {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .symbol-selector button {
    padding: 0.5rem 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .symbol-selector button.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }

  .symbol-selector button:hover:not(.active) {
    border-color: #667eea;
  }
</style>
