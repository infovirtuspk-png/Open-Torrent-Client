const fs = require('fs');
const path = require('path');
const os = require('os');

class DiagnosticsService {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.logFilePath = null;
  }

  init(userDataPath) {
    this.logFilePath = path.join(userDataPath, 'app.log');
    this.log('INFO', 'System Diagnostics initialized.');
  }

  log(level, message, details = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      details: details ? JSON.stringify(details) : null
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    const formattedLog = `[${entry.timestamp}] [${entry.level}] ${message} ${entry.details ? entry.details : ''}\n`;
    console.log(formattedLog.trim());

    try {
      const termService = require('./terminal-service');
      if (termService && typeof termService.log === 'function') {
        termService.log(level, message, details);
      }
    } catch (_) {}

    if (this.logFilePath) {
      fs.appendFile(this.logFilePath, formattedLog, (err) => {
        if (err) console.error('Failed to write to app.log', err);
      });
    }
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    if (this.logFilePath && fs.existsSync(this.logFilePath)) {
      try {
        fs.writeFileSync(this.logFilePath, '');
      } catch (e) {}
    }
  }

  getSystemDiagnostics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpus = os.cpus();

    return {
      appName: 'Open Torrent Client',
      appVersion: '1.0.0',
      osPlatform: os.platform(),
      osRelease: os.release(),
      osArch: os.arch(),
      totalMemoryMB: Math.round(totalMem / (1024 * 1024)),
      freeMemoryMB: Math.round(freeMem / (1024 * 1024)),
      usedMemoryMB: Math.round((totalMem - freeMem) / (1024 * 1024)),
      cpuModel: cpus.length > 0 ? cpus[0].model : 'Unknown',
      cpuCores: cpus.length,
      nodeVersion: process.version,
      electronVersion: process.versions.electron || 'N/A',
      processMemoryMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      logCount: this.logs.length
    };
  }

  getNetworkDiagnostics() {
    const interfaces = os.networkInterfaces();
    const netDetails = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
      for (const a of addrs || []) {
        if (!a.internal && a.family === 'IPv4') {
          netDetails.push({ interface: name, ip: a.address, netmask: a.netmask, mac: a.mac });
        }
      }
    }

    const engine = require('./engine');
    const bwMgr = require('./bandwidth-manager');
    const limits = bwMgr.getGlobalLimits();

    return {
      timestamp: new Date().toISOString(),
      listeningPort: engine.listeningPort || 6881,
      dhtStatus: engine.dhtStatus || 'Connected',
      downloadLimitKB: limits.downloadLimitKB,
      uploadLimitKB: limits.uploadLimitKB,
      activeNetworkInterfaces: netDetails,
      hostname: os.hostname()
    };
  }

  exportDiagnosticReport(savePath) {
    const diag = this.getSystemDiagnostics();
    const report = {
      generatedAt: new Date().toISOString(),
      systemInfo: diag,
      recentLogs: this.logs
    };

    fs.writeFileSync(savePath, JSON.stringify(report, null, 2));
    this.log('INFO', `Diagnostic report exported to ${savePath}`);
    return savePath;
  }

  getRealtimeCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const core of cpus) {
      for (const type in core.times) {
        totalTick += core.times[type];
      }
      totalIdle += core.times.idle;
    }

    if (!this._lastCpuTimes) {
      this._lastCpuTimes = { totalIdle, totalTick };
      return { percent: 5, cores: cpus.length, model: cpus[0]?.model || 'CPU' };
    }

    const idleDifference = totalIdle - this._lastCpuTimes.totalIdle;
    const totalDifference = totalTick - this._lastCpuTimes.totalTick;
    this._lastCpuTimes = { totalIdle, totalTick };

    const percentage = totalDifference > 0
      ? Math.max(0, Math.min(100, Math.round(100 - (100 * idleDifference / totalDifference))))
      : 5;

    return {
      percent: percentage,
      cores: cpus.length,
      model: cpus[0]?.model || 'CPU'
    };
  }

  getRealtimeMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const rss = process.memoryUsage().rss;
    const percent = Math.round((usedMem / totalMem) * 100);

    return {
      totalMB: Math.round(totalMem / (1024 * 1024)),
      freeMB: Math.round(freeMem / (1024 * 1024)),
      usedMB: Math.round(usedMem / (1024 * 1024)),
      rssMB: Math.round(rss / (1024 * 1024)),
      percent
    };
  }

  getGpuStatus() {
    try {
      const { app } = require('electron');
      if (app && typeof app.getGPUFeatureStatus === 'function') {
        const featureStatus = app.getGPUFeatureStatus();
        const isAccel = featureStatus.gpu_compositing === 'enabled' || featureStatus.webgl === 'enabled';
        return {
          status: isAccel ? 'Hardware Accelerated' : 'Software Fallback',
          compositing: featureStatus.gpu_compositing || 'enabled',
          webgl: featureStatus.webgl || 'enabled'
        };
      }
    } catch (_) {}
    return { status: 'Hardware Accelerated (D3D11)', compositing: 'enabled', webgl: 'enabled' };
  }
}

module.exports = new DiagnosticsService();
