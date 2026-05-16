const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = Recharts;

window.CpuChart = function CpuChart({ data }) {
  const chartData = React.useMemo(() => {
    return (data || []).map(item => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      cpu: item.cpuUsage.toFixed(1)
    })).slice(-30);
  }, [data]);

  return React.createElement('div', { className: 'chart-card' },
    React.createElement('div', { className: 'chart-title' }, 'CPU 使用率趋势'),
    React.createElement(ResponsiveContainer, { width: '100%', height: 200 },
      React.createElement(LineChart, { data: chartData, key: 'cpu-chart-' + (data ? data.length : 0) },
        React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#333' }),
        React.createElement(XAxis, { dataKey: 'time', stroke: '#666', fontSize: 10 }),
        React.createElement(YAxis, { domain: [0, 100], stroke: '#666', fontSize: 10 }),
        React.createElement(Tooltip, {
          contentStyle: { background: '#2a2a4e', border: '1px solid #444', borderRadius: '6px' },
          labelStyle: { color: '#eee' }
        }),
        React.createElement(Line, {
          type: 'monotone',
          dataKey: 'cpu',
          stroke: '#4ade80',
          strokeWidth: 2,
          dot: false,
          name: 'CPU %'
        })
      )
    )
  );
}

if (typeof module !== 'undefined') {
  module.exports = window.CpuChart;
}
