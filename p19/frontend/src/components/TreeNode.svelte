<script>
  export let node
  export let expandedNodes
  export let toggleNode
  export let selectNode
  export let selectedNode

  $: isExpanded = expandedNodes.has(node.id)
  $: hasChildren = node.children && node.children.length > 0
</script>

<div class="tree-node">
  <div
    class="node-content"
    class:selected={selectedNode?.id === node.id}
    on:click={() => selectNode(node)}
  >
    <span
      class="toggle-icon"
      on:click|stopPropagation={() => hasChildren && toggleNode(node.id)}
    >
      {#if hasChildren}
        {isExpanded ? '−' : '+'}
      {/if}
    </span>
    <span class="node-icon">🗺️</span>
    <span class="node-name">{node.name}</span>
    <span class="node-samples">{node.sample_count}</span>
  </div>

  {#if isExpanded && hasChildren}
    <div class="children">
      {#each node.children as child}
        <svelte:self
          node={child}
          expandedNodes={expandedNodes}
          toggleNode={toggleNode}
          selectNode={selectNode}
          selectedNode={selectedNode}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .tree-node {
    margin-left: 20px;
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

  .node-content.selected .node-samples {
    background: rgba(255,255,255,0.3);
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

  .children {
    border-left: 2px dashed #e2e8f0;
    margin-left: 10px;
  }
</style>
