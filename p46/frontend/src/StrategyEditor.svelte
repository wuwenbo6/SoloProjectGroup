<script>
  export let code = ''
</script>

<div class="editor-section">
  <h3>Strategy Code (Python)</h3>
  <div class="editor-help">
    <p>Available variables:</p>
    <ul>
      <li><code>bids</code> - List of [price, quantity] bid levels</li>
      <li><code>asks</code> - List of [price, quantity] ask levels</li>
      <li><code>symbol</code> - Current trading symbol</li>
      <li><code>timestamp</code> - Current timestamp (ms)</li>
      <li><code>capital</code> - Remaining capital</li>
      <li><code>position</code> - Current position size</li>
    </ul>
    <p>Set <code>orders</code> to a list of order objects: <code>{"side": "buy", "price": 100, "quantity": 10}</code></p>
  </div>
  <textarea
    bind:value={code}
    placeholder="Write your strategy here..."
  />
</div>

<style>
  .editor-section {
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

  .editor-help {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
    color: #666;
  }

  .editor-help p {
    margin: 0 0 0.5rem 0;
    font-weight: 500;
  }

  .editor-help ul {
    margin: 0 0 0.5rem 1.25rem;
    padding: 0;
  }

  .editor-help li {
    padding: 0.25rem 0;
  }

  .editor-help code {
    background: #e3f2fd;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
    color: #1976d2;
  }

  textarea {
    width: 100%;
    min-height: 300px;
    padding: 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 0.9rem;
    line-height: 1.6;
    resize: vertical;
    transition: border-color 0.2s;
  }

  textarea:focus {
    outline: none;
    border-color: #667eea;
  }
</style>
