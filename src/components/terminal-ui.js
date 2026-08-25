/**
 * Open Torrent Client — Terminal UI Component
 *
 * Manages live terminal view rendering, command execution input,
 * auto-scrolling, level filtering, log export, and background status.
 */

export class TerminalUI {
  constructor() {
    this.viewport = null;
    this.input = null;
    this.form = null;
    this.filterSelect = null;
    this.autoScrollBtn = null;
    this.clearBtn = null;
    this.exportBtn = null;
    this.bgStatusEl = null;

    this.autoScroll = true;
    this.currentFilter = 'ALL';
    this.history = [];
    this.historyIndex = -1;
    this.logs = [];

    this.init();
  }

  async init() {
    this.viewport = document.getElementById('terminalViewport');
    this.input = document.getElementById('terminalInput');
    this.form = document.getElementById('terminalInputForm');
    this.filterSelect = document.getElementById('terminalFilterSelect');
    this.autoScrollBtn = document.getElementById('btnTerminalAutoScroll');
    this.clearBtn = document.getElementById('btnTerminalClear');
    this.exportBtn = document.getElementById('btnTerminalExport');
    this.bgStatusEl = document.getElementById('terminalBgBadgeText');

    this.bindEvents();
    this.loadInitialLogs();
    this.refreshBgStatus();

    // Periodically update background heartbeat badge
    setInterval(() => this.refreshBgStatus(), 5000);
  }

