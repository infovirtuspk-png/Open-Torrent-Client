const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.isInitialized = false;
  }

  async init(userDataPath) {
    if (this.isInitialized) return;

    this.dbPath = path.join(userDataPath, 'opentorrentclient.sqlite');

    // Resolve sql-wasm.wasm for all environments:
    // 1. Installed app  → extraResources copies it to process.resourcesPath
    // 2. Packaged (asarUnpack) → node_modules.asar.unpacked/sql.js/dist/
    // 3. Dev             → normal node_modules resolution
    let wasmPath = '';
    const isPackaged = process.env.NODE_ENV !== 'development' && require('electron').app?.isPackaged;

    if (isPackaged) {
      // First try: extraResources location (most reliable in installed app)
      const extraResPath = path.join(process.resourcesPath, 'sql-wasm.wasm');
      const asarUnpackPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      const asarUnpackPath2 = path.join(path.dirname(process.execPath), 'resources', 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

      if (require('fs').existsSync(extraResPath)) {
        wasmPath = extraResPath;
      } else if (require('fs').existsSync(asarUnpackPath)) {
        wasmPath = asarUnpackPath;
      } else if (require('fs').existsSync(asarUnpackPath2)) {
        wasmPath = asarUnpackPath2;
      } else {
        wasmPath = extraResPath; // fallback
      }
    } else {
      // Development: use require.resolve
      try {
        wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
      } catch (_) {
        wasmPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      }
    }

    const SQL = await initSqlJs({
      locateFile: () => wasmPath
    });

    if (fs.existsSync(this.dbPath)) {
      const filebuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(filebuffer);
    } else {
      this.db = new SQL.Database();
      this.saveToDisk();
    }

    this.runMigrations();
    this.isInitialized = true;
    console.log('[Database] SQLite database initialized successfully at', this.dbPath);
  }

  saveToDisk() {
    if (!this.db || !this.dbPath) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const tempPath = this.dbPath + '.tmp';
      fs.writeFileSync(tempPath, buffer);
      fs.renameSync(tempPath, this.dbPath);
    } catch (err) {
      console.error('[Database] Failed to save database to disk:', err);
    }
  }

  runMigrations() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS torrents (
        info_hash TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        save_path TEXT NOT NULL,
        status TEXT NOT NULL,
        progress REAL DEFAULT 0,
        size INTEGER DEFAULT 0,
        downloaded INTEGER DEFAULT 0,
        uploaded INTEGER DEFAULT 0,
        download_speed INTEGER DEFAULT 0,
        upload_speed INTEGER DEFAULT 0,
        ratio REAL DEFAULT 0,
        eta INTEGER DEFAULT 0,
        seeds INTEGER DEFAULT 0,
        peers INTEGER DEFAULT 0,
        availability REAL DEFAULT 0,
        category TEXT DEFAULT 'Other',
        priority INTEGER DEFAULT 0,
        added_at INTEGER NOT NULL,
        completed_at INTEGER,
        magnet_uri TEXT,
        torrent_file_data TEXT,
        queue_position INTEGER DEFAULT 0,
        is_paused INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS torrent_files (
        id TEXT PRIMARY KEY,
        info_hash TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        size INTEGER NOT NULL,
        downloaded INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'normal',
        FOREIGN KEY(info_hash) REFERENCES torrents(info_hash) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS torrent_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        info_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        downloaded INTEGER NOT NULL,
        uploaded INTEGER NOT NULL,
        ratio REAL NOT NULL,
        added_at INTEGER NOT NULL,
        completed_at INTEGER NOT NULL,
        save_path TEXT NOT NULL,
        final_status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        save_path TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        download_limit_kb INTEGER NOT NULL,
        upload_limit_kb INTEGER NOT NULL,
        enabled INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS daily_statistics (
        date TEXT PRIMARY KEY,
        downloaded_bytes INTEGER DEFAULT 0,
        uploaded_bytes INTEGER DEFAULT 0,
        active_time_sec INTEGER DEFAULT 0
      );
    `);

    // Insert default settings if empty or missing
    const defaultSettings = [
      // Paths & Engine
      ['defaultDownloadPath', path.join(require('os').homedir(), 'Downloads')],
      ['maxActiveDownloads', '3'],
      ['maxActiveUploads', '5'],
      ['globalDownloadLimitKB', '0'],
      ['globalUploadLimitKB', '0'],
      ['dhtEnabled', 'true'],
      ['pexEnabled', 'true'],
      ['port', '6881'],
      // UI & Theme
      ['theme', 'dark'],
      // System Tray
      ['minimizeToTray', 'true'],
      ['closeToTray', 'true'],
      ['showCloseToTrayNotif', 'true'],
      ['startWithWindows', 'false'],
      ['startMinimized', 'false'],
      ['startInTray', 'false'],
      ['restoreTorrentStates', 'true'],
      // Notifications
      ['enableNotifications', 'true'],
      ['notifTorrentAdded', 'true'],
      ['notifDownloadComplete', 'true'],
      ['notifTorrentError', 'true'],
      ['notifMetadataReceived', 'true'],
      ['notifTrackerError', 'false'],
      ['notifSeedingStarted', 'false'],
      ['notifCloseToTray', 'true'],
      // Clipboard & Capture
      ['detectClipboardMagnet', 'true'],
      ['captureMode', 'ask'],
      ['registerMagnetHandler', 'true'],
      ['associateTorrentFiles', 'true'],
      ['captureHistoryEnabled', 'true'],
      // Power Management
      ['preventSleepDownloading', 'false'],
      ['preventSleepSeeding', 'false'],
      ['pauseOnMetered', 'false'],
      ['pauseBelowBattery', '0']
    ];

    for (const [key, defaultVal] of defaultSettings) {
      const current = this.getSetting(key);
      if (current === null) {
        this.setSetting(key, defaultVal);
      }
    }

    // Insert default categories if empty
    const catStmt = this.db.prepare("SELECT COUNT(*) as count FROM categories");
    if (catStmt.step()) {
      const catRes = catStmt.getAsObject();
      if (catRes.count === 0) {
        const defaultPath = path.join(require('os').homedir(), 'Downloads');
        this.db.run("INSERT INTO categories (name, save_path) VALUES (?, ?)", ['Linux', path.join(defaultPath, 'Linux')]);
        this.db.run("INSERT INTO categories (name, save_path) VALUES (?, ?)", ['Software', path.join(defaultPath, 'Software')]);
        this.db.run("INSERT INTO categories (name, save_path) VALUES (?, ?)", ['Documents', path.join(defaultPath, 'Documents')]);
        this.db.run("INSERT INTO categories (name, save_path) VALUES (?, ?)", ['Media', path.join(defaultPath, 'Media')]);
        this.db.run("INSERT INTO categories (name, save_path) VALUES (?, ?)", ['Other', defaultPath]);
      }
    }
    catStmt.free();

    this.saveToDisk();
  }

  // --- Setting Operations ---
  getSetting(key, defaultValue = null) {
    if (!this.db) return defaultValue;
    const stmt = this.db.prepare("SELECT value FROM settings WHERE key = ?");
    stmt.bind([key]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row.value;
    }
    stmt.free();
    return defaultValue;
  }

  setSetting(key, value) {
    if (!this.db) return;
    this.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, String(value)]);
    this.saveToDisk();
  }

  getAllSettings() {
    if (!this.db) return {};
    const settings = {};
    const stmt = this.db.prepare("SELECT key, value FROM settings");
    while (stmt.step()) {
      const row = stmt.getAsObject();
      settings[row.key] = row.value;
    }
    stmt.free();
    return settings;
  }

  // --- Torrent Operations ---
  upsertTorrent(t) {
    if (!this.db) return;
    this.db.run(`
      INSERT OR REPLACE INTO torrents (
        info_hash, name, save_path, status, progress, size, downloaded, uploaded,
        download_speed, upload_speed, ratio, eta, seeds, peers, availability,
        category, priority, added_at, completed_at, magnet_uri, torrent_file_data,
        queue_position, is_paused
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      t.infoHash, t.name, t.savePath, t.status, t.progress || 0, t.size || 0,
      t.downloaded || 0, t.uploaded || 0, t.downloadSpeed || 0, t.uploadSpeed || 0,
      t.ratio || 0, t.eta || 0, t.seeds || 0, t.peers || 0, t.availability || 0,
      t.category || 'Other', t.priority || 0, t.addedAt || Date.now(),
      t.completedAt || null, t.magnetUri || null, t.torrentFileData || null,
      t.queuePosition || 0, t.isPaused ? 1 : 0
    ]);
    this.saveToDisk();
  }

  getTorrent(infoHash) {
    if (!this.db) return null;
    const stmt = this.db.prepare("SELECT * FROM torrents WHERE info_hash = ?");
    stmt.bind([infoHash]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  getAllTorrents() {
    if (!this.db) return [];
    const list = [];
    const stmt = this.db.prepare("SELECT * FROM torrents ORDER BY queue_position ASC, added_at DESC");
    while (stmt.step()) {
      list.push(stmt.getAsObject());
    }
    stmt.free();
    return list;
  }

  deleteTorrent(infoHash) {
    if (!this.db) return;
    this.db.run("DELETE FROM torrent_files WHERE info_hash = ?", [infoHash]);
    this.db.run("DELETE FROM torrents WHERE info_hash = ?", [infoHash]);
    this.saveToDisk();
  }

  // --- Torrent File Priorities ---
  saveTorrentFiles(infoHash, files) {
    if (!this.db) return;
    for (const f of files) {
      const id = `${infoHash}:${f.path}`;
      this.db.run(`
        INSERT OR REPLACE INTO torrent_files (id, info_hash, file_path, file_name, size, downloaded, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, infoHash, f.path, f.name, f.length || f.size || 0, f.downloaded || 0, f.priority || 'normal']);
    }
    this.saveToDisk();
  }

  getTorrentFiles(infoHash) {
    if (!this.db) return [];
    const list = [];
    const stmt = this.db.prepare("SELECT * FROM torrent_files WHERE info_hash = ?");
    stmt.bind([infoHash]);
    while (stmt.step()) {
      list.push(stmt.getAsObject());
    }
    stmt.free();
    return list;
  }

  // --- History Operations ---
  addHistory(entry) {
    if (!this.db) return;
    this.db.run(`
      INSERT INTO torrent_history (info_hash, name, size, downloaded, uploaded, ratio, added_at, completed_at, save_path, final_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entry.infoHash, entry.name, entry.size, entry.downloaded, entry.uploaded,
      entry.ratio, entry.addedAt, entry.completedAt || Date.now(), entry.savePath, entry.finalStatus || 'Completed'
    ]);
    this.saveToDisk();
  }

  getHistory() {
    if (!this.db) return [];
    const list = [];
    const stmt = this.db.prepare("SELECT * FROM torrent_history ORDER BY completed_at DESC");
    while (stmt.step()) {
      list.push(stmt.getAsObject());
    }
    stmt.free();
    return list;
  }

  clearHistory() {
    if (!this.db) return;
    this.db.run("DELETE FROM torrent_history");
    this.saveToDisk();
  }

  // --- Categories ---
  getCategories() {
    if (!this.db) return [];
    const list = [];
    const stmt = this.db.prepare("SELECT * FROM categories");
    while (stmt.step()) {
      list.push(stmt.getAsObject());
    }
    stmt.free();
    return list;
  }

  addCategory(name, savePath) {
    if (!this.db) return;
    this.db.run("INSERT OR REPLACE INTO categories (name, save_path) VALUES (?, ?)", [name, savePath]);
    this.saveToDisk();
  }

  // --- Daily Statistics ---
  recordDailyStats(downloadedBytes, uploadedBytes, activeSeconds) {
    if (!this.db) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare("SELECT * FROM daily_statistics WHERE date = ?");
    stmt.bind([dateStr]);
    let existing = { downloaded_bytes: 0, uploaded_bytes: 0, active_time_sec: 0 };
    if (stmt.step()) {
      existing = stmt.getAsObject();
    }
    stmt.free();

    this.db.run(`
      INSERT OR REPLACE INTO daily_statistics (date, downloaded_bytes, uploaded_bytes, active_time_sec)
      VALUES (?, ?, ?, ?)
    `, [
      dateStr,
      existing.downloaded_bytes + downloadedBytes,
      existing.uploaded_bytes + uploadedBytes,
      existing.active_time_sec + activeSeconds
    ]);
    this.saveToDisk();
  }

  getLifetimeStats() {
    if (!this.db) return { totalDownloaded: 0, totalUploaded: 0, activeDays: 0 };
    const stmt = this.db.prepare("SELECT SUM(downloaded_bytes) as total_dn, SUM(uploaded_bytes) as total_up, COUNT(date) as days FROM daily_statistics");
    let stats = { totalDownloaded: 0, totalUploaded: 0, activeDays: 0 };
    if (stmt.step()) {
      const res = stmt.getAsObject();
      stats = {
        totalDownloaded: res.total_dn || 0,
        totalUploaded: res.total_up || 0,
        activeDays: res.days || 0
      };
    }
    stmt.free();
    return stats;
  }
}

module.exports = new DatabaseService();
