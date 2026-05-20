import React, { useCallback, useState } from 'react'
import { Upload, FileMusic, AlertCircle, CheckCircle } from 'lucide-react'
import { useAppDispatch } from '../store'
import { importRppProject as importRppTracks } from '../store/tracksSlice'
import { importRppProjectSettings } from '../store/projectSlice'
import { parseRpp, generateTestRpp } from '../utils/rppParser'
import { RppProject } from '../types'

interface RppImportProps {
  onClose?: () => void
}

const RppImport: React.FC<RppImportProps> = ({ onClose }) => {
  const dispatch = useAppDispatch()
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [importedProject, setImportedProject] = useState<RppProject | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      setError(null)
      setSuccess(false)

      if (!file.name.toLowerCase().endsWith('.rpp')) {
        setError('Please select a valid .RPP file')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const project = parseRpp(content)
          setImportedProject(project)
        } catch (err) {
          setError('Failed to parse RPP file. The file may be corrupted or in an unsupported format.')
          console.error(err)
        }
      }
      reader.onerror = () => {
        setError('Failed to read file')
      }
      reader.readAsText(file)
    },
    []
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleFile(files[0])
      }
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFile(files[0])
      }
    },
    [handleFile]
  )

  const handleImport = useCallback(() => {
    if (!importedProject) return

    try {
      dispatch(importRppProjectSettings(importedProject))
      dispatch(importRppTracks(importedProject))
      setSuccess(true)
      setTimeout(() => {
        onClose?.()
      }, 1500)
    } catch (err) {
      setError('Failed to import project')
      console.error(err)
    }
  }, [importedProject, dispatch, onClose])

  const handleTestImport = useCallback(() => {
    try {
      const content = generateTestRpp()
      const project = parseRpp(content)
      setImportedProject(project)
    } catch (err) {
      setError('Test import failed')
      console.error(err)
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-daw-bg-light rounded-xl border border-daw-bg-lighter w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-daw-accent/20 flex items-center justify-center">
              <FileMusic className="text-daw-accent" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-display text-white">Import REAPER Project</h2>
              <p className="text-sm text-gray-400">Load tracks, plugins, and automation</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-daw-bg-lighter transition-colors"
            >
              <span className="text-gray-400">×</span>
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="text-red-400" size={16} />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/30 rounded-lg flex items-center gap-2">
            <CheckCircle className="text-green-400" size={16} />
            <span className="text-sm text-green-300">Project imported successfully!</span>
          </div>
        )}

        {!importedProject ? (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-daw-accent bg-daw-accent/10'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <Upload className="mx-auto mb-4 text-gray-400" size={32} />
              <p className="text-sm text-gray-300 mb-2">Drag and drop your .RPP file here</p>
              <p className="text-xs text-gray-500 mb-4">or</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-daw-accent text-daw-bg rounded-lg cursor-pointer hover:bg-cyan-400 transition-colors">
                <Upload size={16} />
                <span className="text-sm font-medium">Browse Files</span>
                <input
                  type="file"
                  accept=".rpp"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </div>

            <div className="mt-4 pt-4 border-t border-daw-bg-lighter">
              <button
                onClick={handleTestImport}
                className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Try with test data
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-daw-bg rounded-lg p-4">
              <h3 className="text-sm font-medium text-white mb-3">Project Preview</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Name:</span>
                  <span className="text-white ml-2">{importedProject.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">BPM:</span>
                  <span className="text-white ml-2">{importedProject.bpm}</span>
                </div>
                <div>
                  <span className="text-gray-500">Sample Rate:</span>
                  <span className="text-white ml-2">{importedProject.sampleRate} Hz</span>
                </div>
                <div>
                  <span className="text-gray-500">Time Signature:</span>
                  <span className="text-white ml-2">{importedProject.timeSignature.join('/')}</span>
                </div>
              </div>
            </div>

            <div className="bg-daw-bg rounded-lg p-4">
              <h3 className="text-sm font-medium text-white mb-3">Tracks ({importedProject.tracks.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {importedProject.tracks.map((track, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-daw-bg-light"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: track.color }}
                      />
                      <span className="text-sm text-white">{track.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{track.items.length} clips</span>
                      <span>{track.plugins.length} plugins</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setImportedProject(null)
                  setError(null)
                }}
                className="flex-1 py-2 px-4 rounded-lg border border-daw-bg-lighter text-sm text-gray-300 hover:bg-daw-bg-lighter transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                className="flex-1 py-2 px-4 rounded-lg bg-daw-accent text-daw-bg text-sm font-medium hover:bg-cyan-400 transition-colors"
              >
                Import Project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RppImport
