const WebSocket = require('ws');
require('dotenv').config();

class BinanceClient {
  constructor() {
    this.wsUrl = process.env.BINANCE_WS_URL;
    this.ws = null;
    this.prices = new Map();
    this.subscriptions = new Set();
    this.onPriceUpdate = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.dataTimeout = 30000;
    this.lastUpdateTime = Date.now();
    this.symbols = [];
  }

  connect(symbols) {
    this.symbols = symbols;
    const streams = symbols.map(s => `${s.toLowerCase()}@bookTicker`).join('/');
    const url = `${this.wsUrl}/${streams}`;
    
    console.log(`[Binance] Connecting to WebSocket...`);
    
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log(`[Binance] WebSocket connected successfully`);
      this.reconnectAttempts = 0;
      this.lastUpdateTime = Date.now();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        if (message.s && message.b && message.a) {
          const symbol = message.s;
          const priceData = {
            bid: parseFloat(message.b),
            ask: parseFloat(message.a),
            timestamp: Date.now()
          };
          
          if (this.isValidPriceData(symbol, priceData)) {
            this.prices.set(symbol, priceData);
            this.lastUpdateTime = Date.now();
            
            if (this.onPriceUpdate) {
              this.onPriceUpdate('binance', symbol, priceData);
            }
          }
        }
      } catch (error) {
        console.error('[Binance] Error parsing message:', error.message);
      }
    });

    this.ws.on('error', (error) => {
      console.error('[Binance] WebSocket error:', error.message);
    });

    this.ws.on('close', () => {
      console.log(`[Binance] WebSocket closed, attempting reconnect...`);
      this.scheduleReconnect();
    });
  }

  isValidPriceData(symbol, priceData) {
    if (!priceData.bid || !priceData.ask || priceData.bid <= 0 || priceData.ask <= 0) {
      console.warn(`[Binance] Invalid price for ${symbol}: bid=${priceData.bid}, ask=${priceData.ask}`);
      return false;
    }
    
    if (priceData.bid > priceData.ask) {
      console.warn(`[Binance] Bid > Ask for ${symbol}, possible data corruption`);
      return false;
    }
    
    const existing = this.prices.get(symbol);
    if (existing) {
      const spread = Math.abs(priceData.bid - existing.bid) / existing.bid;
      if (spread > 0.5) {
        console.warn(`[Binance] Abnormal price change for ${symbol}: ${(spread * 100).toFixed(2)}% change`);
        return false;
      }
    }
    
    return true;
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[Binance] Max reconnect attempts reached, giving up`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    
    console.log(`[Binance] Reconnect attempt ${this.reconnectAttempts} in ${delay}ms...`);
    
    setTimeout(() => {
      this.clearStaleData();
      this.connect(this.symbols);
    }, delay);
  }

  clearStaleData() {
    const now = Date.now();
    let cleared = 0;
    
    for (const [symbol, data] of this.prices.entries()) {
      if (now - data.timestamp > this.dataTimeout) {
        this.prices.delete(symbol);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      console.log(`[Binance] Cleared ${cleared} stale price entries`);
    }
  }

  getPrice(symbol) {
    const price = this.prices.get(symbol);
    if (!price) return null;
    
    if (Date.now() - price.timestamp > this.dataTimeout) {
      this.prices.delete(symbol);
      return null;
    }
    
    return price;
  }

  getAllPrices() {
    this.clearStaleData();
    const result = {};
    for (const [symbol, price] of this.prices.entries()) {
      result[symbol] = price;
    }
    return result;
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

module.exports = BinanceClient;
