const BacktestResult = require('../models/BacktestResult');
const SimulationEngine = require('./SimulationEngine');

class BacktestEngine {
  constructor() {
    this.simulation = new SimulationEngine();
    this.historicalData = new Map();
    this.isRunning = false;
    this.currentBacktest = null;
  }

  generateHistoricalData(symbols, days = 7, interval = 60000) {
    const data = {};
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);
    const points = Math.floor((now - startTime) / interval);

    for (const symbol of symbols) {
      const priceHistory = [];
      let basePrice = symbol.includes('BTC') ? 40000 : 
                      symbol.includes('ETH') ? 2500 : 100;
      
      for (let i = 0; i < points; i++) {
        const timestamp = startTime + (i * interval);
        const noise = (Math.random() - 0.5) * 0.002;
        const trend = Math.sin(i / 1000) * 0.01;
        const spread = basePrice * 0.001;
        
        basePrice *= (1 + noise + trend);
        
        priceHistory.push({
          timestamp,
          bid: basePrice - spread,
          ask: basePrice + spread,
          volume: Math.random() * 1000,
        });
      }
      
      data[symbol] = priceHistory;
      this.historicalData.set(symbol, priceHistory);
    }

    return data;
  }

  async runBacktest(config) {
    const {
      name,
      exchange,
      triangle,
      initialCapital = 10000,
      feeRate = 0.001,
      slippage = 0.0005,
      days = 7,
      triggerThreshold = 0.003,
    } = config;

    this.isRunning = true;
    this.simulation.reset();
    this.simulation.setFeeRate(feeRate);
    this.simulation.setSlippage(slippage);
    this.simulation.setInitialBalance({ USDT: initialCapital });

    const symbols = triangle;
    const historicalData = this.generateHistoricalData(symbols, days);
    
    const timestamps = new Set();
    for (const symbol of symbols) {
      for (const point of historicalData[symbol]) {
        timestamps.add(point.timestamp);
      }
    }
    const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);

    const backtest = await BacktestResult.create({
      name,
      exchange,
      triangle,
      startTime: new Date(sortedTimestamps[0]),
      endTime: new Date(sortedTimestamps[sortedTimestamps.length - 1]),
      initialCapital,
      feeRate,
      slippage,
      status: 'RUNNING',
      equityCurve: [],
      tradeHistory: [],
    });

    const equityCurve = [];
    const tradeHistory = [];
    let peakEquity = initialCapital;
    let maxDrawdown = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let profitableTrades = 0;

    let lastArbitrageTime = 0;
    const arbitrageCooldown = 300000;

    for (let i = 0; i < sortedTimestamps.length; i++) {
      const timestamp = sortedTimestamps[i];
      
      for (const symbol of symbols) {
        const pricePoints = historicalData[symbol];
        const nearestPoint = this.findNearestPrice(pricePoints, timestamp);
        if (nearestPoint) {
          this.simulation.updatePrice(exchange, symbol, nearestPoint);
        }
      }

      if (timestamp - lastArbitrageTime > arbitrageCooldown) {
        const arbitrageProfit = this.calculateArbitrageProfit(exchange, triangle);
        
        if (arbitrageProfit > triggerThreshold) {
          const result = await this.simulation.executeArbitrageTriangular(
            exchange, 
            triangle,
            this.simulation.balance.USDT * 0.1
          );

          if (result.success) {
            tradeHistory.push({
              timestamp,
              profit: result.profit,
              trades: result.trades.map(t => ({
                symbol: t.symbol,
                side: t.side,
                price: t.price,
                quantity: t.quantity,
              })),
            });

            if (result.profit > 0) {
              profitableTrades++;
              totalProfit += result.profit;
            } else {
              totalLoss += Math.abs(result.profit);
            }
          }
          
          lastArbitrageTime = timestamp;
        }
      }

      if (i % 100 === 0 || i === sortedTimestamps.length - 1) {
        const currentEquity = this.calculateEquity(exchange, triangle);
        
        equityCurve.push({
          timestamp,
          equity: currentEquity,
        });

        if (currentEquity > peakEquity) {
          peakEquity = currentEquity;
        }
        const drawdown = (peakEquity - currentEquity) / peakEquity * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }

    const finalBalance = this.simulation.balance.USDT;
    const totalReturn = ((finalBalance - initialCapital) / initialCapital) * 100;
    const totalTrades = tradeHistory.length;
    
    const returns = equityCurve.map((p, i, arr) => 
      i > 0 ? (p.equity - arr[i - 1].equity) / arr[i - 1].equity : 0
    );
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(365 * 24 * 60) : 0;

    await backtest.update({
      status: 'COMPLETED',
      finalCapital: finalBalance,
      totalReturn,
      totalTrades,
      profitableTrades,
      winRate: totalTrades > 0 ? profitableTrades / totalTrades : 0,
      maxDrawdown,
      sharpeRatio,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 0,
      totalProfit,
      totalLoss,
      avgTradePnl: totalTrades > 0 ? (totalProfit - totalLoss) / totalTrades : 0,
      equityCurve,
      tradeHistory,
    });

    this.isRunning = false;
    return backtest;
  }

  findNearestPrice(priceHistory, targetTimestamp) {
    let left = 0;
    let right = priceHistory.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (priceHistory[mid].timestamp === targetTimestamp) {
        return priceHistory[mid];
      } else if (priceHistory[mid].timestamp < targetTimestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    if (right >= 0) return priceHistory[right];
    return priceHistory[0];
  }

  calculateArbitrageProfit(exchange, triangle) {
    const [pair1, pair2, pair3] = triangle;
    const priceKey1 = `${exchange}:${pair1}`;
    const priceKey2 = `${exchange}:${pair2}`;
    const priceKey3 = `${exchange}:${pair3}`;
    
    const p1 = this.simulation.priceCache.get(priceKey1);
    const p2 = this.simulation.priceCache.get(priceKey2);
    const p3 = this.simulation.priceCache.get(priceKey3);
    
    if (!p1 || !p2 || !p3) return 0;

    const amount = 1000;
    const leg1 = amount / p1.ask;
    const leg2 = leg1 * p2.bid;
    const final = leg2 / p3.ask;
    
    return (final - amount) / amount;
  }

  calculateEquity(exchange, triangle) {
    let total = this.simulation.balance.USDT;
    
    for (const [asset, amount] of Object.entries(this.simulation.balance)) {
      if (asset !== 'USDT' && amount > 0) {
        const symbol = `${asset}USDT`;
        const priceKey = `${exchange}:${symbol}`;
        const price = this.simulation.priceCache.get(priceKey);
        if (price) {
          total += amount * price.bid;
        }
      }
    }
    
    return total;
  }

  async getBacktestResults(exchange = null, limit = 20) {
    const where = {};
    if (exchange) where.exchange = exchange;
    
    return await BacktestResult.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  async getBacktestById(id) {
    return await BacktestResult.findByPk(id);
  }

  stopBacktest() {
    this.isRunning = false;
  }
}

module.exports = BacktestEngine;
