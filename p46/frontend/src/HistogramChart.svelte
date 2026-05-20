<script>
  import { onMount, onDestroy } from 'svelte'
  import Chart from 'chart.js/auto'

  export let data = []

  let canvas
  let chart = null

  $: if (canvas && data.length > 0) {
    updateChart()
  }

  function updateChart() {
    const labels = data.map(d => `${d[0].toFixed(1)}% - ${d[1].toFixed(1)}%`)
    const values = data.map(d => d[2])
    const colors = data.map(d => {
      const mid = (d[0] + d[1]) / 2
      return mid >= 0 ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)'
    })

    if (chart) {
      chart.data.labels = labels
      chart.data.datasets[0].data = values
      chart.data.datasets[0].backgroundColor = colors
      chart.update()
    } else {
      chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Number of Simulations',
            data: values,
            backgroundColor: colors,
            borderColor: colors.map(c => c.replace('0.8', '1')),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                title: function(context) {
                  return `Return Range: ${context[0].label}`
                },
                label: function(context) {
                  return `Simulations: ${context.parsed.y}`
                }
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Return Range (%)'
              },
              ticks: {
                maxRotation: 45,
                minRotation: 45
              }
            },
            y: {
              display: true,
              title: {
                display: true,
                text: 'Frequency'
              },
              beginAtZero: true
            }
          }
        }
      })
    }
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