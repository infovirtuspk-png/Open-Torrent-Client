const db = require('../database/db');

class BandwidthManager {
  constructor() {
    this.globalDownloadLimit = 0; // Bytes per sec (0 = unlimited)
    this.globalUploadLimit = 0;   // Bytes per sec (0 = unlimited)
    this.schedulerTimer = null;
  }

  init() {
    const dnLimit = parseInt(db.getSetting('globalDownloadLimitKB', '0'), 10);
    const upLimit = parseInt(db.getSetting('globalUploadLimitKB', '0'), 10);
    
    this.globalDownloadLimit = dnLimit > 0 ? dnLimit * 1024 : 0;
    this.globalUploadLimit = upLimit > 0 ? upLimit * 1024 : 0;

    this.startScheduler();
  }

  setGlobalLimits(downloadLimitKB, uploadLimitKB) {
    const dn = parseInt(downloadLimitKB, 10) || 0;
    const up = parseInt(uploadLimitKB, 10) || 0;

    this.globalDownloadLimit = dn > 0 ? dn * 1024 : 0;
    this.globalUploadLimit = up > 0 ? up * 1024 : 0;

    db.setSetting('globalDownloadLimitKB', String(dn));
    db.setSetting('globalUploadLimitKB', String(up));

    try {
      const engine = require('./engine');
      if (engine && typeof engine.setGlobalLimits === 'function') {
        engine.setGlobalLimits(dn, up);
      }
    } catch (_) {}
  }

  getGlobalLimits() {
    return {
      downloadLimitKB: this.globalDownloadLimit > 0 ? Math.round(this.globalDownloadLimit / 1024) : 0,
      uploadLimitKB: this.globalUploadLimit > 0 ? Math.round(this.globalUploadLimit / 1024) : 0
    };
  }

  startScheduler() {
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    
    // Check schedules every minute
    this.schedulerTimer = setInterval(() => {
      this.checkSchedules();
    }, 60000);
  }

  checkSchedules() {
    // Check if any active schedule applies for the current time
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    // Read schedules from database if any
    const stmt = db.db.prepare("SELECT * FROM schedules WHERE enabled = 1");
    while (stmt.step()) {
      const schedule = stmt.getAsObject();
      if (currentTimeStr >= schedule.start_time && currentTimeStr <= schedule.end_time) {
        this.setGlobalLimits(schedule.download_limit_kb, schedule.upload_limit_kb);
        break;
      }
    }
    stmt.free();
  }

  formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let i = 0;
    let val = bytesPerSec;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(1)} ${units[i]}`;
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(2)} ${units[i]}`;
  }

  calculateETA(remainingBytes, downloadSpeedBytesPerSec) {
    if (!downloadSpeedBytesPerSec || downloadSpeedBytesPerSec <= 0 || !remainingBytes || remainingBytes <= 0) {
      return null;
    }
    const seconds = Math.ceil(remainingBytes / downloadSpeedBytesPerSec);
    return seconds;
  }

  formatETA(seconds) {
    if (seconds === null || seconds === undefined || seconds < 0 || !isFinite(seconds)) {
      return '∞';
    }
    if (seconds === 0) return 'Done';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }
}

module.exports = new BandwidthManager();
