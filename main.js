/**
 * Open Torrent Client — main.js
 *
 * Electron main process:
 *  - Single-instance lock + Magnet/torrent launch arg handling
 *  - App lifecycle: STARTING → READY → TRAY_ONLY → EXITING
 *  - System Tray integration via TrayService
 *  - Background engine continues when window is hidden
 *  - All IPC handlers for UI ↔ Engine communication
 */

const { app, BrowserWindow, ipcMain, dialog, globalShortcut, shell, powerSaveBlocker } = require('electron');
const path = require('path');
const db          = require('./database/db');
const diag        = require('./backend/diagnostics');
const fileMgr     = require('./backend/file-manager');
const bwMgr       = require('./backend/bandwidth-manager');
const tMgr        = require('./backend/torrent-manager');
const engine      = require('./backend/engine');
const capture     = require('./backend/capture-manager');
const clip        = require('./backend/clipboard-watcher');
const tray        = require('./backend/tray-service');
const termService = require('./backend/terminal-service');

let mainWindow    = null;
let pendingMagnet = null;

// ─── Uncaught Exception Handler ──────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  diag.log('ERROR', '[Main] Uncaught Exception:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  diag.log('ERROR', '[Main] Unhandled Rejection:', reason?.message || reason);
});

// ─── Protocol Registration ────────────────────────────────────────────────────
function registerProtocol() {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('magnet', process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient('magnet');
  }
}
registerProtocol();

// ─── Single Instance Lock ─────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  diag.log('INFO', '[Main] Second instance started — forwarding launch args and exiting.');
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', (_event, argv) => {
    diag.log('INFO', '[Main] Second instance detected — forwarding args via IPC.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    handleLaunchArgs(argv);
  });
}

// ─── Launch Arg Handler ────────────────────────────────────────────────────────
function handleLaunchArgs(argv) {
  if (!argv || !Array.isArray(argv)) return;

  const magnetUrls = argv.filter(a => typeof a === 'string' && a.startsWith('magnet:'));
  for (const magnetUrl of magnetUrls) {
    diag.log('INFO', `[Main] Received magnet link from OS launch arg: ${magnetUrl}`);
    pendingMagnet = magnetUrl;
    if (mainWindow && !mainWindow.isDestroyed()) {
      captureAndForward(magnetUrl);
    }
  }

  const torrentFiles = argv.filter(a =>
    typeof a === 'string' && a.endsWith('.torrent') && require('fs').existsSync(a)
  );
  for (const torrentFile of torrentFiles) {
    diag.log('INFO', `[Main] Received .torrent file from OS launch arg: ${torrentFile}`);
    const defPath = db.getSetting('defaultDownloadPath', path.join(app.getPath('home'), 'Downloads'));
    try {
      engine.addTorrentOrMagnet(torrentFile, defPath);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('realtime_stats', { torrents: tMgr.getAllTorrents() });
      }
    } catch (e) {
      diag.log('ERROR', '[Main] Auto-add torrent file failed:', e.message);
    }
  }
}

function captureAndForward(magnetUrl) {
  capture.handleIncomingMagnet(magnetUrl, (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    } else {
      // Running tray-only in auto mode — add silently
      if (channel === 'magnet_preview_prompt') {
        const defPath = db.getSetting('defaultDownloadPath', path.join(app.getPath('home'), 'Downloads'));
        engine.addTorrentOrMagnet(data.rawUri, defPath);
      }
    }
  });
}

// ─── Window Creation ──────────────────────────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1366,
    height: 850,
    minWidth:  1024,
    minHeight: 650,
    title: 'Open Torrent Client',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingMagnet) {
      captureAndForward(pendingMagnet);
      pendingMagnet = null;
    }
  });
}

