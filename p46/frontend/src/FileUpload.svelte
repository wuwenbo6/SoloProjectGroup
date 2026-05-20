<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  let uploading = false
  let symbol = ''
  let file = null

  function handleFileChange(e) {
    file = e.target.files[0]
  }

  async function upload() {
    if (!file || !symbol) {
      alert('Please enter symbol and select a file')
      return
    }

    uploading = true
    try {
      const formData = new FormData()
      formData.append('symbol', symbol)
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        dispatch('uploaded')
        symbol = ''
        file = null
      } else {
        alert('Upload failed')
      }
    } catch (e) {
      console.error('Upload error:', e)
      alert('Upload failed')
    } finally {
      uploading = false
    }
  }
</script>

<div class="upload-section">
  <h3>Upload Market Data</h3>
  <div class="input-group">
    <label>Symbol</label>
    <input
      type="text"
      bind:value={symbol}
      placeholder="e.g., BTC-USDT"
    />
  </div>
  <div class="input-group">
    <label>CSV File</label>
    <input
      type="file"
      accept=".csv"
      on:change={handleFileChange}
    />
  </div>
  {#if file}
    <p class="file-info">Selected: {file.name}</p>
  {/if}
  <button
    class="upload-button"
    disabled={uploading || !file || !symbol}
    on:click={upload}
  >
    {uploading ? 'Uploading...' : 'Upload'}
  </button>
</div>

<style>
  .upload-section {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }

  h3 {
    margin: 0 0 1rem 0;
    color: #333;
    font-size: 1.1rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .input-group label {
    font-weight: 500;
    color: #555;
  }

  .input-group input {
    padding: 0.75rem 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .input-group input:focus {
    outline: none;
    border-color: #667eea;
  }

  .file-info {
    color: #666;
    font-size: 0.9rem;
    margin: 0 0 1rem 0;
  }

  .upload-button {
    width: 100%;
    background: #667eea;
    color: white;
    border: none;
    padding: 0.875rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
  }

  .upload-button:hover:not(:disabled) {
    background: #5a6fd6;
  }

  .upload-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