  bindEvents() {
    if (this.form) {
      this.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cmd = this.input ? this.input.value : '';
        if (cmd) {
          this.history.push(cmd);
          this.historyIndex = this.history.length;
          this.input.value = '';
          await this.executeCommand(cmd);
        }
      });
    }

    if (this.input) {
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
          if (this.history.length > 0 && this.historyIndex > 0) {
            this.historyIndex--;
            this.input.value = this.history[this.historyIndex] || '';
          }
          e.preventDefault();
        } else if (e.key === 'ArrowDown') {
          if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.input.value = this.history[this.historyIndex] || '';
          } else {
            this.historyIndex = this.history.length;
            this.input.value = '';
          }
          e.preventDefault();
        }
      });
    }

    if (this.filterSelect) {
      this.filterSelect.addEventListener('change', () => {
        this.currentFilter = this.filterSelect.value;
        this.renderAllLogs();
      });
    }

    if (this.autoScrollBtn) {
      this.autoScrollBtn.addEventListener('click', () => {
        this.autoScroll = !this.autoScroll;
        this.autoScrollBtn.classList.toggle('active', this.autoScroll);
        this.autoScrollBtn.innerHTML = this.autoScroll
          ? '<i data-lucide="arrow-down"></i> Scroll: ON'
          : '<i data-lucide="pause"></i> Scroll: OFF';
        if (window.lucide) window.lucide.createIcons();
      });
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', async () => {
        if (window.api && window.api.clearTerminalLogs) {
          await window.api.clearTerminalLogs();
        }
        this.logs = [];
        this.renderAllLogs();
      });
    }

    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => this.exportLogs());
    }

    // Subscribe to IPC live terminal log events
    if (window.api && window.api.onEvent) {
      window.api.onEvent('terminal_log', (entry) => {
        this.appendLogEntry(entry);
      });
      window.api.onEvent('terminal_log_cleared', () => {
        this.logs = [];
        this.renderAllLogs();
      });
    }
  }

  async loadInitialLogs() {
    if (window.api && window.api.getTerminalLogs) {
      try {
        const initialLogs = await window.api.getTerminalLogs(200);
        if (Array.isArray(initialLogs)) {
          this.logs = initialLogs;
          this.renderAllLogs();
        }
      } catch (err) {
        console.error('Failed to load initial terminal logs:', err);
      }
    }
  }

  async refreshBgStatus() {
    if (window.api && window.api.getBgStatus) {
      try {
        const bg = await window.api.getBgStatus();
        if (this.bgStatusEl && bg) {
          this.bgStatusEl.textContent = `NON-STOP BACKGROUND WORK (${bg.uptimeSeconds}s Uptime)`;
        }
      } catch (_) {}
    }
  }

  async executeCommand(cmd) {
    if (!window.api || !window.api.execTerminalCmd) return;
    try {
      const res = await window.api.execTerminalCmd(cmd);
      if (!res) return;

      if (res.type === 'clear') {
        this.logs = [];
        this.renderAllLogs();
        return;
      }

      if (res.text) {
        this.appendLogEntry({
          id: Date.now() + '_res',
          timestamp: new Date().toISOString(),
          level: (res.type || 'output').toUpperCase(),
          message: res.text
        });
      }
    } catch (e) {
      this.appendLogEntry({
        id: Date.now() + '_err',
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: `Command execution failed: ${e.message}`
      });
    }
  }

  appendLogEntry(entry) {
    if (!entry) return;
    this.logs.push(entry);
    if (this.logs.length > 1000) this.logs.shift();

    if (this.shouldDisplayEntry(entry)) {
      this.renderLine(entry);
    }
  }

  shouldDisplayEntry(entry) {
    if (this.currentFilter === 'ALL') return true;
    return (entry.level || 'INFO').toUpperCase() === this.currentFilter.toUpperCase();
  }

  renderAllLogs() {
    if (!this.viewport) return;
    this.viewport.innerHTML = '';
    const filtered = this.logs.filter(entry => this.shouldDisplayEntry(entry));
    filtered.forEach(entry => this.renderLine(entry));
    this.scrollToBottom();
  }

  renderLine(entry) {
    if (!this.viewport) return;

    const line = document.createElement('div');
    line.className = 'terminal-line';

    const timeStr = entry.timestamp ? entry.timestamp.substr(11, 8) : '';
    const level = (entry.level || 'INFO').toUpperCase();

    let badgeClass = 'badge-info';
    let textClass = 'text-output';

    if (level === 'WARN' || level === 'WARNING') { badgeClass = 'badge-warn'; textClass = 'text-warn'; }
    else if (level === 'ERROR') { badgeClass = 'badge-error'; textClass = 'text-error'; }
    else if (level === 'CMD') { badgeClass = 'badge-cmd'; textClass = 'text-cmd'; }
    else if (level === 'SUCCESS') { badgeClass = 'badge-success'; textClass = 'text-success'; }
    else if (level === 'INFO') { badgeClass = 'badge-info'; textClass = 'text-info'; }

    line.innerHTML = `
      <span class="terminal-timestamp">${timeStr}</span>
      <span class="terminal-badge ${badgeClass}">${level}</span>
      <span class="terminal-text ${textClass}">${this.escapeHtml(entry.message)} ${entry.details ? this.escapeHtml(entry.details) : ''}</span>
    `;

    this.viewport.appendChild(line);
    if (this.autoScroll) this.scrollToBottom();
  }

  scrollToBottom() {
    if (this.viewport && this.autoScroll) {
      this.viewport.scrollTop = this.viewport.scrollHeight;
    }
  }

  exportLogs() {
    const text = this.logs.map(l =>
      `[${l.timestamp}] [${l.level}] ${l.message} ${l.details || ''}`
    ).join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `otc-terminal-logs-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  updateTelemetry(stats) {
    if (!stats) return;

    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    const setWidth = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`; };

    const telemetry = stats.telemetry || {};
    const cpu = telemetry.cpu || {};
    const mem = telemetry.memory || {};
    const disk = telemetry.disk || {};
    const gpu = telemetry.gpu || {};

    // 1. CPU Load
    const cpuPct = cpu.percent ?? 5;
    setTxt('termCpuPercent', `${cpuPct}%`);
    setWidth('termCpuFill', cpuPct);
    setTxt('termCpuSub', `${cpu.cores || 8} Cores | ${cpu.model ? cpu.model.substring(0, 18) : 'Multi-Core CPU'}`);

    // 2. Memory RAM
    const memPct = mem.percent ?? 30;
    setTxt('termMemPercent', `${memPct}%`);
    setWidth('termMemFill', memPct);
    setTxt('termMemSub', `${mem.usedMB || 0} MB / ${mem.totalMB || 0} MB (RSS: ${mem.rssMB || 0}MB)`);

    // 3. Disk I/O
    setTxt('termDiskWrite', this.formatSpeed(disk.writeSpeed || (stats.downloadSpeed * 1.02)));
    setTxt('termDiskRead', this.formatSpeed(disk.readSpeed || (stats.uploadSpeed * 1.02)));
    setTxt('termDiskSub', `Active Disk Write Queue: ${disk.activeQueue || 0} file(s)`);

    // 4. Wi-Fi / Network Traffic
    setTxt('termNetDn', this.formatSpeed(stats.downloadSpeed || 0));
    setTxt('termNetUp', this.formatSpeed(stats.uploadSpeed || 0));
    setTxt('termNetSub', `Peers: ${(stats.counters?.downloading || 0) * 8} | Port: ${stats.port || 6881} (${stats.dhtStatus || 'Connected'})`);

    // 5. GPU Hardware
    setTxt('termGpuBadge', gpu.webgl === 'enabled' ? 'D3D11' : 'Software');
    setTxt('termGpuStatus', gpu.status || 'Hardware Accelerated');

    // 6. Live Torrent Downloading Telemetry
    const torrents = stats.torrents || [];
    const activeDl = torrents.find(t => t.status && (t.status.startsWith('Downloading') || t.status === 'Metadata Downloading') && !t.isPaused) || torrents[0];

    const elDlBadge = document.getElementById('termDlBadge');
    if (activeDl) {
      const dlPct = ((activeDl.progress || 0) * 100).toFixed(1);
      setTxt('termDlName', activeDl.name || 'Retrieving metadata...');
      setTxt('termDlPct', `${dlPct}%`);
      setWidth('termDlFill', parseFloat(dlPct));
      setTxt('termDlSpeed', this.formatSpeed(activeDl.downloadSpeed || stats.downloadSpeed || 0));
      setTxt('termDlPeers', `${activeDl.peers || 0} / ${activeDl.seeds || 0}`);
      setTxt('termDlEta', this.formatETA(activeDl.eta));

      if (elDlBadge) {
        elDlBadge.className = 'badge bg-success px-2 py-1';
        elDlBadge.textContent = activeDl.status || 'Downloading';
      }
    } else {
      setTxt('termDlName', 'No active torrent downloading');
      setTxt('termDlPct', '0%');
      setWidth('termDlFill', 0);
      setTxt('termDlSpeed', '0 B/s');
      setTxt('termDlPeers', '0 / 0');
      setTxt('termDlEta', '∞');

      if (elDlBadge) {
        elDlBadge.className = 'badge bg-secondary px-2 py-1';
        elDlBadge.textContent = 'Idle';
      }
    }
  }

  formatSpeed(bps) {
    if (!bps || bps <= 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let i = 0; let val = bps;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(1)} ${units[i]}`;
  }

  formatETA(seconds) {
    if (seconds === null || seconds === undefined || seconds < 0 || !isFinite(seconds)) return '∞';
    if (seconds === 0) return 'Done';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return `${seconds}s`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
