const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const db = require('./db');
const path = require('path');

async function generateSystemReport(startTime, endTime, outputPath) {
  const data = db.querySystemMetrics(startTime, endTime);
  
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: 'timestamp', title: '时间戳' },
      { id: 'datetime', title: '日期时间' },
      { id: 'cpu_usage', title: 'CPU使用率(%)' },
      { id: 'memory_usage', title: '内存使用率(%)' },
      { id: 'memory_total', title: '总内存(MB)' },
      { id: 'memory_used', title: '已用内存(MB)' },
      { id: 'disk_usage', title: '磁盘使用率(%)' },
      { id: 'disk_read_rate', title: '磁盘读取速度(MB/s)' },
      { id: 'disk_write_rate', title: '磁盘写入速度(MB/s)' },
      { id: 'network_rx_rate', title: '网络下载速度(MB/s)' },
      { id: 'network_tx_rate', title: '网络上传速度(MB/s)' }
    ]
  });

  const records = data.map(row => ({
    timestamp: row.timestamp,
    datetime: new Date(row.timestamp).toLocaleString(),
    cpu_usage: row.cpu_usage.toFixed(2),
    memory_usage: row.memory_usage.toFixed(2),
    memory_total: (row.memory_total / 1024 / 1024).toFixed(2),
    memory_used: (row.memory_used / 1024 / 1024).toFixed(2),
    disk_usage: row.disk_usage.toFixed(2),
    disk_read_rate: (row.disk_read_rate / 1024 / 1024).toFixed(2),
    disk_write_rate: (row.disk_write_rate / 1024 / 1024).toFixed(2),
    network_rx_rate: (row.network_rx_rate / 1024 / 1024).toFixed(2),
    network_tx_rate: (row.network_tx_rate / 1024 / 1024).toFixed(2)
  }));

  await csvWriter.writeRecords(records);
  return { recordCount: records.length, path: outputPath };
}

async function generateProcessReport(startTime, endTime, processName, outputPath) {
  const data = db.queryProcessMetrics(startTime, endTime, processName);
  
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: 'timestamp', title: '时间戳' },
      { id: 'datetime', title: '日期时间' },
      { id: 'process_name', title: '进程名' },
      { id: 'pid', title: 'PID' },
      { id: 'cpu_usage', title: 'CPU使用率(%)' },
      { id: 'memory_usage', title: '内存使用率(%)' }
    ]
  });

  const records = data.map(row => ({
    timestamp: row.timestamp,
    datetime: new Date(row.timestamp).toLocaleString(),
    process_name: row.process_name,
    pid: row.pid,
    cpu_usage: row.cpu_usage.toFixed(2),
    memory_usage: row.memory_usage.toFixed(2)
  }));

  await csvWriter.writeRecords(records);
  return { recordCount: records.length, path: outputPath };
}

module.exports = {
  generateSystemReport,
  generateProcessReport
};
