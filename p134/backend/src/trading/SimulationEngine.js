const Trade = require('../models/Trade');
const Position = require('../models/Position');
const redis = require('../config/redis');

class SimulationEngine {
  constructor() {
    this.feeRate = 0.001;
    this.slippage = 0.0005;
    this.positions = new Map();
    this.balance = { USDT: 10000, BTC: 0, ETH: 0 };
    this.tradeHistory = [];
    this.isRunning = false;
    this.priceCache = new Map();
  }

  setFeeRate(rate) {
    this.feeRate = rate;
  }

  setSlippage(slippage) {
    this.slippage = slippage;
  }

  setInitialBalance(balances) {
    this.balance = { ...this.balance, ...balances };
  }

  getBalance() {
    return { ...this.balance };
  }

  getPositions() {
    return Array.from(this.positions.values());
  }

  updatePrice(exchange, symbol, priceData) {
    const key = `${exchange}:${symbol}`;
    this.priceCache.set(key, { ...priceData, timestamp: Date.now() });
    
    this.updatePositionPnL(exchange, symbol, priceData);
  }

  async executeTrade(exchange, symbol, side, quantity, note = '') {
    const priceKey = `${exchange}:${symbol}`;
    const priceData = this.priceCache.get(priceKey);
    
    if (!priceData) {
      throw new Error(`No price data for ${symbol} on ${exchange}`);
    }

    const executionPrice = side === 'BUY' 
      ? priceData.ask * (1 + this.slippage)
      : priceData.bid * (1 - this.slippage);
    
    const amount = quantity * executionPrice;
    const fee = amount * this.feeRate;
    const totalCost = side === 'BUY' ? amount + fee : amount - fee;

    const baseAsset = symbol.includes('USDT') ? symbol.replace('USDT', '') : symbol.replace('BTC', '');
    const quoteAsset = symbol.includes('USDT') ? 'USDT' : 'BTC';

    if (side === 'BUY') {
      if (this.balance[quoteAsset] < totalCost) {
        throw new Error(`Insufficient ${quoteAsset} balance`);
      }
      this.balance[quoteAsset] -= totalCost;
      this.balance[baseAsset] = (this.balance[baseAsset] || 0) + quantity;
    } else {
      if (this.balance[baseAsset] < quantity) {
        throw new Error(`Insufficient ${baseAsset} balance`);
      }
      this.balance[baseAsset] -= quantity;
      this.balance[quoteAsset] += totalCost;
    }

    const trade = await Trade.create({
      exchange,
      symbol,
      side,
      quantity,
      price: executionPrice,
      amount,
      fee,
      feeCurrency: quoteAsset,
      isSimulation: true,
      note,
    });

    this.tradeHistory.push(trade);
    await this.updatePosition(exchange, symbol, baseAsset, quoteAsset, side, quantity, executionPrice, fee);

    return trade;
  }

  async executeArbitrageTriangular(exchange, triangle, amount = 1000) {
    const [pair1, pair2, pair3] = triangle;
    const trades = [];
    const initialAmount = amount;

    try {
      const price1 = this.priceCache.get(`${exchange}:${pair1}`);
      if (!price1) throw new Error(`No price for ${pair1}`);
      
      const qty1 = amount / price1.ask;
      const trade1 = await this.executeTrade(exchange, pair1, 'BUY', qty1, 'Arbitrage leg 1');
      trades.push(trade1);
      amount = qty1;

      const price2 = this.priceCache.get(`${exchange}:${pair2}`);
      if (!price2) throw new Error(`No price for ${pair2}`);
      
      const trade2 = await this.executeTrade(exchange, pair2, 'SELL', amount, 'Arbitrage leg 2');
      trades.push(trade2);
      amount = amount * price2.bid;

      const price3 = this.priceCache.get(`${exchange}:${pair3}`);
      if (!price3) throw new Error(`No price for ${pair3}`);
      
      const qty3 = amount / price3.ask;
      const trade3 = await this.executeTrade(exchange, pair3, 'SELL', qty3, 'Arbitrage leg 3');
      trades.push(trade3);

      const profit = (this.balance.USDT - 10000) / 10000 * 100;

      return {
        success: true,
        trades,
        profit,
        initialAmount,
        finalAmount: this.balance.USDT,
      };
    } catch (error) {
      console.error('Arbitrage execution failed:', error.message);
      return {
        success: false,
        error: error.message,
        trades,
      };
    }
  }

  async updatePosition(exchange, symbol, baseAsset, quoteAsset, side, quantity, price, fee) {
    const posKey = `${exchange}:${symbol}`;
    let position = this.positions.get(posKey);

    if (!position) {
      position = {
        exchange,
        symbol,
        baseAsset,
        quoteAsset,
        quantity: 0,
        avgEntryPrice: 0,
        totalCost: 0,
        realizedPnl: 0,
        tradeCount: 0,
      };
    }

    if (side === 'BUY') {
      const totalQty = position.quantity + quantity;
      const totalCost = position.totalCost + (quantity * price) + fee;
      position.avgEntryPrice = totalCost / totalQty;
      position.quantity = totalQty;
      position.totalCost = totalCost;
    } else {
      const realizedPnl = (price - position.avgEntryPrice) * quantity - fee;
      position.realizedPnl += realizedPnl;
      position.quantity -= quantity;
      if (position.quantity <= 0) {
        position.avgEntryPrice = 0;
        position.totalCost = 0;
      }
    }

    position.tradeCount++;
    this.positions.set(posKey, position);

    await this.savePositionToDB(position);
  }

  updatePositionPnL(exchange, symbol, priceData) {
    const posKey = `${exchange}:${symbol}`;
    const position = this.positions.get(posKey);
    
    if (position && position.quantity > 0) {
      position.currentPrice = priceData.bid;
      position.unrealizedPnl = (priceData.bid - position.avgEntryPrice) * position.quantity;
    }
  }

  async savePositionToDB(position) {
    try {
      const [dbPos, created] = await Position.findOrCreate({
        where: { exchange: position.exchange, symbol: position.symbol },
        defaults: position,
      });

      if (!created) {
        await dbPos.update(position);
      }
    } catch (error) {
      console.error('Failed to save position:', error.message);
    }
  }

  async getTradeHistory(exchange = null, limit = 100) {
    const where = { isSimulation: true };
    if (exchange) where.exchange = exchange;

    return await Trade.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  getPerformanceMetrics() {
    const totalTrades = this.tradeHistory.length;
    const profitableTrades = this.tradeHistory.filter(t => {
      if (t.side === 'SELL') return true;
      return false;
    }).length;
    
    const realizedPnlTotal = Array.from(this.positions.values())
      .reduce((sum, p) => sum + p.realizedPnl, 0);

    return {
      balance: this.balance,
      totalTrades,
      profitableTrades,
      winRate: totalTrades > 0 ? profitableTrades / totalTrades : 0,
      realizedPnl: realizedPnlTotal,
      unrealizedPnl: Array.from(this.positions.values())
        .reduce((sum, p) => sum + p.unrealizedPnl, 0),
      positions: this.getPositions(),
    };
  }

  reset() {
    this.balance = { USDT: 10000, BTC: 0, ETH: 0 };
    this.positions.clear();
    this.tradeHistory = [];
    this.priceCache.clear();
  }
}

module.exports = SimulationEngine;
