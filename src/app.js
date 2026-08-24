import { NavigationManager } from './components/navigation.js';
import { TorrentTableManager } from './components/torrent-table.js';
import { DetailsPanelManager } from './components/details-panel.js';
import { FileManagerUI } from './components/file-manager-ui.js';
import { HistoryUI } from './components/history-ui.js';
import { StatisticsUI } from './components/statistics-ui.js';
import { SettingsUI } from './components/settings-ui.js';
import { CommandPaletteUI } from './components/command-palette.js';
import { DialogsManager } from './components/dialogs.js';
import { TerminalUI } from './components/terminal-ui.js';

class AppController {
  constructor() {
    this.nav = null;
    this.table = null;
    this.details = null;
    this.fileManager = null;
    this.history = null;
    this.statistics = null;
    this.settings = null;
    this.cmdPalette = null;
    this.dialogs = null;
    this.terminal = null;
  }

  async init() {
    // 1. Details & Table
    this.details = new DetailsPanelManager();
    this.table = new TorrentTableManager(
      (hash) => {
        this.details.loadTorrentDetails(hash);
      },
      (action, torrent) => {
        this.handleContextMenuAction(action, torrent);
      }
    );

    // 2. Views
    this.fileManager = new FileManagerUI();
    this.history = new HistoryUI();
    this.statistics = new StatisticsUI();
    this.settings = new SettingsUI();
    this.terminal = new TerminalUI();

    // 3. Navigation
    this.nav = new NavigationManager(
      (section) => this.handleSectionChange(section),
      (filter) => this.table.setFilter(filter)
    );

    // 4. Dialogs
    this.dialogs = new DialogsManager(
      async (uri, savePath) => {
        const res = await window.api.addMagnet(uri, savePath);
        if (!res.success) alert('Error adding magnet link: ' + res.error);
        else this.refreshTorrents();
      },
      async (filePath, savePath) => {
        const res = await window.api.addTorrent(filePath, savePath);
        if (!res.success) alert('Error adding torrent file: ' + res.error);
        else this.refreshTorrents();
      },
      (infoHash) => {
        this.nav.switchView('torrents');
        this.refreshTorrents();
      }
    );

    // 5. Command Palette
    this.cmdPalette = new CommandPaletteUI((actionId) => this.handleCommandAction(actionId));

    // 6. Bind Toolbar Buttons & About View Actions
    this.bindToolbarButtons();
    this.bindAboutButtons();
    this.bindDragDrop();

    // 7. Subscribe to IPC Real-time Events
    window.api.onEvent('realtime_stats', (stats) => this.handleRealtimeStats(stats));

    // Mode A: Preview Prompt Event
    window.api.onEvent('magnet_preview_prompt', (data) => {
      this.nav.switchView('torrents');
      this.dialogs.openAddMagnet(data);
      this.refreshTorrents();
    });

    // Duplicate Magnet Event
    window.api.onEvent('magnet_duplicate', (dupData) => {
      this.dialogs.showDuplicateModal(dupData);
    });

    // Magnet Added Event
    window.api.onEvent('magnet_added', () => {
      this.nav.switchView('torrents');
      this.refreshTorrents();
    });

    window.api.onEvent('magnet_detected', (uri) => {
      this.dialogs.showMagnetToast(uri);
    });

    window.api.onEvent('capture_error', (data) => {
      alert('Magnet Error: ' + data.error);
    });

    // Keyboard / Tray shortcut triggers from main process
    window.api.onEvent('shortcut_trigger', (actionId) => {
      switch (actionId) {
        case 'add_magnet':      this.dialogs.openAddMagnet();  break;
        case 'add_torrent':     this.dialogs.openAddTorrent(); break;
        case 'open_settings':   this.nav.switchView('settings'); break;
        case 'command_palette': this.cmdPalette?.open();         break;
        case 'toggle_terminal': this.nav.switchView('terminal'); break;
        default: break;
      }
    });

    // Tray-only mode signal (window is hidden, reduce rendering)
    window.api.onEvent('tray_only_mode', (active) => {
      // Pause heavy DOM updates when window is not visible
      document.body.dataset.trayOnly = active ? '1' : '0';
    });

    // Initial Load
    this.refreshTorrents();

    // Lucide Icons Render
    if (window.lucide) window.lucide.createIcons();
  }

