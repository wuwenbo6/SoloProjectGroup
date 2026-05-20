<script>
  import { onMount, onDestroy } from 'svelte'
  import Chart from 'chart.js/auto'

  export let snapshots = []

  let canvas
  let chart = null
  let currentIndex = 0

  function createOrUpdateChart() {
    if (!canvas || snapshots.length === 0) return

    const snapshot = snapshots[currentIndex]
    if (!snapshot) return

    const bids = snapshot.bids || []
    const asks = snapshot.asks || []

    const bidPrices = bids.map(b => b[0])
    const bidQuantities = bids.map(b => b[1])
    const askPrices = asks.map(a => a[0])
    const askQuantities = asks.map(a => a[1])

    const allPrices = [...bidPrices, ...askPrices].sort((a, b) => a - b)

    if (chart) {
      chart.data.labels = allPrices
      chart.data.datasets[0].data = bidQuantities
      chart.data.datasets[1].data = askQuantities
      chart.update()
    } else {
      chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: allPrices,
          datasets: [
            {
              label: 'Bids',
              data: bidQuantities,
              backgroundColor: 'rgba(76, 175, 80, 0.8)',
              borderColor: '#4caf50',
              borderWidth: 1
            },
            {
              label: 'Asks',
              data: askQuantities,
              backgroundColor: 'rgba(244, 67, 54, 0.8)',
              borderColor: '#f44336',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top'
            },
            tooltip: {
              callbacks: {
                title: function(context) {
                  return 'Price: ' + context[0].label
                },
                label: function(context) {
                  return context.dataset.label + ': ' + context.parsed.y.toFixed(4)
                }
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Price'
              },
              ticks: {
                maxRotation: 45,
                callback: function(value) {
                  return parseFloat(value).toFixed(2)
                }
              }
            },
            y: {
              display: true,
              title: {
                display: true,
                text: 'Quantity'
              },
              beginAtZero: true
            }
          }
        }
      })
    }
  }

  function nextSnapshot() {
    if (currentIndex < snapshots.length - 1) {
      currentIndex++
      createOrUpdateChart()
    }
  }

  function prevSnapshot() {
    if (currentIndex > 0) {
      currentIndex--
      createOrUpdateChart()
    }
  }

  onMount(() => {
    createOrUpdateChart()
  })

  $: if (canvas && snapshots.length > 0) {
    createOrUpdateChart()
  }

  onDestroy(() => {
    if (chart) {
      chart.destroy()
    }
  })
</script>

<div class="chart-container">
  <div class="controls">
    <button on:click={prevSnapshot} disabled={currentIndex === 0}>Previous</button>
    <span class="progress">{currentIndex + 1} / {snapshots.length}</span>
    <button on:click={nextSnapshot} disabled={currentIndex === snapshots.length - 1}>Next</button>
  </div>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-container {
    height: 400px;
    width: 100%;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .controls button {
    padding: 0.5rem 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .controls button:hover:not(:disabled) {
    border-color: #667eea;
    background: #f5f7fa;
  }

  .controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .progress {
    color: #666;
    font-size: 0.9rem;
  }
</style>
