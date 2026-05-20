const redis = require('../config/redis');
const ArbitrageOpportunity = require('../models/ArbitrageOpportunity');
require('dotenv').config();

class TriangularArbitrage {
  constructor() {
    this.threshold = parseFloat(process.env.ARBITRAGE_THRESHOLD) || 0.005;
    this.baseCurrencies = ['USDT', 'BTC', 'ETH', 'BNB'];
    this.priceGraph = new Map();
    this.cachedOpportunities = new Map();
    this.opportunityCacheTTL = 5000;
    this.calculationCount = 0;
    this.lastCalcTime = 0;
    this.onOpportunityFound = null;
    this.lastTriangles = [];
  }

  setCustomTriangles(triangles) {
    this.lastTriangles = triangles;
  }

  getTriangles() {
    return this.lastTriangles.length > 0 ? this.lastTriangles : this.generateDefaultTriangles();
  }

  generateDefaultTriangles() {
    return [
      ['BTCUSDT', 'ETHBTC', 'ETHUSDT'],
      ['BTCUSDT', 'LTCBTC', 'LTCUSDT'],
      ['ETHUSDT', 'BTCETH', 'BTCUSDT'],
      ['BTCUSDT', 'XRPBTC', 'XRPUSDT'],
    ];
  }

  buildPriceGraph(prices) {
    this.priceGraph.clear();
    
    for (const [symbol, price] of Object.entries(prices)) {
      if (!price || !price.bid || !price.ask) continue;
      
      let base, quote;
      if (symbol.endsWith('USDT')) {
        base = symbol.slice(0, -4);
        quote = 'USDT';
      } else if (symbol.endsWith('BTC')) {
        base = symbol.slice(0, -3);
        quote = 'BTC';
      } else if (symbol.endsWith('ETH')) {
        base = symbol.slice(0, -3);
        quote = 'ETH';
      } else {
        continue;
      }
      
      if (!this.priceGraph.has(base)) {
        this.priceGraph.set(base, new Map());
      }
      if (!this.priceGraph.has(quote)) {
        this.priceGraph.set(quote, new Map());
      }
      
      this.priceGraph.get(base).set(quote, { 
        symbol, 
        rate: 1 / price.ask,
        type: 'buy'
      });
      this.priceGraph.get(quote).set(base, { 
        symbol, 
        rate: price.bid,
        type: 'sell'
      });
    }
    
    return this.priceGraph;
  }

  calculateArbitrage(exchange, prices) {
    const startTime = Date.now();
    this.calculationCount++;
    
    const graph = this.buildPriceGraph(prices);
    const opportunities = [];
    
    for (const startCurrency of this.baseCurrencies) {
      if (!graph.has(startCurrency)) continue;
      
      const paths = this.findTriangularPaths(graph, startCurrency);
      
      for (const path of paths) {
        const result = this.calculatePathProfit(path);
        if (result.profit > this.threshold) {
          const opportunity = {
            exchange,
            triangle: path.symbols,
            profitPercentage: result.profit * 100,
            prices: this.extractPathPrices(path.symbols, prices),
            path: path.description,
            timestamp: new Date(),
          };
          
          const cacheKey = `${exchange}-${path.symbols.join('-')}`;
          if (!this.isDuplicateOpportunity(cacheKey, opportunity)) {
            opportunities.push(opportunity);
            this.storeOpportunity(opportunity);
          }
        }
      }
    }
    
    this.lastCalcTime = Date.now() - startTime;
    
    if (this.calculationCount % 100 === 0) {
      console.log(`[Arbitrage] Calculation #${this.calculationCount}: ${this.lastCalcTime}ms, ${opportunities.length} opportunities found`);
    }
    
    return opportunities;
  }

