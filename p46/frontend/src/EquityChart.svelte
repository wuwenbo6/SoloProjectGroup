<script>
  import { onMount, onDestroy } from 'svelte'
  import Chart from 'chart.js/auto'

  export let data = []

  let canvas
  let chart = null

  function createOrUpdateChart() {
    if (!canvas) return

    const labels = data.map(([ts]) => new Date(ts).toLocaleString())
    const values = data.map(([, val]) => val)

    if (chart) {
      chart.data.labels = labels
      chart.data.datasets[0].data = values
      chart.update()
    } else {
      chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Equity',
            data: values,
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(context.parsed.y)
                }
              }
            }
          },
          scales: {
            x: {
              display: true,
              grid: {
                display: false
              },
              ticks: {
                maxTicksLimit: 8,
                maxRotation: 45
              }
            },
            y: {
              display: true,
              grid: {
                color: '#f0f0f0'
              },
              ticks: {
                callback: function(value) {
                  return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    notation: 'compact'
                  }).format(value)
                }
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
