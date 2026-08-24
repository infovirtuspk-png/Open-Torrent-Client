/**
 * Open Torrent Client — Complete System Tray Service
 *
 * Handles:
 * - Real Windows Notification Area tray icon (5 states)
 * - Dynamic state-aware right-click tray menu
 * - Real-time tooltip with download/upload speeds & counters
 * - Left-click / double-click to restore window
 * - Minimize-to-tray / close-to-tray behaviour
 * - Graceful shutdown with active torrent confirmation
 * - Windows notifications (configurable per event type)
 * - Tray quick actions: Add Torrent, Add Magnet, Pause All, Resume All, Stop All, Open Downloads
 * - Tray statistics updated on real-time engine events
 */

const { Notification, Tray, Menu, nativeImage, app, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const diagnostics = require('./diagnostics');

// ─── Icon Paths ────────────────────────────────────────────────────────────────
const ASSETS = path.join(__dirname, '..', 'assets');
const ICONS = {
  idle:        path.join(ASSETS, 'tray.png'),
  downloading: path.join(ASSETS, 'tray_downloading.png'),
  seeding:     path.join(ASSETS, 'tray_seeding.png'),
  paused:      path.join(ASSETS, 'tray_paused.png'),
  error:       path.join(ASSETS, 'tray_error.png')
};

// ─── Application Lifecycle States ──────────────────────────────────────────────
const AppState = {
  STARTING:    'STARTING',
  READY:       'READY',
  MINIMIZED:   'MINIMIZED',
  TRAY_ONLY:   'TRAY_ONLY',
  BACKGROUND:  'BACKGROUND',
  EXITING:     'EXITING',
  STOPPED:     'STOPPED'
};

class TrayService {
  constructor() {
    this.tray = null;
    this.mainWindow = null;
    this.appState = AppState.STARTING;

    // Live stats cache (updated from engine realtime_stats events)
    this.stats = {
      downloadSpeed: 0,
      uploadSpeed:   0,
      downloading:   0,
      seeding:       0,
      paused:        0,
      queued:        0,
      total:         0
    };

    // Icon cache
    this._iconCache = {};
    this._currentIconState = null;

    // Tooltip refresh timer
    this._tooltipTimer = null;

    // Track "close-to-tray first time" shown
    this._closeToTrayNotified = false;

    // Callbacks set by main.js
    this.onAddMagnetRequest = null;
    this.onAddTorrentRequest = null;
    this.onOpenSettings = null;
    this.onPauseAll = null;
    this.onResumeAll = null;
    this.onStopAll = null;
  }

  // ─── Initialise ─────────────────────────────────────────────────────────────
  init(mainWindow, callbacks = {}) {
    this.mainWindow = mainWindow;
    this.appState = AppState.READY;

    // Wire up optional callbacks from main process
    this.onAddMagnetRequest  = callbacks.onAddMagnetRequest  || (() => {});
    this.onAddTorrentRequest = callbacks.onAddTorrentRequest || (() => {});
    this.onOpenSettings      = callbacks.onOpenSettings      || (() => {});
    this.onPauseAll          = callbacks.onPauseAll          || (() => {});
    this.onResumeAll         = callbacks.onResumeAll         || (() => {});
    this.onStopAll           = callbacks.onStopAll           || (() => {});

    this._createTray();
    this._bindWindowEvents();
    this._startTooltipRefresh();

    diagnostics.log('INFO', '[Tray] System tray service initialised.');
  }

  // ─── Icon Loading ────────────────────────────────────────────────────────────
  _loadIcon(state) {
    if (this._iconCache[state]) return this._iconCache[state];
    const p = ICONS[state] || ICONS.idle;
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      this._iconCache[state] = img;
      return img;
    }
    return nativeImage.createEmpty();
  }

  _setTrayIcon(state) {
    if (!this.tray || this._currentIconState === state) return;
    this._currentIconState = state;
    try {
      this.tray.setImage(this._loadIcon(state));
    } catch (e) {
      diagnostics.log('WARN', '[Tray] Failed to set icon:', e.message);
    }
  }

  // ─── Tray Creation ───────────────────────────────────────────────────────────
  _createTray() {
    try {
      this.tray = new Tray(this._loadIcon('idle'));
      this.tray.setToolTip('Open Torrent Client\nNo active downloads');

      // Left single click → restore
      this.tray.on('click', () => this.showWindow());

      // Double-click → restore
      this.tray.on('double-click', () => this.showWindow());

      // Build initial context menu
      this._rebuildContextMenu();

      diagnostics.log('INFO', '[Tray] Tray icon created in Windows Notification Area.');
    } catch (e) {
      diagnostics.log('ERROR', '[Tray] Failed to create tray icon:', e.message);
    }
  }

  // ─── Context Menu (Dynamic, State-Aware) ─────────────────────────────────────
  _rebuildContextMenu() {
    if (!this.tray) return;

    const { downloading, seeding, paused, queued, total, downloadSpeed, uploadSpeed } = this.stats;
    const hasActive    = downloading > 0 || seeding > 0;
    const allPaused    = total > 0 && downloading === 0 && seeding === 0;
    const dnSpeedStr   = this._fmtSpeed(downloadSpeed);
    const upSpeedStr   = this._fmtSpeed(uploadSpeed);

    const template = [];

    // ── Header ──────────────────────────────────────────────────────────────────
    template.push({ label: 'Open Torrent Client', enabled: false });
    template.push({ type: 'separator' });

    // ── Status Summary ───────────────────────────────────────────────────────────
    if (total === 0) {
      template.push({ label: 'No active torrents', enabled: false });
    } else {
      if (downloading > 0) template.push({ label: `🟢 ${downloading} Downloading  ↓ ${dnSpeedStr}`, enabled: false });
      if (seeding > 0)     template.push({ label: `🔵 ${seeding} Seeding  ↑ ${upSpeedStr}`, enabled: false });
      if (paused > 0)      template.push({ label: `🟡 ${paused} Paused`, enabled: false });
      if (queued > 0)      template.push({ label: `⚪ ${queued} Queued`, enabled: false });
    }
    template.push({ type: 'separator' });

    // ── Quick Controls ──────────────────────────────────────────────────────────
    template.push({
      label: '▶  Resume All',
      enabled: allPaused || paused > 0,
      click: () => { this.onResumeAll(); this._rebuildContextMenu(); }
    });
    template.push({
      label: '⏸  Pause All',
      enabled: downloading > 0,
      click: () => { this.onPauseAll(); this._rebuildContextMenu(); }
    });
    template.push({
      label: '⏹  Stop All',
      enabled: hasActive,
      click: () => { this.onStopAll(); this._rebuildContextMenu(); }
    });
    template.push({ type: 'separator' });

    // ── Add Actions ──────────────────────────────────────────────────────────────
    template.push({
      label: '➕  Add Torrent',
      click: () => { this.showWindow(); setTimeout(() => this.onAddTorrentRequest(), 200); }
    });
    template.push({
      label: '🔗  Add Magnet Link',
      click: () => { this.showWindow(); setTimeout(() => this.onAddMagnetRequest(), 200); }
    });
    template.push({ type: 'separator' });

    // ── File System ──────────────────────────────────────────────────────────────
    template.push({
      label: '📂  Open Downloads Folder',
      click: () => {
        const dlPath = db.getSetting('defaultDownloadPath', require('os').homedir() + '\\Downloads');
        shell.openPath(dlPath);
      }
    });
    template.push({
      label: '🖥  Open Dashboard',
      click: () => this.showWindow()
    });
    template.push({ type: 'separator' });

    // ── Settings ─────────────────────────────────────────────────────────────────
    template.push({
      label: '⚙  Settings',
      click: () => { this.showWindow(); setTimeout(() => this.onOpenSettings(), 300); }
    });
    template.push({ type: 'separator' });

    // ── Exit ──────────────────────────────────────────────────────────────────────
    template.push({
      label: '🚪  Exit Open Torrent Client',
      click: () => this._handleGracefulExit()
    });

    try {
      this.tray.setContextMenu(Menu.buildFromTemplate(template));
    } catch (e) {
      diagnostics.log('WARN', '[Tray] Failed to build context menu:', e.message);
    }
  }

  // ─── Graceful Exit Flow ───────────────────────────────────────────────────────
  async _handleGracefulExit() {
    const { downloading, seeding } = this.stats;
    const hasActive = downloading > 0 || seeding > 0;

    let message = 'Are you sure you want to exit Open Torrent Client?';
    let detail = 'All downloaded files will remain on disk.';

    if (hasActive) {
      const parts = [];
      if (downloading > 0) parts.push(`${downloading} downloading`);
      if (seeding > 0)     parts.push(`${seeding} seeding`);
      detail = `Active torrents: ${parts.join(', ')}.\n\nAll torrent activity will stop. Downloaded files will remain on disk.`;
    }

    const { response } = await dialog.showMessageBox({
      type: 'question',
      title: 'Exit Open Torrent Client',
      message,
      detail,
      buttons: ['Exit Application', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      icon: this._loadIcon('idle')
    });

    if (response === 0) {
      diagnostics.log('INFO', '[Tray] User confirmed graceful shutdown.');
      this.appState = AppState.EXITING;
      app.isQuitting = true;

      // Give engine time to flush state
      setTimeout(() => {
        if (this.tray) { try { this.tray.destroy(); } catch (_) {} }
        app.quit();
      }, 400);
    }
  }

  // ─── Window Events ────────────────────────────────────────────────────────────
  _bindWindowEvents() {
    if (!this.mainWindow) return;

    this.mainWindow.on('minimize', () => {
      const minimizeToTray = db.getSetting('minimizeToTray', 'true') === 'true';
      if (minimizeToTray) {
        this.mainWindow.hide();
        this.appState = AppState.TRAY_ONLY;
        diagnostics.log('INFO', '[Tray] Window minimized to tray. Engine continues.');
      } else {
        this.appState = AppState.MINIMIZED;
      }
    });

    this.mainWindow.on('restore', () => {
      this.appState = AppState.READY;
    });

    this.mainWindow.on('show', () => {
      this.appState = AppState.READY;
    });

    this.mainWindow.on('hide', () => {
      this.appState = AppState.TRAY_ONLY;
    });

    this.mainWindow.on('close', (event) => {
      if (app.isQuitting) return; // allow real quit

      const closeToTray = db.getSetting('closeToTray', 'true') === 'true';
      if (closeToTray) {
        event.preventDefault();
        this.mainWindow.hide();
        this.appState = AppState.TRAY_ONLY;

        const showNotif = db.getSetting('showCloseToTrayNotif', 'true') === 'true';
        if (showNotif && !this._closeToTrayNotified) {
          this._closeToTrayNotified = true;
          this.notify(
            'Still Running in Background',
            'Open Torrent Client continues downloading in the system tray. Click the tray icon to restore.',
            'close_to_tray'
          );
        }

        diagnostics.log('INFO', '[Tray] Window closed to tray. Background engine active.');
      }
    });
  }

  // ─── Show/Restore Window ──────────────────────────────────────────────────────
  showWindow() {
    if (!this.mainWindow) return;
    if (this.mainWindow.isMinimized()) this.mainWindow.restore();
    this.mainWindow.show();
    this.mainWindow.focus();
    this.appState = AppState.READY;
    diagnostics.log('INFO', '[Tray] Window restored from tray.');
  }

  // ─── Tooltip Refresh ─────────────────────────────────────────────────────────
  _startTooltipRefresh() {
    // Heartbeat refresh every 1 second for live real-time values
    this._tooltipTimer = setInterval(() => this._updateTooltipAndIcon(), 1000);
  }

  _updateTooltipAndIcon() {
    if (!this.tray) return;

    const { downloading, seeding, paused, total, downloadSpeed, uploadSpeed, torrents } = this.stats;

    // ── Realtime Tooltip Text ───────────────────────────────────────────────────
    let tip = 'Open Torrent Client';

    if (total === 0) {
      tip += '\nNo active torrents';
    } else {
      const dnSpeedStr = this._fmtSpeed(downloadSpeed);
      const upSpeedStr = this._fmtSpeed(uploadSpeed);
      tip += `\n↓ ${dnSpeedStr}   ↑ ${upSpeedStr}`;

      const activeDownloading = (torrents || []).filter(t =>
        t.status && (t.status.startsWith('Downloading') || t.status === 'Metadata Downloading') && !t.isPaused
      );

      if (activeDownloading.length > 0) {
        tip += '\n';
        const displayList = activeDownloading.slice(0, 3);
        displayList.forEach(t => {
          const pct = Math.round((t.progress || 0) * 100);
          const spd = this._fmtSpeed(t.downloadSpeed || 0);
          const name = t.name ? (t.name.length > 20 ? t.name.substring(0, 18) + '..' : t.name) : 'Torrent';
          tip += `• ${name}: ${pct}% (${spd})\n`;
        });
        if (activeDownloading.length > 3) {
          tip += `+${activeDownloading.length - 3} more downloading...`;
        }
      } else {
        const parts = [];
        if (downloading > 0) parts.push(`Downloading: ${downloading}`);
        if (seeding > 0)     parts.push(`Seeding: ${seeding}`);
        if (paused > 0)      parts.push(`Paused: ${paused}`);
        if (parts.length > 0) {
          tip += '\n' + parts.join(' | ');
        }
      }
    }

    try {
      this.tray.setToolTip(tip.trim());
    } catch (_) {}

    // ── Icon State ────────────────────────────────────────────────────────────
    let iconState = 'idle';
    if (downloading > 0)  iconState = 'downloading';
    else if (seeding > 0) iconState = 'seeding';
    else if (paused > 0)  iconState = 'paused';

    this._setTrayIcon(iconState);
  }

  // ─── Real-time Stats Update (called from engine broadcast) ────────────────────
  updateStats(stats) {
    if (!stats) return;

    const counters = stats.counters || {};
    this.stats = {
      downloadSpeed: stats.downloadSpeed || 0,
      uploadSpeed:   stats.uploadSpeed   || 0,
      downloading:   counters.downloading || 0,
      seeding:       counters.seeding     || 0,
      paused:        counters.paused      || 0,
      queued:        counters.queued      || 0,
      total:         counters.all         || 0,
      torrents:      stats.torrents       || []
    };

    // Live update tooltip and icon immediately on every 1s tick
    this._updateTooltipAndIcon();

    // Rebuild tray menu on real-time state change (throttled to 1s)
    const now = Date.now();
    if (!this._lastMenuRebuild || now - this._lastMenuRebuild >= 1000) {
      this._lastMenuRebuild = now;
      this._rebuildContextMenu();
    }
  }

  // ─── Notifications ────────────────────────────────────────────────────────────
  notify(title, body, eventType = 'generic') {
    const masterEnabled = db.getSetting('enableNotifications', 'true') === 'true';
    if (!masterEnabled) return;

    // Check per-event-type settings
    const settingKey = {
      torrent_added:      'notifTorrentAdded',
      download_complete:  'notifDownloadComplete',
      torrent_error:      'notifTorrentError',
      metadata_received:  'notifMetadataReceived',
      tracker_error:      'notifTrackerError',
      seeding_started:    'notifSeedingStarted',
      close_to_tray:      'notifCloseToTray',
      generic:            null
    }[eventType];

    if (settingKey && db.getSetting(settingKey, 'true') !== 'true') return;

    if (Notification.isSupported()) {
      try {
        const notif = new Notification({
          title:  title  || 'Open Torrent Client',
          body:   body   || '',
          silent: false,
          timeoutType: 'default'
        });
        notif.on('click', () => this.showWindow());
        notif.show();
        diagnostics.log('INFO', `[Tray] Notification shown: ${title}`);
      } catch (e) {
        diagnostics.log('WARN', '[Tray] Notification failed:', e.message);
      }
    }
  }

  // ─── Convenience notification helpers ────────────────────────────────────────
  notifyDownloadComplete(torrentName) {
    this.notify('✓ Download Complete', `${torrentName} downloaded successfully.`, 'download_complete');
  }
  notifyTorrentAdded(torrentName) {
    this.notify('🔗 Torrent Added', `${torrentName} has been added to the queue.`, 'torrent_added');
  }
  notifyMetadataReceived(torrentName) {
    this.notify('✓ Metadata Received', `${torrentName} is ready to download.`, 'metadata_received');
  }
  notifyTorrentError(torrentName) {
    this.notify('⚠ Torrent Error', `${torrentName} encountered an error.`, 'torrent_error');
  }

  // ─── Legacy updateTrayTooltip (backward compat) ───────────────────────────────
  updateTrayTooltip(dnSpeedStr, upSpeedStr) {
    if (this.tray) {
      try {
        this.tray.setToolTip(`Open Torrent Client\n↓ ${dnSpeedStr}   ↑ ${upSpeedStr}`);
      } catch (_) {}
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────────
  destroy() {
    if (this._tooltipTimer) { clearInterval(this._tooltipTimer); this._tooltipTimer = null; }
    if (this.tray) {
      try { this.tray.destroy(); } catch (_) {}
      this.tray = null;
    }
    diagnostics.log('INFO', '[Tray] Tray service destroyed.');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  _fmtSpeed(bps) {
    if (!bps || bps <= 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let i = 0, val = bps;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(1)} ${units[i]}`;
  }

  get isTrayOnly() {
    return this.appState === AppState.TRAY_ONLY;
  }
}

module.exports = new TrayService();
