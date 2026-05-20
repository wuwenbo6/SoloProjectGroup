const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const Database = require('./database');
const RISCVSimulator = require('./simulator');
const elfParser = require('./elf-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({ dest: 'uploads/' });
const db = new Database();
const simulators = new Map();

wss.on('connection', (ws) => {
  let sessionId = null;
  let simulator = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'init':
          sessionId = data.sessionId || Date.now().toString();
          simulator = new RISCVSimulator();
          simulators.set(sessionId, simulator);
          
          simulator.uart.onTx = (byte) => {
            ws.send(JSON.stringify({
              type: 'uart-tx',
              byte: byte
            }));
          };
          
          await db.saveSession(sessionId, {
            createdAt: new Date().toISOString(),
            status: 'active'
          });
          
          ws.send(JSON.stringify({
            type: 'init',
            sessionId,
            status: 'ready'
          }));
          break;

        case 'load-elf':
          if (!simulator) break;
          const elfData = Buffer.from(data.elfData, 'base64');
          const elf = elfParser.parse(elfData);
          simulator.loadELF(elf);
          
          ws.send(JSON.stringify({
            type: 'elf-loaded',
            entry: elf.entry
          }));
          break;

        case 'step':
          if (!simulator) break;
          const result = simulator.step();
          ws.send(JSON.stringify({
            type: 'step-result',
            ...result,
            registers: simulator.getRegisters(),
            pc: simulator.getPC(),
            csr: simulator.csr
          }));
          break;

        case 'run':
          if (!simulator) break;
          simulator.run((state) => {
            ws.send(JSON.stringify({
              type: 'state-update',
              ...state
            }));
          });
          break;

        case 'pause':
          if (!simulator) break;
          simulator.pause();
          break;

        case 'reset':
          if (!simulator) break;
          simulator.reset();
          simulator.uart.onTx = (byte) => {
            ws.send(JSON.stringify({
              type: 'uart-tx',
              byte: byte
            }));
          };
          ws.send(JSON.stringify({
            type: 'reset',
            registers: simulator.getRegisters(),
            pc: simulator.getPC()
          }));
          break;

        case 'set-breakpoint':
          if (!simulator) break;
          simulator.setBreakpoint(data.address);
          break;

        case 'remove-breakpoint':
          if (!simulator) break;
          simulator.removeBreakpoint(data.address);
          break;

        case 'set-watchpoint':
          if (!simulator) break;
          simulator.setWatchpoint(data.address, data.type);
          break;

        case 'remove-watchpoint':
          if (!simulator) break;
          simulator.removeWatchpoint(data.address);
          break;

        case 'get-memory':
          if (!simulator) break;
          const memory = simulator.getMemory(data.address, data.length);
          ws.send(JSON.stringify({
            type: 'memory-data',
            address: data.address,
            data: memory
          }));
          break;

        case 'get-registers':
          if (!simulator) break;
          ws.send(JSON.stringify({
            type: 'registers',
            registers: simulator.getRegisters(),
            pc: simulator.getPC()
          }));
          break;

        case 'assemble':
          if (!simulator) break;
          const assembled = simulator.assemble(data.code);
          simulator.loadProgram(assembled.code);
          ws.send(JSON.stringify({
            type: 'assembled',
            ...assembled
          }));
          break;

        case 'save-session':
          if (sessionId) {
            await db.saveSession(sessionId, {
              code: data.code,
              breakpoints: simulator ? simulator.getBreakpoints() : [],
              watchpoints: simulator ? simulator.getWatchpoints() : [],
              updatedAt: new Date().toISOString()
            });
          }
          break;

        case 'waveform-enable':
          if (!simulator) break;
          simulator.tracer.enable();
          break;

        case 'waveform-disable':
          if (!simulator) break;
          simulator.tracer.disable();
          break;

        case 'waveform-get':
          if (!simulator) break;
          const waveformData = simulator.tracer.getWaveformJSON();
          ws.send(JSON.stringify({
            type: 'waveform-data',
            ...waveformData
          }));
          break;

        case 'waveform-download':
          if (!simulator) break;
          const fstData = simulator.tracer.getFSTFile();
          ws.send(JSON.stringify({
            type: 'waveform-download',
            data: fstData.toString('base64')
          }));
          break;

        case 'uart-send':
          if (!simulator) break;
          simulator.uart.rxByte(data.byte);
          break;

        case 'uart-clear':
          if (!simulator) break;
          simulator.uart.rxBuffer = [];
          simulator.uart.txBuffer = [];
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    if (sessionId) {
      simulators.delete(sessionId);
    }
  });
});

app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await db.getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await db.getSession(req.params.id);
    if (session) {
      res.json(session);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.deleteSession(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload-elf', upload.single('elf'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    filename: req.file.filename,
    path: req.file.path
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});