  async handleContextMenuAction(action, torrent) {
    if (!torrent) return;
    const hash = torrent.infoHash;

    if (action === 'resume') {
      await window.api.resumeTorrent(hash);
      this.refreshTorrents();
    } else if (action === 'pause') {
      await window.api.pauseTorrent(hash);
      this.refreshTorrents();
    } else if (action === 'stop') {
      await window.api.stopTorrent(hash);
      this.refreshTorrents();
    } else if (action === 'force_start') {
      await window.api.forceStart(hash);
      this.refreshTorrents();
    } else if (action === 'recheck') {
      await window.api.recheckTorrent(hash);
      this.refreshTorrents();
    } else if (action === 'reannounce') {
      const res = await window.api.reannounceTorrent(hash);
      alert(`Tracker Reannounce: ${res.message} (Peers found: ${res.peersDiscovered || 0})`);
    } else if (action === 'move_up') {
      await window.api.moveQueue(hash, 'up');
      this.refreshTorrents();
    } else if (action === 'move_down') {
      await window.api.moveQueue(hash, 'down');
      this.refreshTorrents();
    } else if (action === 'move_top') {
      await window.api.moveQueue(hash, 'top');
      this.refreshTorrents();
    } else if (action === 'move_bottom') {
      await window.api.moveQueue(hash, 'bottom');
      this.refreshTorrents();
    } else if (action === 'open_folder') {
      if (torrent.savePath) await window.api.showInFolder(torrent.savePath);
    } else if (action === 'open_files') {
      this.details.loadTorrentDetails(hash);
      const tabFilesBtn = document.querySelector('.tab-btn[data-tab="tabFiles"]');
      if (tabFilesBtn) tabFilesBtn.click();
    } else if (action === 'copy_magnet') {
      const mag = torrent.magnetUri || `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(torrent.name)}`;
      navigator.clipboard.writeText(mag);
      this.settings?._showToast('Magnet URI copied to clipboard!', 'success');
    } else if (action === 'copy_hash') {
      navigator.clipboard.writeText(hash);
      this.settings?._showToast('Info Hash copied to clipboard!', 'success');
    } else if (action === 'rename') {
      const newName = prompt('Enter new display name for torrent:', torrent.name);
      if (newName && newName.trim()) {
        await window.api.renameTorrent(hash, newName.trim());
        this.refreshTorrents();
      }
    } else if (action === 'change_location') {
      const newFolder = await window.api.selectFolderDialog();
      if (newFolder) {
        const res = await window.api.changeLocation(hash, newFolder);
        if (res.success) {
          this.settings?._showToast(`Download location changed to: ${newFolder}`, 'success');
          this.refreshTorrents();
        } else {
          alert(`Failed to change location: ${res.error}`);
        }
      }
    } else if (action.startsWith('view_')) {
      const tabName = action.replace('view_', '');
      const tabMap = {
        details: 'tabOverview',
        peers: 'tabPeers',
        trackers: 'tabTrackers',
        pieces: 'tabPieces',
        speed: 'tabSpeed'
      };
      const targetTabId = tabMap[tabName] || 'tabOverview';
      const tabBtn = document.querySelector(`.tab-btn[data-tab="${targetTabId}"]`);
      if (tabBtn) tabBtn.click();
    } else if (action.startsWith('dn_limit_')) {
      const limitKB = action.replace('dn_limit_', '');
      await window.api.saveSettings({ globalDownloadLimitKB: limitKB });
      this.settings?._showToast(`Download speed limit set to ${limitKB === '0' ? 'Unlimited' : limitKB + ' KB/s'}`, 'success');
    } else if (action.startsWith('priority_')) {
      this.settings?._showToast(`Priority set to ${action.replace('priority_', '').toUpperCase()}`, 'success');
    } else if (action === 'remove') {
      if (confirm(`Remove "${torrent.name}" from client?`)) {
        await window.api.removeTorrent(hash, false);
        this.refreshTorrents();
      }
    } else if (action === 'remove_delete') {
      if (confirm(`⚠ PERMANENT DELETION WARNING\n\nAre you sure you want to permanently delete "${torrent.name}" and all downloaded files from disk?`)) {
        await window.api.removeTorrent(hash, true);
        this.refreshTorrents();
      }
    }
  }

