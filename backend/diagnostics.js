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
}

module.exports = new DiagnosticsService();
