const os = require('os');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

class SystemCollector {
  constructor() {
    this.lastNetworkStats = null;
    this.lastDiskStats = null;
    this.platform = os.platform();
  }

  async getCpuUsage() {
    return new Promise((resolve) => {
      const start = process.hrtime();
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const elapTime = process.hrtime(start);
        const elapUsage = process.cpuUsage(startUsage);
        const elapTimeMS = elapTime[0] * 1000 + elapTime[1] / 1000000;
        const elapUserMS = elapUsage.user / 1000;
        const elapSystMS = elapUsage.system / 1000;
        const cpuPercent = (100 * (elapUserMS + elapSystMS) / elapTimeMS);
        resolve(cpuPercent);
      }, 100);
    });
  }

  async getSystemCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach((cpu) => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    return usage;
  }

  getMemoryInfo() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = (used / total) * 100;
    return {
      total,
      free,
      used,
      usage
    };
  }

  async getDiskInfo() {
    const fsSize = await si.fsSize();
    const mainDisk = fsSize.find(disk => {
      if (this.platform === 'darwin') {
        return disk.fsType === 'apfs' || disk.mount === '/';
      }
      return disk.mount === '/' || (disk.use && disk.use > 0);
    }) || fsSize[0];
    
    if (!mainDisk) {
      return { usage: 0, readRate: 0, writeRate: 0 };
    }
    
    let readRate = 0;
    let writeRate = 0;
    
    try {
      const diskStats = await si.disksIO();
      
      if (diskStats && this.lastDiskStats) {
        const timeDiff = (Date.now() - this.lastDiskStats.timestamp) / 1000;
        
        if (this.platform === 'darwin') {
          readRate = (diskStats.rx_bytes - this.lastDiskStats.stats.rx_bytes) / timeDiff;
          writeRate = (diskStats.wx_bytes - this.lastDiskStats.stats.wx_bytes) / timeDiff;
        } else {
          if (diskStats.rIO !== undefined) {
            readRate = (diskStats.rIO - this.lastDiskStats.stats.rIO) * 512 / timeDiff;
            writeRate = (diskStats.wIO - this.lastDiskStats.stats.wIO) * 512 / timeDiff;
          } else if (diskStats.rBytes !== undefined) {
            readRate = (diskStats.rBytes - this.lastDiskStats.stats.rBytes) / timeDiff;
            writeRate = (diskStats.wBytes - this.lastDiskStats.stats.wBytes) / timeDiff;
          }
        }
      }
      
      this.lastDiskStats = {
        timestamp: Date.now(),
        stats: diskStats
      };
    } catch (e) {
      console.warn('Disk IO stats not available:', e.message);
    }
    
    return {
      usage: mainDisk.use || 0,
      readRate: Math.max(0, readRate || 0),
      writeRate: Math.max(0, writeRate || 0)
    };
  }

  async getNetworkInfo() {
    const networkStats = await si.networkStats();
    const defaultInterface = networkStats[0];
    if (!defaultInterface) {
      return { rxRate: 0, txRate: 0 };
    }
    
    let rxRate = 0;
    let txRate = 0;
    
    if (this.lastNetworkStats) {
      const timeDiff = (Date.now() - this.lastNetworkStats.timestamp) / 1000;
      rxRate = (defaultInterface.rx_bytes - this.lastNetworkStats.stats.rx_bytes) / timeDiff;
      txRate = (defaultInterface.tx_bytes - this.lastNetworkStats.stats.tx_bytes) / timeDiff;
    }
    
    this.lastNetworkStats = {
      timestamp: Date.now(),
      stats: defaultInterface
    };
    
    return {
      rxRate: Math.max(0, rxRate),
      txRate: Math.max(0, txRate)
    };
  }

  async getProcessList(filterName = null) {
    const processes = await si.processes();
    let processList = processes.list
      .filter(p => p.pid > 0)
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 50)
      .map(p => ({
        name: p.name,
        pid: p.pid,
        cpuUsage: p.cpu,
        memoryUsage: p.mem,
        user: p.user || '',
        command: p.command || ''
      }));
    
    if (filterName) {
      processList = processList.filter(p => 
        p.name.toLowerCase().includes(filterName.toLowerCase())
      );
    }
    
    return processList;
  }

  async getProcessDetail(pid) {
    const processes = await si.processes();
    const process = processes.list.find(p => p.pid === pid);
    
    if (!process) {
      throw new Error('进程不存在');
    }

    return {
      name: process.name,
      pid: process.pid,
      parentPid: process.ppid,
      cpuUsage: process.cpu,
      memoryUsage: process.mem,
      memoryBytes: process.memVsz || 0,
      user: process.user || '',
      command: process.command || '',
      path: process.path || '',
      started: process.started || '',
      priority: process.priority || 0
    };
  }

  async searchProcesses(searchTerm) {
    const processes = await si.processes();
    const term = searchTerm.toLowerCase();
    
    return processes.list
      .filter(p => 
        p.pid > 0 && 
        (p.name.toLowerCase().includes(term) || 
         String(p.pid).includes(term) ||
         (p.user && p.user.toLowerCase().includes(term)))
      )
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 50)
      .map(p => ({
        name: p.name,
        pid: p.pid,
        cpuUsage: p.cpu,
        memoryUsage: p.mem,
        user: p.user || ''
      }));
  }

  async collectAll(processFilter = null) {
    const [cpuUsage, memoryInfo, diskInfo, networkInfo, processList] = await Promise.all([
      this.getSystemCpuUsage(),
      this.getMemoryInfo(),
      this.getDiskInfo(),
      this.getNetworkInfo(),
      this.getProcessList(processFilter)
    ]);

    const timestamp = Date.now();

    return {
      timestamp,
      cpuUsage,
      memoryUsage: memoryInfo.usage,
      memoryTotal: memoryInfo.total,
      memoryUsed: memoryInfo.used,
      diskUsage: diskInfo.usage,
      diskReadRate: diskInfo.readRate,
      diskWriteRate: diskInfo.writeRate,
      networkRxRate: networkInfo.rxRate,
      networkTxRate: networkInfo.txRate,
      processes: processList.map(p => ({ ...p, timestamp }))
    };
  }
}

module.exports = SystemCollector;
