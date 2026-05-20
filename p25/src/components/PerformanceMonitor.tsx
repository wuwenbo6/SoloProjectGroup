import React, { useState, useEffect, useRef } from 'react'

interface PerformanceMetrics {
  frameTime: number
  droppedFrames: number
  audioLatency: number
  xrunCount: number
}

const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    frameTime: 0,
    droppedFrames: 0,
    audioLatency: 0,
    xrunCount: 0,
  })

  const [isVisible, setIsVisible] = useState(false)
  const lastFrameTime = useRef(performance.now())
  const frameCount = useRef(0)

  useEffect(() => {
    if (!isVisible) return

    const measureFrames = () => {
      const now = performance.now()
      const delta = now - lastFrameTime.current
      frameCount.current++

      if (delta > 20) {
        setMetrics((prev) => ({
          ...prev,
          droppedFrames: prev.droppedFrames + Math.floor(delta / 16),
        }))
      }

      setMetrics((prev) => ({
        ...prev,
        frameTime: delta,
      }))

      lastFrameTime.current = now
    }

    const animationId = requestAnimationFrame(function loop() {
      measureFrames()
      requestAnimationFrame(loop)
    })

    return () => cancelAnimationFrame(animationId)
  }, [isVisible])

  const getLatencyColor = (latency: number) => {
    if (latency < 10) return 'text-green-400'
    if (latency < 20) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getFrameTimeColor = (time: number) => {
    if (time < 16) return 'text-green-400'
    if (time < 25) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-daw-bg-light border border-daw-accent/30 text-daw-accent px-3 py-1 rounded text-xs hover:bg-daw-bg-lighter transition-colors z-50"
      >
        ⚡ Performance
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-daw-bg-light/95 backdrop-blur border border-daw-accent/30 rounded-lg p-4 w-72 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-daw-accent">Performance Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Frame Time</span>
          <span className={`text-xs font-mono ${getFrameTimeColor(metrics.frameTime)}`}>
            {metrics.frameTime.toFixed(1)} ms
          </span>
        </div>

        <div className="w-full h-2 bg-daw-bg rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${metrics.frameTime > 25 ? 'bg-red-500' : metrics.frameTime > 16 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(100, (metrics.frameTime / 32) * 100)}%` }}
          />
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Dropped Frames</span>
          <span className={`text-xs font-mono ${metrics.droppedFrames > 10 ? 'text-red-400' : 'text-green-400'}`}>
            {metrics.droppedFrames}
          </span>
        </div>

        <div className="border-t border-daw-bg-lighter pt-3 mt-3">
          <h4 className="text-xs font-medium text-gray-300 mb-2">Audio Engine</h4>

          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400">Est. Latency</span>
            <span className={`text-xs font-mono ${getLatencyColor(metrics.audioLatency)}`}>
              ~12.8 ms
            </span>
          </div>

          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400">Buffer Size</span>
            <span className="text-xs font-mono text-gray-300">512 samples</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Sample Rate</span>
            <span className="text-xs font-mono text-gray-300">44100 Hz</span>
          </div>
        </div>

        <div className="border-t border-daw-bg-lighter pt-3 mt-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400">XRuns (Dropouts)</span>
            <span className={`text-xs font-mono ${metrics.xrunCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {metrics.xrunCount}
            </span>
          </div>

          {metrics.xrunCount > 0 && (
            <div className="p-2 bg-red-500/20 border border-red-500/30 rounded">
              <p className="text-xs text-red-400">
                ⚠️ Audio dropouts detected! Consider increasing buffer size or closing other apps.
              </p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() =>
          setMetrics({ frameTime: 0, droppedFrames: 0, audioLatency: 0, xrunCount: 0 })
        }
        className="mt-4 w-full py-1.5 bg-daw-bg text-xs text-gray-400 rounded hover:bg-daw-bg-lighter hover:text-white transition-colors"
      >
        Reset Counters
      </button>
    </div>
  )
}

export default PerformanceMonitor