// ─── App Ready ────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');

  try { diag.init(userDataPath); } catch (_) {}
  try {
    termService.init((channel, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
      }
    }, powerSaveBlocker);
  } catch (_) {}

  // 1. Browser window (Always create window first to guarantee UI launch)
  await createWindow();

  try {
    // 2. Database
    await db.init(userDataPath);

    // 3. File Manager root paths
    bwMgr.init();
    const defDownloadPath = db.getSetting('defaultDownloadPath', path.join(app.getPath('home'), 'Downloads'));
    fileMgr.setAllowedRoots([defDownloadPath, app.getPath('downloads'), app.getPath('home')]);
  } catch (dbErr) {
    diag.log('ERROR', '[Main] DB/File initialization warning:', dbErr?.message || dbErr);
  }

  try {
    // 4. Tray Service
    tray.init(mainWindow, {
      onAddMagnetRequest:  () => { if (mainWindow) mainWindow.webContents.send('shortcut_trigger', 'add_magnet'); },
      onAddTorrentRequest: () => { if (mainWindow) mainWindow.webContents.send('shortcut_trigger', 'add_torrent'); },
      onOpenSettings:      () => { if (mainWindow) mainWindow.webContents.send('shortcut_trigger', 'open_settings'); },
      onPauseAll:          () => tMgr.pauseAll(),
      onResumeAll:         () => tMgr.resumeAll(),
      onStopAll:           () => { for (const h of tMgr.torrents.keys()) tMgr.stopTorrent(h); }
    });
  } catch (trayErr) {
    diag.log('ERROR', '[Main] Tray initialization warning:', trayErr?.message || trayErr);
  }

  try {
    // 5. Engine init
    await engine.init((channel, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
      }
      if (channel === 'realtime_stats') {
        tray.updateStats(data);
        if (tray.isTrayOnly && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tray_only_mode', true);
        }
      }
      if (channel === 'download_completed' && data && data.name) tray.notifyDownloadComplete(data.name);
      if (channel === 'metadata_received' && data && data.name) tray.notifyMetadataReceived(data.name);
      if (channel === 'torrent_error' && data && data.name) tray.notifyTorrentError(data.name);
    });
  } catch (engErr) {
    diag.log('ERROR', '[Main] Engine initialization warning:', engErr?.message || engErr);
  }

  // 6. Restore torrent states from database
  try {
    const restoreStates = db.getSetting('restoreTorrentStates', 'true') === 'true';
    if (restoreStates) {
      tMgr.setEngine(engine);
      tMgr.initFromDatabase();
    }
  } catch (_) {}

  // 7. Handle cold-start launch arguments
  handleLaunchArgs(process.argv);

  // 8. Clipboard watcher & Startup settings
  try { clip.start((uri) => captureAndForward(uri)); } catch (_) {}
  try { _applyStartupSetting(); } catch (_) {}
  try { _registerGlobalShortcuts(); } catch (_) {}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  diag.log('INFO', '[Main] Open Torrent Client fully initialised.');
});

// ─── Startup Registration ─────────────────────────────────────────────────────
function _applyStartupSetting() {
  const startWithWindows = db.getSetting('startWithWindows', 'false') === 'true';
  const startMinimized   = db.getSetting('startMinimized',   'false') === 'true';

  app.setLoginItemSettings({
    openAtLogin: startWithWindows,
    args: startMinimized ? ['--minimized'] : []
  });

  if (startMinimized || process.argv.includes('--minimized')) {
    if (mainWindow) {
      mainWindow.hide();
    }
  }
}

// ─── Global Shortcuts ─────────────────────────────────────────────────────────
function _registerGlobalShortcuts() {
  try {
    // Ctrl+Alt+O — Open dashboard
    globalShortcut.register('CommandOrControl+Alt+O', () => tray.showWindow());

    // Ctrl+Alt+M — Add Magnet
    globalShortcut.register('CommandOrControl+Alt+M', () => {
      tray.showWindow();
      setTimeout(() => { if (mainWindow) mainWindow.webContents.send('shortcut_trigger', 'add_magnet'); }, 200);
    });

    // Ctrl+Alt+P — Pause/Resume All
    globalShortcut.register('CommandOrControl+Alt+P', () => {
      const { downloading } = tray.stats;
      if (downloading > 0) tMgr.pauseAll(); else tMgr.resumeAll();
    });

    // App-local shortcuts
    globalShortcut.register('CommandOrControl+O', () => {
      if (mainWindow) mainWindow.webContents.send('shortcut_trigger', 'add_torrent');
    });
    globalShortcut.register('CommandOrControl+M', () => {
      if (mainWindow) mainWindow.webContents.send('shortcut_trigger', 'add_magnet');
    });
    globalShortcut.register('CommandOrControl+K', () => {
      if (mainWindow) mainWindow.webContents.send('shortcut_trigger', 'command_palette');
    });
  } catch (e) {
    diag.log('WARN', '[Main] Shortcut registration failed:', e.message);
  }
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  clip.stop();
  tray.destroy();
  diag.log('INFO', '[Main] Application shutting down. Tray destroyed.');
});

