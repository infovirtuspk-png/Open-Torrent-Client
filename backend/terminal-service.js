/**
 * Open Torrent Client — Terminal & Background Process Service
 *
 * Manages real-time log streaming, background execution status,
 * power save blocker management, and CLI sub-commands.
 */

const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const torrentManager = require('./torrent-manager');
const bwManager = require('./bandwidth-manager');
const diagnostics = require('./diagnostics');
const db = require('../database/db');

class TerminalService {
  constructor() {
    this.ipcBroadcast = null;
    this.commandHistory = [];
    this.terminalLogs = [];
    this.maxLogs = 1000;
    this.powerSaveBlockerId = null;
    this.powerSaveBlockerModule = null;
    this.powerSaveEnabled = true;
    this.startTime = Date.now();
  }

  init(ipcBroadcastFn, powerSaveModule = null) {
    this.ipcBroadcast = ipcBroadcastFn;
    this.powerSaveBlockerModule = powerSaveModule;

    // Enable power save blocker by default if available
    this.setPowerSaveState(true);

    this.log('INFO', 'Integrated Background Terminal Service initialized.');
    this.log('INFO', 'Background execution mode: Active (Non-stop background work enabled).');
  }

  setPowerSaveState(enable) {
    if (!this.powerSaveBlockerModule) {
      this.powerSaveEnabled = enable;
      return;
    }

    try {
      if (enable && this.powerSaveBlockerId === null) {
        this.powerSaveBlockerId = this.powerSaveBlockerModule.start('prevent-app-suspension');
        this.powerSaveEnabled = true;
        this.log('INFO', `[PowerSaveBlocker] App suspension prevention active (ID: ${this.powerSaveBlockerId}).`);
      } else if (!enable && this.powerSaveBlockerId !== null) {
        this.powerSaveBlockerModule.stop(this.powerSaveBlockerId);
        this.powerSaveBlockerId = null;
        this.powerSaveEnabled = false;
        this.log('INFO', '[PowerSaveBlocker] App suspension prevention disabled.');
      }
    } catch (err) {
      this.log('WARN', '[PowerSaveBlocker] Failed to update power save state:', err.message);
    }
  }

