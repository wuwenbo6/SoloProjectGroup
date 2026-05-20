import { useState, useEffect } from 'react'
import { MidiMapping } from '../types/electron'
import { v4 as uuidv4 } from 'uuid'

interface MidiMappingManagerProps {
  onClose?: () => void
}

const defaultMapping: Omit<MidiMapping, 'createdAt'> = {
  id: '',
  name: 'New Mapping',
  enabled: true,
  sourceType: 'note',
  targetType: 'note'
}

export default function MidiMappingManager({ onClose }: MidiMappingManagerProps) {
  const [mappings, setMappings] = useState<MidiMapping[]>([])
  const [editingMapping, setEditingMapping] = useState<MidiMapping | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadMappings()
  }, [])

  const loadMappings = async () => {
    const loaded = await window.api.getMappings()
    setMappings(loaded)
  }

  const handleSave = async (mapping: Omit<MidiMapping, 'createdAt'>) => {
    const saved = await window.api.saveMapping(mapping)
    setMappings(prev => {
      const existing = prev.find(m => m.id === saved.id)
      if (existing) {
        return prev.map(m => m.id === saved.id ? saved : m)
      }
      return [saved, ...prev]
    })
    setEditingMapping(null)
    setShowForm(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this mapping?')) {
      await window.api.deleteMapping(id)
      setMappings(prev => prev.filter(m => m.id !== id))
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    await window.api.toggleMapping(id, enabled)
    setMappings(prev => prev.map(m => 
      m.id === id ? { ...m, enabled } : m
    ))
  }

  const handleEdit = (mapping: MidiMapping) => {
    setEditingMapping(mapping)
    setShowForm(true)
  }

  const handleCreate = () => {
    setEditingMapping(null)
    setShowForm(true)
  }

  return (
    <div style={{
      padding: '20px',
      background: '#1a1a2e',
      color: '#eee',
      minHeight: '100%'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>MIDI Message Mappings</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleCreate}
            style={{
              padding: '8px 16px',
              background: '#4a9eff',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            + New Mapping
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: '#333',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <MappingForm
          mapping={editingMapping}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {mappings.map(mapping => (
          <div
            key={mapping.id}
            style={{
              padding: '15px',
              background: mapping.enabled ? '#252545' : '#1e1e2e',
              borderRadius: '8px',
              border: `1px solid ${mapping.enabled ? '#4a9eff' : '#333'}`,
              opacity: mapping.enabled ? 1 : 0.6
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>{mapping.name}</h3>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                  {mapping.sourceType}{mapping.sourceChannel !== undefined ? ` ch${mapping.sourceChannel}` : ''}
                  {mapping.sourceValue !== undefined ? ` → value:${mapping.sourceValue}` : ''}
                  {' → '}
                  {mapping.targetType}{mapping.targetChannel !== undefined ? ` ch${mapping.targetChannel}` : ''}
                  {mapping.targetValue !== undefined ? ` → value:${mapping.targetValue}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => handleToggle(mapping.id, !mapping.enabled)}
                  style={{
                    padding: '5px 10px',
                    background: mapping.enabled ? '#4caf50' : '#666',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {mapping.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  onClick={() => handleEdit(mapping)}
                  style={{
                    padding: '5px 10px',
                    background: '#4a9eff',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(mapping.id)}
                  style={{
                    padding: '5px 10px',
                    background: '#f44336',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {mappings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            No mappings created yet. Click "New Mapping" to get started.
          </div>
        )}
      </div>
    </div>
  )
}

interface MappingFormProps {
  mapping: MidiMapping | null
  onSave: (mapping: Omit<MidiMapping, 'createdAt'>) => void
  onCancel: () => void
}

function MappingForm({ mapping, onSave, onCancel }: MappingFormProps) {
  const [formData, setFormData] = useState<Omit<MidiMapping, 'createdAt'>>(
    mapping || { ...defaultMapping, id: uuidv4() }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} style={{
      padding: '20px',
      background: '#252545',
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      <h3 style={{ marginTop: 0 }}>{mapping ? 'Edit Mapping' : 'Create Mapping'}</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px' }}>Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            style={{
              width: '100%',
              padding: '8px',
              background: '#1a1a2e',
              border: '1px solid #444',
              borderRadius: '4px',
              color: 'white'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
            />
            Enabled
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
        <div style={{ padding: '15px', background: '#1a1a2e', borderRadius: '6px' }}>
          <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Source</h4>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Type</label>
            <select
              value={formData.sourceType}
              onChange={e => setFormData({ ...formData, sourceType: e.target.value as any })}
              style={{
                width: '100%',
                padding: '6px',
                background: '#252545',
                border: '1px solid #444',
                borderRadius: '4px',
                color: 'white'
              }}
            >
              <option value="note">Note</option>
              <option value="cc">Control Change</option>
              <option value="pitch">Pitch Bend</option>
            </select>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
              Channel (optional)
            </label>
            <input
              type="number"
              min="0"
              max="15"
              value={formData.sourceChannel ?? ''}
              onChange={e => setFormData({ 
                ...formData, 
                sourceChannel: e.target.value === '' ? undefined : parseInt(e.target.value) 
              })}
              placeholder="Any"
              style={{
                width: '100%',
                padding: '6px',
                background: '#252545',
                border: '1px solid #444',
                borderRadius: '4px',
                color: 'white'
              }}
            />
          </div>

          {formData.sourceType !== 'pitch' && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                {formData.sourceType === 'note' ? 'Note Number' : 'CC Number'} (optional)
              </label>
              <input
                type="number"
                min="0"
                max="127"
                value={formData.sourceValue ?? ''}
                onChange={e => setFormData({ 
                  ...formData, 
                  sourceValue: e.target.value === '' ? undefined : parseInt(e.target.value) 
                })}
                placeholder="Any"
                style={{
                  width: '100%',
                  padding: '6px',
                  background: '#252545',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: 'white'
                }}
              />
            </div>
          )}
        </div>

        <div style={{ padding: '15px', background: '#1a1a2e', borderRadius: '6px' }}>
          <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Target</h4>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Type</label>
            <select
              value={formData.targetType}
              onChange={e => setFormData({ ...formData, targetType: e.target.value as any })}
              style={{
                width: '100%',
                padding: '6px',
                background: '#252545',
                border: '1px solid #444',
                borderRadius: '4px',
                color: 'white'
              }}
            >
              <option value="note">Note</option>
              <option value="cc">Control Change</option>
              <option value="pitch">Pitch Bend</option>
            </select>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
              Channel (optional)
            </label>
            <input
              type="number"
              min="0"
              max="15"
              value={formData.targetChannel ?? ''}
              onChange={e => setFormData({ 
                ...formData, 
                targetChannel: e.target.value === '' ? undefined : parseInt(e.target.value) 
              })}
              placeholder="Same as source"
              style={{
                width: '100%',
                padding: '6px',
                background: '#252545',
                border: '1px solid #444',
                borderRadius: '4px',
                color: 'white'
              }}
            />
          </div>

          {formData.targetType !== 'pitch' && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
                {formData.targetType === 'note' ? 'Note Number' : 'CC Number'} (optional)
              </label>
              <input
                type="number"
                min="0"
                max="127"
                value={formData.targetValue ?? ''}
                onChange={e => setFormData({ 
                  ...formData, 
                  targetValue: e.target.value === '' ? undefined : parseInt(e.target.value) 
                })}
                placeholder="Same as source"
                style={{
                  width: '100%',
                  padding: '6px',
                  background: '#252545',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: 'white'
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
          Transform Expression (optional - JavaScript)
        </label>
        <input
          type="text"
          value={formData.transform || ''}
          onChange={e => setFormData({ 
            ...formData, 
            transform: e.target.value || undefined 
          })}
          placeholder="e.g., { ...msg, velocity: Math.min(msg.velocity + 10, 127) }"
          style={{
            width: '100%',
            padding: '8px',
            background: '#1a1a2e',
            border: '1px solid #444',
            borderRadius: '4px',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}
        />
        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
          Use `msg` to access the original MIDI message
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: '#333',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            padding: '8px 16px',
            background: '#4caf50',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Save Mapping
        </button>
      </div>
    </form>
  )
}
