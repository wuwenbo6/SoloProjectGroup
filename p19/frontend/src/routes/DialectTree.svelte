<script>
  import { onMount } from 'svelte'
  import { dialectTree } from '../lib/api.js'
  import TreeNode from '../components/TreeNode.svelte'

  let treeData = []
  let stats = null
  let loading = true
  let expandedNodes = new Set()
  let searchQuery = ''
  let searchResults = []
  let selectedNode = null

  onMount(async () => {
    try {
      treeData = await dialectTree.getTree()
      stats = await dialectTree.getStats()
    } catch (error) {
      console.error('加载方言树失败:', error)
    } finally {
      loading = false
    }
  })

  function toggleNode(nodeId) {
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId)
    } else {
      expandedNodes.add(nodeId)
    }
    expandedNodes = new Set(expandedNodes)
  }

  function selectNode(node) {
    selectedNode = node
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      searchResults = []
      return
    }
    try {
      searchResults = await dialectTree.search(searchQuery)
    } catch (error) {
      console.error('搜索失败:', error)
    }
  }

  function expandAll() {
    function collectIds(nodes) {
      for (const node of nodes) {
        expandedNodes.add(node.id)
        if (node.children && node.children.length) {
          collectIds(node.children)
        }
      }
    }
    collectIds(treeData)
    expandedNodes = new Set(expandedNodes)
  }

  function collapseAll() {
    expandedNodes = new Set()
  }
</script>

<div class="dialect-tree-page">
  <div class="page-header">
    <h1>🗺️ 地域方言谱系树</h1>
    <p>可视化展示各地方言的分类层级关系</p>
  </div>

  {#if loading}
    <div class="loading">加载中...</div>
  {:else}
    <div class="content">
      <div class="sidebar">
        <div class="search-box">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="搜索方言分类..."
            on:input={handleSearch}
          />
        </div>

        <div class="actions">
          <button class="btn-small" on:click={expandAll}>全部展开</button>
          <button class="btn-small" on:click={collapseAll}>全部折叠</button>
        </div>

        {#if searchResults.length > 0}
          <div class="search-results">
            <h4>搜索结果</h4>
            <ul>
              {#each searchResults as result}
                <li on:click={() => selectNode(result)}>
                  <span class="name">{result.name}</span>
                  <span class="code">{result.code}</span>
                  {#if result.region}
                    <span class="region">{result.region}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if stats}
          <div class="stats-card">
            <h4>统计信息</h4>
            <div class="stat-item">
              <span class="label">方言分类数</span>
              <span class="value">{stats.total_categories}</span>
            </div>
            <div class="stat-item">
              <span class="label">语料样本总数</span>
              <span class="value">{stats.total_samples}</span>
            </div>
            <div class="stat-item">
              <span class="label">树最大深度</span>
              <span class="value">{stats.max_depth}</span>
            </div>
            <div class="stat-item">
              <span class="label">叶子节点数</span>
              <span class="value">{stats.leaf_nodes}</span>
            </div>
          </div>
        {/if}
      </div>

      <div class="tree-container">
        <div class="tree-wrapper">
          {#each treeData as node}
            <TreeNode {node} {expandedNodes} {toggleNode} {selectNode} {selectedNode} />
          {/each}
        </div>

        {#if selectedNode}
          <div class="node-detail">
            <h3>{selectedNode.name}</h3>
            <div class="detail-row">
              <span class="label">编码:</span>
              <span class="value">{selectedNode.code}</span>
            </div>
            {#if selectedNode.region}
              <div class="detail-row">
                <span class="label">地区:</span>
                <span class="value">{selectedNode.region}</span>
              </div>
            {/if}
            <div class="detail-row">
              <span class="label">层级:</span>
              <span class="value">{selectedNode.level}</span>
            </div>
            <div class="detail-row">
              <span class="label">语料数:</span>
              <span class="value">{selectedNode.sample_count}</span>
            </div>
            {#if selectedNode.description}
              <div class="detail-row">
                <span class="label">描述:</span>
                <span class="value">{selectedNode.description}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .dialect-tree-page {
    padding: 24px;
    min-height: calc(100vh - 64px);
  }

  .page-header {
    color: white;
    margin-bottom: 24px;
  }

  .page-header h1 {
    margin: 0 0 8px 0;
    font-size: 28px;
  }

  .page-header p {
    margin: 0;
    opacity: 0.9;
  }

  .loading {
    text-align: center;
    padding: 60px;
    color: white;
    font-size: 18px;
  }

  .content {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 24px;
  }

  .sidebar {
    background: white;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }

  .search-box input {
    width: 100%;
    padding: 12px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 14px;
    margin-bottom: 16px;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .btn-small {
    padding: 8px 12px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
  }

  .btn-small:hover {
    background: #5a67d8;
  }

  .search-results h4 {
    margin: 0 0 12px 0;
    color: #2d3748;
  }

  .search-results ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .search-results li {
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .search-results li:hover {
    background: #f7fafc;
  }

  .search-results .name {
    font-weight: 600;
    color: #2d3748;
  }

  .search-results .code {
    font-size: 12px;
    color: #718096;
  }

  .search-results .region {
    font-size: 12px;
    color: #667eea;
  }

  .stats-card {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  }

  .stats-card h4 {
    margin: 0 0 16px 0;
    color: #2d3748;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .stat-item .label {
    color: #718096;
    font-size: 14px;
  }

  .stat-item .value {
    font-weight: 600;
    color: #2d3748;
  }

  .tree-container {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    display: flex;
    gap: 24px;
  }

  .tree-wrapper {
    flex: 1;
    min-height: 400px;
  }

  .tree-node {
    margin-left: 24px;
  }

  .node-content {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    margin: 4px 0;
  }

  .node-content:hover {
    background: #f7fafc;
  }

  .node-content.selected {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
  }

  .toggle-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: #718096;
    user-select: none;
  }

  .node-icon {
    font-size: 18px;
  }

  .node-name {
    font-weight: 500;
    flex: 1;
  }

  .node-samples {
    font-size: 12px;
    background: #e2e8f0;
    padding: 2px 8px;
    border-radius: 10px;
    color: #4a5568;
  }

  .node-detail {
    width: 280px;
    padding: 20px;
    background: #f7fafc;
    border-radius: 12px;
  }

  .node-detail h3 {
    margin: 0 0 16px 0;
    color: #2d3748;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .detail-row .label {
    color: #718096;
    font-size: 14px;
  }

  .detail-row .value {
    font-weight: 600;
    color: #2d3748;
  }
</style>