  getBgStatus() {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      status: 'RUNNING_NON_STOP',
      powerSavePreventSuspension: this.powerSaveEnabled,
      powerSaveBlockerId: this.powerSaveBlockerId,
      uptimeSeconds: uptimeSec,
      activeTorrents: torrentManager.getAllTorrents().length,
      downloadingCount: torrentManager.getCounters().downloading,
      memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      nodeVersion: process.version,
      platform: os.platform()
    };
  }

  log(level, message, details = null) {
    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      level: level ? level.toUpperCase() : 'INFO',
      message: message || '',
      details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null
    };

    this.terminalLogs.push(entry);
    if (this.terminalLogs.length > this.maxLogs) {
      this.terminalLogs.shift();
    }

    if (this.ipcBroadcast) {
      try {
        this.ipcBroadcast('terminal_log', entry);
      } catch (_) {}
    }

    return entry;
  }

  getLogs(limit = 200) {
    return this.terminalLogs.slice(-limit);
  }

  clearLogs() {
    this.terminalLogs = [];
    if (this.ipcBroadcast) {
      try {
        this.ipcBroadcast('terminal_log_cleared', true);
      } catch (_) {}
    }
    return { success: true };
  }

  async executeCommand(rawCommand) {
    if (!rawCommand || typeof rawCommand !== 'string') {
      return { type: 'error', text: 'Empty command string provided.' };
    }

    const trimmed = rawCommand.trim();
    if (!trimmed) return { type: 'output', text: '' };

    this.commandHistory.push(trimmed);
    this.log('CMD', `otc-cli> ${trimmed}`);

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        return this._cmdHelp();

      case 'status':
      case 'stats':
        return this._cmdStatus();

      case 'list':
      case 'ls':
        return this._cmdList();

      case 'add':
        return this._cmdAdd(args);

      case 'pause':
        return this._cmdPause(args);

      case 'resume':
        return this._cmdResume(args);

      case 'stop':
        return this._cmdStop(args);

      case 'remove':
      case 'rm':
        return this._cmdRemove(args);

      case 'diag':
      case 'diagnostics':
        return this._cmdDiag();

      case 'logs':
        return this._cmdLogs(args);

      case 'bg':
      case 'background':
        return this._cmdBg(args);

      case 'clear':
      case 'cls':
        return { type: 'clear', text: '' };

      case 'ping':
        return { type: 'success', text: `PONG! Background worker active. Uptime: ${Math.floor((Date.now() - this.startTime) / 1000)}s` };

      case 'net':
      case 'network':
        return this._cmdNetwork();

      case 'trackers':
        return this._cmdTrackers(args);

      case 'webseeds':
        return this._cmdWebSeeds(args);

      case 'exec':
      case 'sh':
      case 'bash':
      case 'cmd':
        return await this._cmdExec(args.join(' '));

      default:
        // Direct command fallback — if unknown, suggest help or try exec
        return {
          type: 'warning',
          text: `Unknown command '${cmd}'. Type 'help' for command list or 'exec ${trimmed}' to run system shell command.`
        };
    }
  }

  _cmdHelp() {
    const text = [
      '╔══════════════════════════════════════════════════════════════════════════╗',
      '║            OPEN TORRENT CLIENT — INTERACTIVE CLI TERMINAL               ║',
      '╚══════════════════════════════════════════════════════════════════════════╝',
      '',
      'AVAILABLE COMMANDS:',
      '  help                      Show this help manual',
      '  status | stats            Show engine status, speeds, DHT & background health',
      '  list | ls                 List all torrents and download progress',
      '  add <magnet|path>         Add torrent file path or magnet link',
      '  pause <hash|all>          Pause specific torrent or all torrents',
      '  resume <hash|all>         Resume specific torrent or all torrents',
      '  stop <hash|all>           Stop active torrent(s)',
      '  remove <hash>             Remove torrent from engine',
      '  diag                      Print complete system & memory diagnostic report',
      '  net | network             Show active network interfaces, listening port & speed limits',
      '  trackers [add <h> <url>]  View or add custom tracker URL to active torrent',
      '  webseeds [add <h> <url>]  View or add custom WebSeed HTTP mirror to active torrent',
      '  logs [--clear]            View live diagnostic log stream or clear buffer',
      '  bg [enable|disable]       Check or toggle background non-stop power save mode',
      '  exec <shell_cmd>          Run native OS terminal command (dir, ping, git, etc.)',
      '  clear | cls               Clear terminal viewport output',
      '  ping                      Check background process responsiveness',
      '',
      'BACKGROUND FEATURE:',
      '  The OTC background worker runs non-stop even when application window is minimized',
      '  or hidden to the system tray. Use shortcut Ctrl + ~ to toggle terminal anytime.'
    ].join('\n');
    return { type: 'output', text };
  }

  _cmdStatus() {
    const bg = this.getBgStatus();
    const counters = torrentManager.getCounters();
    const torrents = torrentManager.getAllTorrents();

    let totalDnSpeed = 0;
    let totalUpSpeed = 0;
    for (const t of torrents) {
      totalDnSpeed += t.downloadSpeed || 0;
      totalUpSpeed += t.uploadSpeed || 0;
    }

    const dnStr = bwManager.formatSpeed(totalDnSpeed);
    const upStr = bwManager.formatSpeed(totalUpSpeed);

    const text = [
      '=== ENGINE & BACKGROUND STATUS ===',
      `Background Mode : ${bg.status} (Non-stop)`,
      `Power Save Block: ${bg.powerSavePreventSuspension ? 'ACTIVE (App suspension prevented)' : 'DISABLED'}`,
      `System Uptime   : ${bg.uptimeSeconds} seconds`,
      `Memory (RSS)    : ${bg.memoryUsageMB} MB`,
      `Node Version    : ${bg.nodeVersion} (${bg.platform})`,
      `Total Torrents  : ${torrents.length}`,
      `Downloading     : ${counters.downloading} (Speed: ↓ ${dnStr})`,
      `Seeding         : ${counters.seeding} (Speed: ↑ ${upStr})`,
      `Paused          : ${counters.paused}`,
      `Completed       : ${counters.completed}`,
      `Errors          : ${counters.error}`
    ].join('\n');

    return { type: 'info', text };
  }

  _cmdList() {
    const torrents = torrentManager.getAllTorrents();
    if (torrents.length === 0) {
      return { type: 'info', text: 'No torrents in current queue.' };
    }

    const lines = ['=== ACTIVE TORRENT QUEUE ==='];
    torrents.forEach((t, i) => {
      const pct = (t.progress * 100).toFixed(1);
      const dn = bwManager.formatSpeed(t.downloadSpeed || 0);
      const up = bwManager.formatSpeed(t.uploadSpeed || 0);
      const hashShort = t.infoHash ? t.infoHash.substr(0, 8) : 'N/A';
      lines.push(
        `[${i + 1}] ${t.name || 'Unnamed'} (${hashShort})\n    Status: ${t.status} | Progress: ${pct}% | ↓ ${dn} | ↑ ${up} | Peers: ${t.peers || 0}`
      );
    });

    return { type: 'output', text: lines.join('\n') };
  }

  _cmdAdd(args) {
    if (args.length === 0) {
      return { type: 'error', text: 'Usage: add <magnet_url_or_file_path>' };
    }

    const source = args.join(' ');
    const engine = require('./engine');
    const defPath = db.getSetting('defaultDownloadPath', path.join(os.homedir(), 'Downloads'));

    try {
      const hash = engine.addTorrentOrMagnet(source, defPath);
      this.log('INFO', `Torrent added via Terminal CLI: ${hash}`);
      return { type: 'success', text: `✓ Torrent added successfully! InfoHash: ${hash}` };
    } catch (e) {
      return { type: 'error', text: `Failed to add torrent: ${e.message}` };
    }
  }

  _cmdPause(args) {
    if (args.length === 0) return { type: 'error', text: 'Usage: pause <infoHash|all>' };
    const target = args[0].toLowerCase();
    if (target === 'all') {
      torrentManager.pauseAll();
      return { type: 'success', text: '✓ All active torrents paused.' };
    } else {
      torrentManager.pauseTorrent(target);
      return { type: 'success', text: `✓ Torrent ${target} paused.` };
    }
  }

  _cmdResume(args) {
    if (args.length === 0) return { type: 'error', text: 'Usage: resume <infoHash|all>' };
    const target = args[0].toLowerCase();
    if (target === 'all') {
      torrentManager.resumeAll();
      return { type: 'success', text: '✓ All paused torrents resumed.' };
    } else {
      torrentManager.resumeTorrent(target);
      return { type: 'success', text: `✓ Torrent ${target} resumed.` };
    }
  }

  _cmdStop(args) {
    if (args.length === 0) return { type: 'error', text: 'Usage: stop <infoHash|all>' };
    const target = args[0].toLowerCase();
    if (target === 'all') {
      for (const hash of torrentManager.torrents.keys()) {
        torrentManager.stopTorrent(hash);
      }
      return { type: 'success', text: '✓ All torrents stopped.' };
    } else {
      torrentManager.stopTorrent(target);
      return { type: 'success', text: `✓ Torrent ${target} stopped.` };
    }
  }

  _cmdRemove(args) {
    if (args.length === 0) return { type: 'error', text: 'Usage: remove <infoHash> [--delete-files]' };
    const hash = args[0].toLowerCase();
    const deleteFiles = args.includes('--delete-files') || args.includes('-d');

    torrentManager.removeTorrent(hash, deleteFiles);
    return { type: 'success', text: `✓ Torrent ${hash} removed ${deleteFiles ? '(files deleted from disk)' : ''}.` };
  }

  _cmdDiag() {
    const diagData = diagnostics.getSystemDiagnostics();
    const lines = [
      '=== SYSTEM DIAGNOSTICS REPORT ===',
      `App Name       : ${diagData.appName} v${diagData.appVersion}`,
      `OS Platform    : ${diagData.osPlatform} ${diagData.osRelease} (${diagData.osArch})`,
      `CPU Model      : ${diagData.cpuModel} (${diagData.cpuCores} cores)`,
      `Total Memory   : ${diagData.totalMemoryMB} MB`,
      `Free Memory    : ${diagData.freeMemoryMB} MB`,
      `Used Memory    : ${diagData.usedMemoryMB} MB`,
      `Process Memory : ${diagData.processMemoryMB} MB`,
      `Node Version   : ${diagData.nodeVersion}`,
      `Electron Vers. : ${diagData.electronVersion}`,
      `Log Entries    : ${diagData.logCount}`
    ];
    return { type: 'info', text: lines.join('\n') };
  }

  _cmdLogs(args) {
    if (args.includes('--clear')) {
      this.clearLogs();
      diagnostics.clearLogs();
      return { type: 'success', text: '✓ Log buffers cleared.' };
    }

    const recent = this.terminalLogs.slice(-30);
    if (recent.length === 0) {
      return { type: 'info', text: 'Log buffer is empty.' };
    }

    const lines = recent.map(l => `[${l.timestamp.substr(11, 8)}] [${l.level}] ${l.message} ${l.details || ''}`);
    return { type: 'output', text: lines.join('\n') };
  }

  _cmdBg(args) {
    if (args.includes('enable') || args.includes('on')) {
      this.setPowerSaveState(true);
      return { type: 'success', text: '✓ Power save blocker enabled. Background process will work non-stop.' };
    } else if (args.includes('disable') || args.includes('off')) {
      this.setPowerSaveState(false);
      return { type: 'warning', text: '⚠ Power save blocker disabled.' };
    }

    const status = this.getBgStatus();
    return {
      type: 'info',
      text: `Background Status: ${status.status}\nPower Save Suspension Prevention: ${status.powerSavePreventSuspension ? 'Active' : 'Disabled'}\nUse 'bg enable' or 'bg disable' to toggle.`
    };
  }

  _cmdNetwork() {
    const netDiag = diagnostics.getNetworkDiagnostics();
    const lines = [
      '=== NETWORK & CONNECTIVITY DIAGNOSTICS ===',
      `Hostname        : ${netDiag.hostname}`,
      `Listening Port  : ${netDiag.listeningPort} (BitTorrent TCP/UDP)`,
      `DHT Network     : ${netDiag.dhtStatus}`,
      `Download Limit  : ${netDiag.downloadLimitKB > 0 ? netDiag.downloadLimitKB + ' KB/s' : 'Unlimited'}`,
      `Upload Limit    : ${netDiag.uploadLimitKB > 0 ? netDiag.uploadLimitKB + ' KB/s' : 'Unlimited'}`,
      'Active Network Interfaces:'
    ];

    for (const item of netDiag.activeNetworkInterfaces) {
      lines.push(`  - Interface: ${item.interface} | IP: ${item.ip} | Netmask: ${item.netmask}`);
    }

    return { type: 'info', text: lines.join('\n') };
  }

  _cmdTrackers(args) {
    const engine = require('./engine');
    if (args[0] === 'add' && args.length >= 3) {
      const hash = args[1];
      const url = args.slice(2).join(' ');
      const res = engine.addTracker(hash, url);
      return res.success
        ? { type: 'success', text: `✓ Added tracker ${url} to torrent ${hash}` }
        : { type: 'error', text: `Failed to add tracker: ${res.error}` };
    }

    if (args.length === 0) return { type: 'error', text: 'Usage: trackers [add <infoHash> <tracker_url>] or trackers <infoHash>' };

    const hash = args[0];
    const details = engine.getTorrentDetails(hash);
    if (!details) return { type: 'error', text: `Torrent ${hash} not found.` };

    const trackerList = details.trackers || [];
    const lines = [`=== TRACKERS FOR TORRENT (${hash}) ===`];
    trackerList.forEach((tr, i) => lines.push(`[${i + 1}] ${tr.url} (Status: ${tr.status || 'Working'})`));
    return { type: 'output', text: lines.join('\n') };
  }

  _cmdWebSeeds(args) {
    const engine = require('./engine');
    if (args[0] === 'add' && args.length >= 3) {
      const hash = args[1];
      const url = args.slice(2).join(' ');
      const res = engine.addWebSeed(hash, url);
      return res.success
        ? { type: 'success', text: `✓ Added WebSeed mirror ${url} to torrent ${hash}` }
        : { type: 'error', text: `Failed to add WebSeed: ${res.error}` };
    }

    return { type: 'info', text: 'Usage: webseeds add <infoHash> <http_webseed_url>' };
  }

  _cmdExec(shellCmd) {
    if (!shellCmd) {
      return Promise.resolve({ type: 'error', text: 'Usage: exec <system_command_line>' });
    }

    return new Promise((resolve) => {
      this.log('INFO', `Running shell command: ${shellCmd}`);
      exec(shellCmd, { timeout: 30000 }, (error, stdout, stderr) => {
        let outputText = '';
        if (stdout) outputText += stdout;
        if (stderr) outputText += (outputText ? '\n[STDERR]\n' : '') + stderr;

        if (error) {
          outputText += `\n[Exit Error: ${error.message}]`;
          resolve({ type: 'error', text: outputText.trim() });
        } else {
          resolve({ type: 'output', text: outputText.trim() || 'Command completed with no output.' });
        }
      });
    });
  }
}

module.exports = new TerminalService();
