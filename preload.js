const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ── Integration & Protocol ──────────────────────────────────────────────────
  testMagnetHandler:      () => ipcRenderer.invoke('integration:test'),
  registerMagnetHandler:  () => ipcRenderer.invoke('integration:register'),
  unregisterMagnetHandler:() => ipcRenderer.invoke('integration:unregister'),
  checkIntegrationStatus: () => ipcRenderer.invoke('integration:check'),

  // ── Torrent Operations ──────────────────────────────────────────────────────
  addTorrent:          (f, sp, o)   => ipcRenderer.invoke('torrent:add', f, sp, o),
  addMagnet:           (u, sp, o)   => ipcRenderer.invoke('torrent:addMagnet', u, sp, o),
  pauseTorrent:        (h)          => ipcRenderer.invoke('torrent:pause', h),
  stopTorrent:         (h)          => ipcRenderer.invoke('torrent:stop', h),
  resumeTorrent:       (h)          => ipcRenderer.invoke('torrent:resume', h),
  removeTorrent:       (h, del)     => ipcRenderer.invoke('torrent:remove', h, del),
  forceStart:          (h)          => ipcRenderer.invoke('torrent:forceStart', h),
  recheckTorrent:      (h)          => ipcRenderer.invoke('torrent:recheck', h),
  reannounceTorrent:   (h)          => ipcRenderer.invoke('torrent:reannounce', h),
  renameTorrent:       (h, n)       => ipcRenderer.invoke('torrent:rename', h, n),
  changeLocation:      (h, loc)     => ipcRenderer.invoke('torrent:changeLocation', h, loc),
  moveQueue:           (h, dir)     => ipcRenderer.invoke('torrent:moveQueue', h, dir),
  pauseAll:            ()           => ipcRenderer.invoke('torrent:pauseAll'),
  resumeAll:           ()           => ipcRenderer.invoke('torrent:resumeAll'),
  setFilePriority:     (h, fp, p)   => ipcRenderer.invoke('torrent:setFilePriority', h, fp, p),
  addTracker:          (h, u)       => ipcRenderer.invoke('torrent:addTracker', h, u),
  addWebSeed:          (h, u)       => ipcRenderer.invoke('torrent:addWebSeed', h, u),
  getTorrentDetails:   (h)          => ipcRenderer.invoke('torrent:getDetails', h),
  getAllTorrents:       ()           => ipcRenderer.invoke('torrent:getAll'),
  getCounters:         ()           => ipcRenderer.invoke('torrent:getCounters'),

  // ── Settings & DB ────────────────────────────────────────────────────────────
  getSettings:         ()           => ipcRenderer.invoke('settings:get'),
  saveSettings:        (s)          => ipcRenderer.invoke('settings:save', s),
  getHistory:          ()           => ipcRenderer.invoke('history:get'),
  clearHistory:        ()           => ipcRenderer.invoke('history:clear'),
  getCategories:       ()           => ipcRenderer.invoke('categories:get'),
  addCategory:         (n, p)       => ipcRenderer.invoke('categories:add', n, p),

  // ── File Manager ──────────────────────────────────────────────────────────────
  listDirectory:       (d)          => ipcRenderer.invoke('fm:listDir', d),
  createFolder:        (p)          => ipcRenderer.invoke('fm:createFolder', p),
  renameItem:          (o, n)       => ipcRenderer.invoke('fm:renameItem', o, n),
  deleteItem:          (p, perm)    => ipcRenderer.invoke('fm:deleteItem', p, perm),
  openItem:            (p)          => ipcRenderer.invoke('fm:openItem', p),
  showInFolder:        (p)          => ipcRenderer.invoke('fm:showInFolder', p),
  selectFolderDialog:  ()           => ipcRenderer.invoke('dialog:selectFolder'),
  selectFileDialog:    ()           => ipcRenderer.invoke('dialog:selectFile'),

  // ── Diagnostics ───────────────────────────────────────────────────────────────
  getDiagnostics:      ()           => ipcRenderer.invoke('diag:get'),
  exportDiagnostics:   (p)          => ipcRenderer.invoke('diag:export', p),
  getLogs:             ()           => ipcRenderer.invoke('diag:logs'),
  clearLogs:           ()           => ipcRenderer.invoke('diag:clearLogs'),
  getNetworkDiagnostics:()          => ipcRenderer.invoke('net:getDiagnostics'),

  // ── Tray / Window Control ─────────────────────────────────────────────────────
  showWindow:          ()           => ipcRenderer.invoke('tray:showWindow'),
  hideWindow:          ()           => ipcRenderer.invoke('tray:hideWindow'),
  getTrayState:        ()           => ipcRenderer.invoke('tray:getState'),
  openDownloadsFolder: ()           => ipcRenderer.invoke('tray:openDownloads'),

  // ── Integrated Terminal & Background Work ──────────────────────────────────────
  execTerminalCmd:     (cmd)        => ipcRenderer.invoke('terminal:exec', cmd),
  getTerminalLogs:     (limit)      => ipcRenderer.invoke('terminal:getLogs', limit),
  clearTerminalLogs:   ()           => ipcRenderer.invoke('terminal:clearLogs'),
  getBgStatus:         ()           => ipcRenderer.invoke('bg:getStatus'),
  toggleBgPowerSave:   (enable)     => ipcRenderer.invoke('bg:togglePowerSave', enable),

  // ── Event Subscriptions ───────────────────────────────────────────────────────
  onEvent: (channel, callback) => {
    const validChannels = [
      'realtime_stats', 'metadata_received', 'download_completed',
      'torrent_error', 'magnet_detected', 'magnet_preview_prompt',
      'magnet_duplicate', 'magnet_added', 'capture_error',
      'shortcut_trigger', 'tray_only_mode',
      'terminal_log', 'terminal_log_cleared', 'terminal_output'
    ];
    if (!validChannels.includes(channel)) return;
    const listener = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
