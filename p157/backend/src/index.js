import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { saveSnapshot, getSnapshots, getSnapshotById, deleteSnapshot } from './database.js'
import { compileCode, getCompilerInfo } from './compiler.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '50mb' }))

const upload = multer({ storage: multer.memoryStorage() })

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.get('/api/compiler/info', async (req, res) => {
  try {
    const info = await getCompilerInfo()
    res.json(info)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/compiler/compile', async (req, res) => {
  try {
    const { source, options = {} } = req.body
    const result = await compileCode(source, options)
    res.json(result)
  } catch (e) {
    res.status(500).json({ 
      success: false, 
      error: e.message 
    })
  }
})

app.get('/api/snapshots', async (req, res) => {
  try {
    const snapshots = getSnapshots()
    res.json(snapshots)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/snapshots/:id', async (req, res) => {
  try {
    const snapshot = getSnapshotById(req.params.id)
    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' })
    }
    res.json(snapshot)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/snapshots', async (req, res) => {
  try {
    const { name, timestamp, data } = req.body
    const id = saveSnapshot(name, timestamp || Date.now(), data)
    res.json({ success: true, id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/snapshots/:id', async (req, res) => {
  try {
    deleteSnapshot(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/elf/upload', upload.single('elf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    res.json({
      success: true,
      fileName: req.file.originalname,
      size: req.file.size,
      buffer: req.file.buffer.toString('base64')
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(PORT, () => {
  console.log(`ARM Simulator Backend Server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
})

export default app
