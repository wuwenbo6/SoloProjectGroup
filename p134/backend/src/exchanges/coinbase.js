const WebSocket = require('ws');
require('dotenv').config();

class CoinbaseClient {
  constructor() {
    this.wsUrl = process.env.COINBASE_WS_URL;
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
    const coinbaseSymbols = symbols.map(s => 
      s.slice(0, -4) + '-' + s.slice(-4)
    ).filter(s => s.includes('USDT') || s.includes('BTC') || s.includes('ETH'));
    
    console.log(`[Coinbase] Connecting to WebSocket...`);
    
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log(`[Coinbase] WebSocket connected successfully`);
      this.reconnectAttempts = 0;
      this.lastUpdateTime = Date.now();
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: coinbaseSymbols,
        channels: ['ticker']
      }));
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        if (message.type === 'ticker' && message.product_id) {
          const symbol = message.product_id.replace('-', '');
          const priceData = {
            bid: parseFloat(message.best_bid),
            ask: parseFloat(message.best_ask),
            timestamp: Date.now()
          };
          
          if (this.isValidPriceData(symbol, priceData)) {
            this.prices.set(symbol, priceData);
            this.lastUpdateTime = Date.now();
            
            if (this.onPriceUpdate) {
              this.onPriceUpdate('coinbase', symbol, priceData);
            }
          }
        }
      } catch (error) {
        console.error('[Coinbase] Error parsing message:', error.message);
      }
    });

    this.ws.on('error', (error) => {
      console.error('[Coinbase] WebSocket error:', error.message);
    });

    this.ws.on('close', () => {
      console.log(`[Coinbase] WebSocket closed, attempting reconnect...`);
      this.scheduleReconnect();
    });
  }

  isValidPriceData(symbol, priceData) {
    if (!priceData.bid || !priceData.ask || priceData.bid <= 0 || priceData.ask <= 0) {
      console.warn(`[Coinbase] Invalid price for ${symbol}: bid=${priceData.bid}, ask=${priceData.ask}`);
      return false;
    }
    
    if (priceData.bid > priceData.ask) {
      console.warn(`[Coinbase] Bid > Ask for ${symbol}, possible data corruption`);
      return false;
    }
    
    const existing = this.prices.get(symbol);
    if (existing) {
      const spread = Math.abs(priceData.bid - existing.bid) / existing.bid;
      if (spread > 0.5) {
        console.warn(`[Coinbase] Abnormal price change for ${symbol}: ${(spread * 100).toFixed(2)}% change`);
        return false;
      }
    }
    
    return true;
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[Coinbase] Max reconnect attempts reached, giving up`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    
    console.log(`[Coinbase] Reconnect attempt ${this.reconnectAttempts} in ${delay}ms...`);
    
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
      console.log(`[Coinbase] Cleared ${cleared} stale price entries`);
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

module.exports = CoinbaseClient;