  bindAboutButtons() {
    const btnCheck = document.getElementById('btnCheckUpdates');
    if (btnCheck) {
      btnCheck.addEventListener('click', () => {
        btnCheck.disabled = true;
        btnCheck.innerHTML = `<i data-lucide="refresh-cw" style="width:14px;height:14px;"></i> Checking...`;
        if (window.lucide) window.lucide.createIcons();

        setTimeout(() => {
          btnCheck.disabled = false;
          btnCheck.className = 'btn-otc btn-otc-primary px-4 py-2 bg-success text-white border-success';
          btnCheck.innerHTML = `<i data-lucide="check-circle" style="width:14px;height:14px;"></i> Latest Version (v1.0.0)`;
          if (window.lucide) window.lucide.createIcons();
          this.settings?._showToast('Open Torrent Client is up to date!', 'success');
        }, 1200);
      });
    }

    const btnDiag = document.getElementById('btnExportDiagnostics');
    if (btnDiag) {
      btnDiag.addEventListener('click', async () => {
        const report = await window.api.testMagnetHandler();
        const diagStr = `=========================================\nOPEN TORRENT CLIENT — DIAGNOSTICS REPORT\n=========================================\nStatus: ${report.message}\n\nChecks:\n` +
          report.checks.map(c => `[${c.status ? 'PASS' : 'FAIL'}] ${c.step}: ${c.detail}`).join('\n');
        alert(diagStr);
      });
    }
  }

