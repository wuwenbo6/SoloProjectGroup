const WebSocket = require('ws');
require('dotenv').config();

class KrakenClient {
  constructor() {
    this.wsUrl = process.env.KRAKEN_WS_URL;
    this.ws = null;
    this.prices = new Map();
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
    const krakenSymbols = symbols.map(s => 
      `X${s.slice(0, -4)}Z${s.slice(-4)}`
    ).filter(s => s.includes('USDT') || s.includes('XBT') || s.includes('ETH'));
    
    console.log(`[Kraken] Connecting to WebSocket...`);
    
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log(`[Kraken] WebSocket connected successfully`);
      this.reconnectAttempts = 0;
      this.lastUpdateTime = Date.now();
      this.ws.send(JSON.stringify({
        event: 'subscribe',
        pair: krakenSymbols,
        subscription: { name: 'ticker' }
      }));
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        if (Array.isArray(message) && message.length > 1 && message[2] === 'ticker') {
          const pair = message[3].replace('/', '').replace('XBT', 'BTC');
          const tickerData = message[1];
          const priceData = {
            bid: parseFloat(tickerData.b[0]),
            ask: parseFloat(tickerData.a[0]),
            timestamp: Date.now()
          };
          
          if (this.isValidPriceData(pair, priceData)) {
            this.prices.set(pair, priceData);
            this.lastUpdateTime = Date.now();
            
            if (this.onPriceUpdate) {
              this.onPriceUpdate('kraken', pair, priceData);
            }
          }
        }
      } catch (error) {
        console.error('[Kraken] Error parsing message:', error.message);
      }
    });

    this.ws.on('error', (error) => {
      console.error('[Kraken] WebSocket error:', error.message);
    });

    this.ws.on('close', () => {
      console.log(`[Kraken] WebSocket closed, attempting reconnect...`);
      this.scheduleReconnect();
    });
  }

  isValidPriceData(symbol, priceData) {
    if (!priceData.bid || !priceData.ask || priceData.bid <= 0 || priceData.ask <= 0) {
      console.warn(`[Kraken] Invalid price for ${symbol}: bid=${priceData.bid}, ask=${priceData.ask}`);
      return false;
    }
    
    if (priceData.bid > priceData.ask) {
      console.warn(`[Kraken] Bid > Ask for ${symbol}, possible data corruption`);
      return false;
    }
    
    const existing = this.prices.get(symbol);
    if (existing) {
      const spread = Math.abs(priceData.bid - existing.bid) / existing.bid;
      if (spread > 0.5) {
        console.warn(`[Kraken] Abnormal price change for ${symbol}: ${(spread * 100).toFixed(2)}% change`);
        return false;
      }
    }
    
    return true;
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[Kraken] Max reconnect attempts reached, giving up`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    
    console.log(`[Kraken] Reconnect attempt ${this.reconnectAttempts} in ${delay}ms...`);
    
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
      console.log(`[Kraken] Cleared ${cleared} stale price entries`);
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

module.exports = KrakenClient;
