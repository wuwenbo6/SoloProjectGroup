const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { connectDB } = require('./config/database');
const BinanceClient = require('./exchanges/binance');
const CoinbaseClient = require('./exchanges/coinbase');
const KrakenClient = require('./exchanges/kraken');
const TriangularArbitrage = require('./arbitrage/triangularCalculator');
const SimulationEngine = require('./trading/SimulationEngine');
const BacktestEngine = require('./trading/BacktestEngine');
const LinearRegressionPredictor = require('./ml/LinearRegressionPredictor');
const redis = require('./config/redis');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ETHBTC', 'LTCBTC', 'LTCUSDT', 'XRPBTC', 'XRPUSDT', 'ADAUSDT', 'ADABTC', 'SOLBTC', 'SOLUSDT'];

const binanceClient = new BinanceClient();
const coinbaseClient = new CoinbaseClient();
const krakenClient = new KrakenClient();
const arbitrageCalculator = new TriangularArbitrage();
const simulation = new SimulationEngine();
const backtestEngine = new BacktestEngine();
const predictor = new LinearRegressionPredictor();

const exchangeClients = {
  binance: binanceClient,
  coinbase: coinbaseClient,
  kraken: krakenClient,
};

const handlePriceUpdate = async (exchange, symbol, priceData) => {
  await redis.hset(`prices:${exchange}`, symbol, JSON.stringify(priceData));
  
  simulation.updatePrice(exchange, symbol, priceData);
  predictor.addPriceData(exchange, symbol, priceData);

  const prices = exchangeClients[exchange].getAllPrices();
  const spreads = await arbitrageCalculator.getCurrentSpreads(exchange, prices);
  
  io.emit('priceUpdate', { exchange, symbol, priceData, spreads });
  
  setImmediate(() => {
    const opportunities = arbitrageCalculator.calculateArbitrage(exchange, prices);
    if (opportunities.length > 0) {
      io.emit('arbitrageOpportunity', opportunities);
    }
  });
};

binanceClient.onPriceUpdate = handlePriceUpdate;
coinbaseClient.onPriceUpdate = handlePriceUpdate;
krakenClient.onPriceUpdate = handlePriceUpdate;

arbitrageCalculator.onOpportunityFound = (opportunity) => {
  io.emit('arbitrageAlert', opportunity);
};

app.get('/api/opportunities', async (req, res) => {
  const { exchange, limit } = req.query;
  const opportunities = await arbitrageCalculator.getRecentOpportunities(
    exchange, 
    parseInt(limit) || 50
  );
  res.json(opportunities);
});

app.get('/api/prices/:exchange', async (req, res) => {
  const { exchange } = req.params;
  const client = exchangeClients[exchange];
  if (!client) {
    return res.status(400).json({ error: 'Invalid exchange' });
  }
  res.json(client.getAllPrices());
});

app.get('/api/triangles', (req, res) => {
  res.json(arbitrageCalculator.getTriangles());
});

app.post('/api/triangles', (req, res) => {
  const { triangles } = req.body;
  if (Array.isArray(triangles)) {
    arbitrageCalculator.setCustomTriangles(triangles);
    io.emit('trianglesUpdated', triangles);
    res.json({ success: true, triangles: arbitrageCalculator.getTriangles() });
  } else {
    res.status(400).json({ error: 'Invalid triangles format' });
  }
});

app.get('/api/spreads', async (req, res) => {
  const allSpreads = {};
  for (const [exchange, client] of Object.entries(exchangeClients)) {
    const prices = client.getAllPrices();
    allSpreads[exchange] = await arbitrageCalculator.getCurrentSpreads(exchange, prices);
  }
  res.json(allSpreads);
});

app.get('/api/status', (req, res) => {
  const status = {
    exchanges: {},
    arbitrage: arbitrageCalculator.getPerformanceMetrics(),
    simulation: simulation.getPerformanceMetrics(),
    connectedClients: io.engine.clientsCount,
    timestamp: Date.now(),
  };
  
  for (const [exchange, client] of Object.entries(exchangeClients)) {
    status.exchanges[exchange] = {
      connected: client.isConnected(),
      priceCount: Object.keys(client.getAllPrices()).length,
    };
  }
  
  res.json(status);
});

app.post('/api/trading/execute', async (req, res) => {
  const { exchange, symbol, side, quantity } = req.body;
  
  try {
    const trade = await simulation.executeTrade(exchange, symbol, side, quantity);
    io.emit('tradeExecuted', trade);
    res.json({ success: true, trade });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/trading/arbitrage', async (req, res) => {
  const { exchange, triangle, amount } = req.body;
  
  try {
    const result = await simulation.executeArbitrageTriangular(exchange, triangle, amount);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/trading/balance', (req, res) => {
  res.json(simulation.getBalance());
});

app.get('/api/trading/positions', (req, res) => {
  res.json(simulation.getPositions());
});

app.get('/api/trading/history', async (req, res) => {
  const { exchange, limit } = req.query;
  const history = await simulation.getTradeHistory(exchange, parseInt(limit) || 100);
  res.json(history);
});

app.post('/api/trading/reset', (req, res) => {
  simulation.reset();
  res.json({ success: true, message: 'Simulation reset' });
});

app.post('/api/backtest/run', async (req, res) => {
  const config = req.body;
  
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    
    const result = await backtestEngine.runBacktest({
      ...config,
      triangle: config.triangle || ['BTCUSDT', 'ETHBTC', 'ETHUSDT'],
    });
    
    res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/backtest/results', async (req, res) => {
  const { exchange, limit } = req.query;
  const results = await backtestEngine.getBacktestResults(exchange, parseInt(limit) || 20);
  res.json(results);
});

app.get('/api/backtest/:id', async (req, res) => {
  const result = await backtestEngine.getBacktestById(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Backtest not found' });
  }
  res.json(result);
});

app.get('/api/predictions/:exchange', async (req, res) => {
  const { exchange } = req.params;
  const { symbols } = req.query;
  const symbolList = symbols ? symbols.split(',') : SYMBOLS;
  
  try {
    const predictions = await predictor.getAllPredictions(exchange, symbolList);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/predictions/train', async (req, res) => {
  const { exchange, symbol, horizon } = req.body;
  
  try {
    const result = await predictor.trainModel(exchange, symbol, horizon || 60);
    res.json({ success: true, training: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/predictions/models', async (req, res) => {
  try {
    const models = await require('./models/PredictionModel').findAll();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id} (Total: ${io.engine.clientsCount})`);
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id} (Total: ${io.engine.clientsCount})`);
  });
});

setInterval(() => {
  for (const client of Object.values(exchangeClients)) {
    client.clearStaleData();
  }
}, 10000);

const startServer = async () => {
  await connectDB();
  await predictor.loadModelsFromDB();
  
  binanceClient.connect(SYMBOLS);
  coinbaseClient.connect(SYMBOLS);
  krakenClient.connect(SYMBOLS);
  
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Monitoring ${SYMBOLS.length} trading pairs across 3 exchanges`);
  });
};

startServer();