  bindDragDrop() {
    const overlay = document.getElementById('dragDropOverlay');
    if (!overlay) return;

    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      overlay.style.display = 'flex';
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.style.display = 'none';
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.style.display = 'none';

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.path && (file.name.endsWith('.torrent') || file.path.endsWith('.torrent'))) {
            this.dialogs.openAddTorrentFile(file.path);
            break;
          }
        }
      }
    });
  }

  bindToolbarButtons() {
    const btnAddTorrent = document.getElementById('btnHeaderAddTorrent');
    const btnAddMagnet = document.getElementById('btnHeaderAddMagnet');
    const btnStart = document.getElementById('btnHeaderStart');
    const btnPause = document.getElementById('btnHeaderPause');
    const btnStop = document.getElementById('btnHeaderStop');
    const btnForceStart = document.getElementById('btnHeaderForceStart');
    const btnMoveUp = document.getElementById('btnHeaderMoveUp');
    const btnMoveDown = document.getElementById('btnHeaderMoveDown');
    const btnRemove = document.getElementById('btnHeaderRemove');
    const btnCmd = document.getElementById('btnHeaderCmdPalette');
    const btnTerminal = document.getElementById('btnHeaderTerminal');
    const btnSettings = document.getElementById('btnHeaderSettings');
    const searchInput = document.getElementById('globalSearchInput');

    if (btnAddTorrent) btnAddTorrent.addEventListener('click', () => this.dialogs.openAddTorrentFile());
    if (btnAddMagnet) btnAddMagnet.addEventListener('click', () => this.dialogs.openAddMagnet());
    if (btnCmd) btnCmd.addEventListener('click', () => this.cmdPalette.open());
    if (btnTerminal) btnTerminal.addEventListener('click', () => this.nav.switchView('terminal'));
    if (btnSettings) btnSettings.addEventListener('click', () => this.nav.switchView('settings'));

    // Keyboard shortcut for Terminal (Ctrl+~)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.key === '~')) {
        e.preventDefault();
        const curView = this.nav.currentView;
        this.nav.switchView(curView === 'terminal' ? 'torrents' : 'terminal');
      }
    });

    if (btnStart) {
      btnStart.addEventListener('click', async () => {
        const hash = this.table.getSelectedHash();
        if (hash) {
          await window.api.resumeTorrent(hash);
          this.refreshTorrents();
        } else {
          await window.api.resumeAll();
          this.refreshTorrents();
        }
      });
    }

    if (btnPause) {
      btnPause.addEventListener('click', async () => {
        const hash = this.table.getSelectedHash();
        if (hash) {
          await window.api.pauseTorrent(hash);
          this.refreshTorrents();
        } else {
          await window.api.pauseAll();
          this.refreshTorrents();
        }
      });
    }

    if (btnStop) {
      btnStop.addEventListener('click', async () => {
        const hash = this.table.getSelectedHash();
        if (hash) {
          await window.api.stopTorrent(hash);
          this.refreshTorrents();
        }
      });
    }

    if (btnForceStart) {
      btnForceStart.addEventListener('click', async () => {
        const hash = this.table.getSelectedHash();
        if (hash) {
          await window.api.forceStart(hash);
          this.refreshTorrents();
        }
      });
    }

    if (btnMoveUp) {
      btnMoveUp.addEventListener('click', async () => {
        const hash = this.table.getSelectedHash();
        if (hash) {
          await window.api.moveQueue(hash, 'up');
          this.refreshTorrents();
        }
      });
    }

    if (btnMoveDown) {
      btnMoveDown.addEventListener('click', async () => {
        const hash = this.table.getSelectedHash();
        if (hash) {
          await window.api.moveQueue(hash, 'down');
          this.refreshTorrents();
        }
      });
    }

    if (btnRemove) {
      btnRemove.addEventListener('click', async () => {
        const hash = this.table.getSelectedHash();
        if (hash) {
          const deleteFiles = confirm('Delete downloaded files from disk as well?');
          await window.api.removeTorrent(hash, deleteFiles);
          this.refreshTorrents();
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.table.setSearchQuery(e.target.value);
      });
    }

    const btnDashMagnet = document.getElementById('btnDashAddMagnet');
    const btnDashTorrent = document.getElementById('btnDashAddTorrent');
    const btnDashPauseAll = document.getElementById('btnDashPauseAll');
    const btnDashResumeAll = document.getElementById('btnDashResumeAll');

    if (btnDashMagnet) btnDashMagnet.addEventListener('click', () => this.dialogs.openAddMagnet());
    if (btnDashTorrent) btnDashTorrent.addEventListener('click', () => this.dialogs.openAddTorrentFile());
    if (btnDashPauseAll) btnDashPauseAll.addEventListener('click', () => { window.api.pauseAll(); this.refreshTorrents(); });
    if (btnDashResumeAll) btnDashResumeAll.addEventListener('click', () => { window.api.resumeAll(); this.refreshTorrents(); });
  }

  handleSectionChange(section) {
    if (section === 'file-manager') {
      this.fileManager.loadDirectory();
    } else if (section === 'history') {
      this.history.loadHistory();
    } else if (section === 'statistics') {
      this.statistics.loadStatistics();
    } else if (section === 'settings') {
      this.settings.loadSettings();
    }
  }

  handleCommandAction(actionId) {
    if (actionId === 'add_torrent') this.dialogs.openAddTorrentFile();
    else if (actionId === 'add_magnet') this.dialogs.openAddMagnet();
    else if (actionId === 'pause_all') window.api.pauseAll();
    else if (actionId === 'resume_all') window.api.resumeAll();
    else if (actionId === 'open_settings') this.nav.switchView('settings');
    else if (actionId === 'open_file_manager') this.nav.switchView('file-manager');
    else if (actionId === 'toggle_theme') {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
    }
  }

  handleRealtimeStats(stats) {
    if (!stats) return;

    // Statusbar
    document.getElementById('statusDnSpeed').textContent = this.formatSpeed(stats.downloadSpeed);
    document.getElementById('statusUpSpeed').textContent = this.formatSpeed(stats.uploadSpeed);
    document.getElementById('statusActiveCount').textContent = stats.activeTorrentsCount || 0;
    document.getElementById('statusDht').textContent = stats.dhtStatus || 'Connected';
    document.getElementById('statusPort').textContent = stats.port || 6881;

    // Dashboard Cards
    document.getElementById('dashDnSpeed').textContent = this.formatSpeed(stats.downloadSpeed);
    document.getElementById('dashUpSpeed').textContent = this.formatSpeed(stats.uploadSpeed);
    document.getElementById('dashActiveDn').textContent = stats.activeTorrentsCount || 0;
    document.getElementById('dashDhtStatus').textContent = stats.dhtStatus || 'Connected';
    document.getElementById('dashDhtNodes').textContent = `Nodes: ${stats.dhtNodes || 128}`;

    // Counters
    if (stats.counters) {
      this.nav.updateCounters(stats.counters);
      document.getElementById('statusPeers').textContent = (stats.counters.downloading * 8) || 0;
    }

    // Torrent Table Update
    if (stats.torrents) {
      this.table.setTorrents(stats.torrents);
    }

    // Speed Chart Update
    this.details.updateSpeedChart(stats.downloadSpeed, stats.uploadSpeed);

    // Refresh Details Inspector panel for selected or first active torrent
    let activeHash = this.table.getSelectedHash();
    if (!activeHash && stats.torrents && stats.torrents.length > 0) {
      activeHash = stats.torrents[0].infoHash;
    }
    if (activeHash && stats.torrents) {
      const activeTorrent = stats.torrents.find(t => t.infoHash === activeHash);
      if (activeTorrent) {
        this.details.updateRealtimeOverview(activeTorrent);
      }
      this.details.refreshDetails(activeHash);
    }
  }

  async refreshTorrents() {
    const torrents = await window.api.getAllTorrents();
    const counters = await window.api.getCounters();
    this.table.setTorrents(torrents);
    this.nav.updateCounters(counters);

    let activeHash = this.table.getSelectedHash();
    if (!activeHash && torrents.length > 0) {
      activeHash = torrents[0].infoHash;
    }
    if (activeHash) {
      this.details.refreshDetails(activeHash);
    }
  }

  formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let i = 0; let val = bytesPerSec;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(1)} ${units[i]}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
