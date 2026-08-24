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