app.on('window-all-closed', () => {
  // Do NOT quit on window close — engine must keep running in tray
  // App only truly quits when user chooses Exit from tray menu
  if (process.platform !== 'darwin' && app.isQuitting) {
    app.quit();
  }
});

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Integration
ipcMain.handle('integration:test',       async () => capture.testMagnetHandler());
ipcMain.handle('integration:register',   async () => {
  registerProtocol();
  const res = capture.registerAssociations();
  db.setSetting('registerMagnetHandler', 'true');
  return res;
});
ipcMain.handle('integration:unregister', async () => {
  const res = capture.unregisterAssociations();
  db.setSetting('registerMagnetHandler', 'false');
  return res;
});
ipcMain.handle('integration:check',      async () => {
  const status = capture.getIntegrationStatus();
  return {
    isDefaultMagnet: status.magnetRegistered || app.isDefaultProtocolClient('magnet'),
    isDefaultTorrent: status.torrentRegistered,
    captureMode: db.getSetting('captureMode', 'ask'),
    singleInstanceActive: true,
    detail: status
  };
});

// Torrent operations
ipcMain.handle('torrent:add', async (_e, src, savePath, opts) => {
  try {
    const sp = savePath || db.getSetting('defaultDownloadPath', path.join(app.getPath('home'), 'Downloads'));
    const hash = engine.addTorrentOrMagnet(src, sp, opts);
    if (hash) tray.notifyTorrentAdded(opts?.name || 'New Torrent');
    return { success: true, infoHash: hash };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('torrent:addMagnet', async (_e, uri, savePath, opts) => {
  try {
    const sp = savePath || db.getSetting('defaultDownloadPath', path.join(app.getPath('home'), 'Downloads'));
    const hash = engine.addTorrentOrMagnet(uri, sp, opts);
    if (hash) tray.notifyTorrentAdded(opts?.name || 'Magnet Torrent');
    return { success: true, infoHash: hash };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('torrent:pause',          async (_e, h) => { tMgr.pauseTorrent(h);          return { success: true }; });
ipcMain.handle('torrent:stop',           async (_e, h) => { tMgr.stopTorrent(h);           return { success: true }; });
ipcMain.handle('torrent:resume',         async (_e, h) => { tMgr.resumeTorrent(h);         return { success: true }; });
ipcMain.handle('torrent:remove',         async (_e, h, del) => { tMgr.removeTorrent(h, del); return { success: true }; });
ipcMain.handle('torrent:forceStart',     async (_e, h) => { tMgr.forceStart(h);            return { success: true }; });
ipcMain.handle('torrent:recheck',        async (_e, h) => { tMgr.recheckTorrent(h);        return { success: true }; });
ipcMain.handle('torrent:reannounce',     async (_e, h) => tMgr.reannounceTorrent(h));
ipcMain.handle('torrent:rename',         async (_e, h, n) => { tMgr.renameTorrent(h, n);  return { success: true }; });
ipcMain.handle('torrent:changeLocation', async (_e, h, loc) => tMgr.changeDownloadLocation(h, loc));
ipcMain.handle('torrent:moveQueue',      async (_e, h, dir) => { tMgr.moveQueue(h, dir);   return { success: true }; });
ipcMain.handle('torrent:pauseAll',       async () => { tMgr.pauseAll();   return { success: true }; });
ipcMain.handle('torrent:resumeAll',      async () => { tMgr.resumeAll(); return { success: true }; });
ipcMain.handle('torrent:setFilePriority', async (_e, h, fp, p) => { engine.setFilePriority(h, fp, p); return { success: true }; });
ipcMain.handle('torrent:addTracker',     async (_e, h, u) => engine.addTracker(h, u));
ipcMain.handle('torrent:addWebSeed',     async (_e, h, u) => engine.addWebSeed(h, u));
ipcMain.handle('torrent:getDetails',     async (_e, h) => engine.getTorrentDetails(h));
ipcMain.handle('torrent:getAll',         async () => tMgr.getAllTorrents());
ipcMain.handle('torrent:getCounters',    async () => tMgr.getCounters());

// Settings
ipcMain.handle('settings:get', async () => db.getAllSettings());
ipcMain.handle('settings:save', async (_e, s) => {
  for (const [k, v] of Object.entries(s)) db.setSetting(k, v);
  if (s.globalDownloadLimitKB !== undefined || s.globalUploadLimitKB !== undefined) {
    bwMgr.setGlobalLimits(s.globalDownloadLimitKB || 0, s.globalUploadLimitKB || 0);
  }
  if (s.startWithWindows !== undefined || s.startMinimized !== undefined) {
    _applyStartupSetting();
  }
  return { success: true };
});

// History & Categories
ipcMain.handle('history:get',   async () => db.getHistory());
ipcMain.handle('history:clear', async () => { db.clearHistory(); return { success: true }; });
ipcMain.handle('categories:get', async () => db.getCategories());
ipcMain.handle('categories:add', async (_e, n, p) => { db.addCategory(n, p); return { success: true }; });

// File Manager
ipcMain.handle('fm:listDir', async (_e, dir) => {
  try {
    const t = dir || db.getSetting('defaultDownloadPath', path.join(app.getPath('home'), 'Downloads'));
    return { success: true, items: fileMgr.listDirectory(t), currentPath: path.resolve(t) };
  } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('fm:createFolder', async (_e, p) => {
  try { return { success: true, path: fileMgr.createFolder(p) }; } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('fm:renameItem',   async (_e, o, n) => {
  try { return { success: true, path: fileMgr.renameItem(o, n) }; } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('fm:deleteItem',   async (_e, p, perm) => {
  try { return { success: true, result: fileMgr.deleteItem(p, perm) }; } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('fm:openItem',     async (_e, p) => { fileMgr.openItem(p);    return { success: true }; });
ipcMain.handle('fm:showInFolder', async (_e, p) => { fileMgr.showInFolder(p); return { success: true }; });

// Dialogs
ipcMain.handle('dialog:selectFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:selectFile', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Torrent Files', extensions: ['torrent'] }, { name: 'All Files', extensions: ['*'] }]
  });
  return r.canceled ? null : r.filePaths[0];
});

// Diagnostics
ipcMain.handle('diag:get',       async () => diag.getSystemDiagnostics());
ipcMain.handle('diag:export',    async (_e, p) => {
  try { const t = p || path.join(app.getPath('downloads'), 'otc-diag.json'); diag.exportDiagnosticReport(t); return { success: true, path: t }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('diag:logs',      async () => diag.getLogs());
ipcMain.handle('diag:clearLogs', async () => { diag.clearLogs(); return { success: true }; });
ipcMain.handle('net:getDiagnostics', async () => diag.getNetworkDiagnostics());

// Tray / Window Control
ipcMain.handle('tray:showWindow',  async () => { tray.showWindow(); return { success: true }; });
ipcMain.handle('tray:hideWindow',  async () => { if (mainWindow) mainWindow.hide(); return { success: true }; });
ipcMain.handle('tray:getState',    async () => ({ appState: tray.appState, isTrayOnly: tray.isTrayOnly }));
ipcMain.handle('tray:openDownloads', async () => {
  const dlPath = db.getSetting('defaultDownloadPath', path.join(app.getPath('home'), 'Downloads'));
  shell.openPath(dlPath);
  return { success: true };
});

// Terminal & Background Work
ipcMain.handle('terminal:exec',      async (_e, cmd) => termService.executeCommand(cmd));
ipcMain.handle('terminal:getLogs',   async (_e, limit) => termService.getLogs(limit));
ipcMain.handle('terminal:clearLogs', async () => termService.clearLogs());
ipcMain.handle('bg:getStatus',       async () => termService.getBgStatus());
ipcMain.handle('bg:togglePowerSave', async (_e, enable) => {
  termService.setPowerSaveState(enable);
  return { success: true, status: termService.getBgStatus() };
});