  findTriangularPaths(graph, startCurrency) {
    const paths = [];
    const maxDepth = 3;
    
    const neighbors = Array.from(graph.get(startCurrency)?.keys() || []);
    
    for (const midCurrency of neighbors) {
      if (midCurrency === startCurrency) continue;
      
      const midNeighbors = Array.from(graph.get(midCurrency)?.keys() || []);
      
      for (const endCurrency of midNeighbors) {
        if (endCurrency === startCurrency || endCurrency === midCurrency) continue;
        if (!graph.get(endCurrency)?.has(startCurrency)) continue;
        
        const step1 = graph.get(startCurrency).get(midCurrency);
        const step2 = graph.get(midCurrency).get(endCurrency);
        const step3 = graph.get(endCurrency).get(startCurrency);
        
        if (step1 && step2 && step3) {
          paths.push({
            currencies: [startCurrency, midCurrency, endCurrency, startCurrency],
            symbols: [step1.symbol, step2.symbol, step3.symbol],
            rates: [step1.rate, step2.rate, step3.rate],
            description: `${startCurrency} → ${midCurrency} → ${endCurrency} → ${startCurrency}`
          });
        }
      }
    }
    
    return paths;
  }

  calculatePathProfit(path) {
    let amount = 1;
    
    for (const rate of path.rates) {
      amount *= rate;
    }
    
    return {
      profit: amount - 1,
      finalAmount: amount
    };
  }

  extractPathPrices(symbols, allPrices) {
    const result = {};
    for (const symbol of symbols) {
      if (allPrices[symbol]) {
        result[symbol] = allPrices[symbol];
      }
    }
    return result;
  }

  isDuplicateOpportunity(key, opportunity) {
    const now = Date.now();
    const cached = this.cachedOpportunities.get(key);
    
    if (cached) {
      if (now - cached.timestamp < this.opportunityCacheTTL) {
        if (Math.abs(opportunity.profitPercentage - cached.profitPercentage) < 0.001) {
          return true;
        }
      }
    }
    
    this.cachedOpportunities.set(key, {
      timestamp: now,
      profitPercentage: opportunity.profitPercentage
    });
    
    if (this.cachedOpportunities.size > 1000) {
      const cutoff = now - this.opportunityCacheTTL * 2;
      for (const [k, v] of this.cachedOpportunities.entries()) {
        if (v.timestamp < cutoff) {
          this.cachedOpportunities.delete(k);
        }
      }
    }
    
    return false;
  }

  async storeOpportunity(opportunity) {
    try {
      const key = `arbitrage:${opportunity.exchange}:${opportunity.triangle.join('-')}`;
      await redis.setex(key, 60, JSON.stringify(opportunity));

      await ArbitrageOpportunity.create(opportunity);

      if (this.onOpportunityFound) {
        this.onOpportunityFound(opportunity);
      }
    } catch (error) {
      console.error('Error storing opportunity:', error.message);
    }
  }

  async getRecentOpportunities(exchange, limit = 50) {
    try {
      const where = exchange ? { exchange } : {};
      return await ArbitrageOpportunity.findAll({
        where,
        order: [['timestamp', 'DESC']],
        limit,
      });
    } catch (error) {
      console.error('Error fetching opportunities:', error.message);
      return [];
    }
  }

  async getCurrentSpreads(exchange, prices) {
    const spreads = [];
    for (const [symbol, price] of Object.entries(prices)) {
      if (price.bid && price.ask) {
        const spread = ((price.ask - price.bid) / price.bid) * 100;
        spreads.push({
          exchange,
          symbol,
          bid: price.bid,
          ask: price.ask,
          spread: spread.toFixed(4),
          timestamp: price.timestamp,
        });
      }
    }
    return spreads;
  }

  getPerformanceMetrics() {
    return {
      calculationCount: this.calculationCount,
      lastCalculationTime: this.lastCalcTime,
      cachedOpportunities: this.cachedOpportunities.size,
      graphNodes: this.priceGraph.size
    };
  }
}

module.exports = TriangularArbitrage;
