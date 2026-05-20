<script>
  import { onMount, onDestroy } from 'svelte'
  import Chart from 'chart.js/auto'

  export let trades = []

  let canvas
  let chart = null

  function createOrUpdateChart() {
    if (!canvas) return

    const buyTrades = trades.filter(t => t.side === 'Buy' || !t.side)
    const sellTrades = trades.filter(t => t.side === 'Sell')

    const buyData = buyTrades.map(t => ({
      x: new Date(t.timestamp).getTime(),
      y: t.price,
      r: Math.sqrt(t.quantity) * 2
    }))

    const sellData = sellTrades.map(t => ({
      x: new Date(t.timestamp).getTime(),
      y: t.price,
      r: Math.sqrt(t.quantity) * 2
    }))

    if (chart) {
      chart.data.datasets[0].data = buyData
      chart.data.datasets[1].data = sellData
      chart.update()
    } else {
      chart = new Chart(canvas, {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Buy Trades',
              data: buyData,
              backgroundColor: 'rgba(76, 175, 80, 0.6)',
              borderColor: '#4caf50',
              borderWidth: 1
            },
            {
              label: 'Sell Trades',
              data: sellData,
              backgroundColor: 'rgba(244, 67, 54, 0.6)',
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
                  return new Date(context[0].parsed.x).toLocaleString()
                },
                label: function(context) {
                  const point = context.raw
                  return [
                    'Price: ' + point.y.toFixed(2),
                    'Quantity: ' + (point.r * point.r / 4).toFixed(4)
                  ]
                }
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Time'
              },
              ticks: {
                maxTicksLimit: 8,
                maxRotation: 45,
                callback: function(value) {
                  return new Date(value).toLocaleTimeString()
                }
              }
            },
            y: {
              display: true,
              title: {
                display: true,
                text: 'Price'
              }
            }
          }
        }
      })
    }
  }

  onMount(() => {
    createOrUpdateChart()
  })

  $: if (canvas) {
    createOrUpdateChart()
  }

  onDestroy(() => {
    if (chart) {
      chart.destroy()
    }
  })
</script>

<div class="chart-container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-container {
    height: 400px;
    width: 100%;
  }
</style>
