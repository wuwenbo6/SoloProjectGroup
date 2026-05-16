const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } = Recharts;

window.MemoryChart = function MemoryChart({ data }) {
  const chartData = React.useMemo(() => {
    return (data || []).map(item => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      memory: item.memoryUsage.toFixed(1)
    })).slice(-30);
  }, [data]);

  return React.createElement('div', { className: 'chart-card' },
    React.createElement('div', { className: 'chart-title' }, '内存使用率趋势'),
    React.createElement(ResponsiveContainer, { width: '100%', height: 200 },
      React.createElement(LineChart, { data: chartData, key: 'mem-chart-' + (data ? data.length : 0) },
        React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#333' }),
        React.createElement(XAxis, { dataKey: 'time', stroke: '#666', fontSize: 10 }),
        React.createElement(YAxis, { domain: [0, 100], stroke: '#666', fontSize: 10 }),
        React.createElement(Tooltip, {
          contentStyle: { background: '#2a2a4e', border: '1px solid #444', borderRadius: '6px' },
          labelStyle: { color: '#eee' }
        }),
        React.createElement(Line, {
          type: 'monotone',
          dataKey: 'memory',
          stroke: '#60a5fa',
          strokeWidth: 2,
          dot: false,
          name: '内存 %'
        })
      )
    )
  );
}

window.DiskChart = function DiskChart({ data }) {
  const chartData = React.useMemo(() => {
    return (data || []).map(item => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      read: (item.diskReadRate / 1024 / 1024).toFixed(2),
      write: (item.diskWriteRate / 1024 / 1024).toFixed(2)
    })).slice(-30);
  }, [data]);

  return React.createElement('div', { className: 'chart-card' },
    React.createElement('div', { className: 'chart-title' }, '磁盘读写速度 (MB/s)'),
    React.createElement(ResponsiveContainer, { width: '100%', height: 200 },
      React.createElement(LineChart, { data: chartData, key: 'disk-chart-' + (data ? data.length : 0) },
        React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#333' }),
        React.createElement(XAxis, { dataKey: 'time', stroke: '#666', fontSize: 10 }),
        React.createElement(YAxis, { stroke: '#666', fontSize: 10 }),
        React.createElement(Tooltip, {
          contentStyle: { background: '#2a2a4e', border: '1px solid #444', borderRadius: '6px' },
          labelStyle: { color: '#eee' }
        }),
        React.createElement(Legend, null),
        React.createElement(Line, { type: 'monotone', dataKey: 'read', stroke: '#f472b6', strokeWidth: 2, dot: false, name: '读取' }),
        React.createElement(Line, { type: 'monotone', dataKey: 'write', stroke: '#a78bfa', strokeWidth: 2, dot: false, name: '写入' })
      )
    )
  );
}

window.NetworkChart = function NetworkChart({ data }) {
  const chartData = React.useMemo(() => {
    return (data || []).map(item => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      download: (item.networkRxRate / 1024 / 1024).toFixed(2),
      upload: (item.networkTxRate / 1024 / 1024).toFixed(2)
    })).slice(-30);
  }, [data]);

  return React.createElement('div', { className: 'chart-card' },
    React.createElement('div', { className: 'chart-title' }, '网络传输速度 (MB/s)'),
    React.createElement(ResponsiveContainer, { width: '100%', height: 200 },
      React.createElement(LineChart, { data: chartData, key: 'net-chart-' + (data ? data.length : 0) },
        React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#333' }),
        React.createElement(XAxis, { dataKey: 'time', stroke: '#666', fontSize: 10 }),
        React.createElement(YAxis, { stroke: '#666', fontSize: 10 }),
        React.createElement(Tooltip, {
          contentStyle: { background: '#2a2a4e', border: '1px solid #444', borderRadius: '6px' },
          labelStyle: { color: '#eee' }
        }),
        React.createElement(Legend, null),
        React.createElement(Line, { type: 'monotone', dataKey: 'download', stroke: '#34d399', strokeWidth: 2, dot: false, name: '下载' }),
        React.createElement(Line, { type: 'monotone', dataKey: 'upload', stroke: '#fbbf24', strokeWidth: 2, dot: false, name: '上传' })
      )
    )
  );
}

if (typeof module !== 'undefined') {
  module.exports = { MemoryChart: window.MemoryChart, DiskChart: window.DiskChart, NetworkChart: window.NetworkChart };
}
