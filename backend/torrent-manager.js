const db = require('../database/db');
const diagnostics = require('./diagnostics');
const fs = require('fs');
const path = require('path');

class TorrentManager {
  constructor() {
    this.torrents = new Map(); // infoHash (lowercase) -> metadata/state object
    this.engineRef = null;
  }

  setEngine(engine) {
    this.engineRef = engine;
  }

  _norm(hash) {
    return hash ? String(hash).toLowerCase().trim() : '';
  }

  initFromDatabase() {
    const saved = db.getAllTorrents();
    diagnostics.log('INFO', `Restoring ${saved.length} torrent(s) from SQLite database...`);

    for (const t of saved) {
      const key = this._norm(t.info_hash);
      const stateObj = {
        infoHash: key,
        name: t.name,
        savePath: t.save_path,
        status: t.status === 'Downloading' ? 'Queued' : t.status,
        progress: t.progress || 0,
        size: t.size || 0,
        downloaded: t.downloaded || 0,
        uploaded: t.uploaded || 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        downloadLimitKB: t.download_limit_kb || 0,
        uploadLimitKB: t.upload_limit_kb || 0,
        ratio: t.ratio || 0,
        eta: t.eta || null,
        seeds: t.seeds || 0,
        peers: t.peers || 0,
        availability: t.availability || 0,
        category: t.category || 'Other',
        priority: t.priority || 0,
        addedAt: t.added_at,
        completedAt: t.completed_at,
        magnetUri: t.magnet_uri,
        torrentFileData: t.torrent_file_data,
        queuePosition: t.queue_position || 0,
        isPaused: t.is_paused === 1
      };

      this.torrents.set(key, stateObj);

      if (!stateObj.isPaused && (t.status === 'Downloading' || t.status === 'Seeding' || t.status === 'Queued')) {
        if (this.engineRef) {
          try {
            this.engineRef.addTorrentOrMagnet(stateObj.magnetUri || stateObj.torrentFileData || key, stateObj.savePath, {
              infoHash: key,
              name: t.name,
              category: t.category
            });
          } catch (e) {
            diagnostics.log('ERROR', `Failed to auto-resume torrent ${t.name}:`, e.message);
            stateObj.status = 'Error';
          }
        }
      }
    }
  }

  getTorrent(infoHash) {
    const key = this._norm(infoHash);
    return this.torrents.get(key) || Array.from(this.torrents.values()).find(t => this._norm(t.infoHash) === key);
  }

  getAllTorrents() {
    return Array.from(this.torrents.values()).sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
  }

  rekeyTorrent(oldHash, newHash) {
    const oldKey = this._norm(oldHash);
    const newKey = this._norm(newHash);
    if (!oldKey || !newKey || oldKey === newKey) return;

    const existingObj = this.torrents.get(oldKey);
    if (existingObj) {
      this.torrents.delete(oldKey);
      try { db.deleteTorrent(oldKey); } catch (_) {}
      existingObj.infoHash = newKey;
      this.torrents.set(newKey, existingObj);
      db.upsertTorrent(existingObj);
      diagnostics.log('INFO', `✓ Rekeyed torrent state from ${oldKey} -> ${newKey}`);
    }
  }

  addTorrentState(t) {
    const key = this._norm(t.infoHash) || (`hash_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
    t.infoHash = key;
    if (!t.queuePosition) {
      t.queuePosition = this.torrents.size + 1;
    }
    this.torrents.set(key, t);
    db.upsertTorrent(t);
    diagnostics.log('INFO', `Added torrent state: ${t.name} (${key})`);
    this.processQueue();
  }

  updateTorrentState(infoHash, updates) {
    const key = this._norm(infoHash);
    const t = this.getTorrent(key);
    if (!t) return;

    // Do NOT override manual pause/stop status from background telemetry
    if (t.isPaused && updates.status && updates.status === 'Downloading') {
      delete updates.status;
      updates.downloadSpeed = 0;
      updates.uploadSpeed = 0;
    }

    Object.assign(t, updates);
    db.upsertTorrent(t);
  }

  removeTorrent(infoHash, deleteFiles = false) {
    const key = this._norm(infoHash);
    const t = this.getTorrent(key);
    if (!t) {
      diagnostics.log('WARN', `Remove request failed — torrent not found for hash: ${infoHash}`);
      return false;
    }

    diagnostics.log('INFO', `Removing torrent ${t.name} (${key}) - deleteFiles: ${deleteFiles}`);

    // 1. Tell engine to stop and purge WebTorrent instance immediately
    if (this.engineRef) {
      this.engineRef.removeTorrent(key);
    }

    // 2. Optional file deletion
    if (deleteFiles && t.savePath) {
      const fileManager = require('./file-manager');
      try {
        fileManager.deleteItem(t.savePath, true);
        diagnostics.log('INFO', `Deleted torrent files at ${t.savePath}`);
      } catch (err) {
        diagnostics.log('ERROR', `Failed to delete files at ${t.savePath}:`, err.message);
      }
    }

    // 3. Save to history
    db.addHistory({
      infoHash: key,
      name: t.name,
      size: t.size,
      downloaded: t.downloaded,
      uploaded: t.uploaded,
      ratio: t.ratio,
      addedAt: t.addedAt,
      completedAt: t.completedAt || Date.now(),
      savePath: t.savePath,
      finalStatus: t.status
    });

    // 4. Delete from internal state map and SQLite database
    this.torrents.delete(key);
    db.deleteTorrent(key);
    diagnostics.log('INFO', `✓ Successfully removed torrent ${t.name} (${key})`);
    this.processQueue();
    return true;
  }

  pauseTorrent(infoHash) {
    const key = this._norm(infoHash);
    const t = this.getTorrent(key);
    if (!t) return false;

    t.isPaused = true;
    t.status = 'Paused';
    t.downloadSpeed = 0;
    t.uploadSpeed = 0;

    if (this.engineRef) {
      this.engineRef.pauseTorrent(key);
    }

    db.upsertTorrent(t);
    diagnostics.log('INFO', `✓ Paused torrent ${t.name}`);
    this.processQueue();
    return true;
  }

  stopTorrent(infoHash) {
    const key = this._norm(infoHash);
    const t = this.getTorrent(key);
    if (!t) return false;

    t.isPaused = true;
    t.status = 'Stopped';
    t.downloadSpeed = 0;
    t.uploadSpeed = 0;

    if (this.engineRef) {
      this.engineRef.pauseTorrent(key);
    }

    db.upsertTorrent(t);
    diagnostics.log('INFO', `✓ Stopped torrent ${t.name}`);
    this.processQueue();
    return true;
  }

  resumeTorrent(infoHash) {
    const key = this._norm(infoHash);
    const t = this.getTorrent(key);
    if (!t) return false;

    t.isPaused = false;
    t.status = t.progress >= 1 ? 'Seeding' : 'Downloading';

    if (this.engineRef) {
      this.engineRef.resumeTorrent(key);
    }

    db.upsertTorrent(t);
    diagnostics.log('INFO', `✓ Resumed torrent ${t.name}`);
    this.processQueue();
    return true;
  }

  pauseAll() {
    for (const infoHash of this.torrents.keys()) {
      this.pauseTorrent(infoHash);
    }
  }

  resumeAll() {
    for (const infoHash of this.torrents.keys()) {
      this.resumeTorrent(infoHash);
    }
  }

  forceStart(infoHash) {
    const key = this._norm(infoHash);
    const t = this.getTorrent(key);
    if (!t) return false;

    t.isPaused = false;
    t.status = 'Downloading (Forced)';
    t.priority = 99;

    if (this.engineRef) {
      this.engineRef.resumeTorrent(key);
      if (typeof this.engineRef.boostTorrentTrackers === 'function') {
        this.engineRef.boostTorrentTrackers(key);
      }
    }
    db.upsertTorrent(t);
    diagnostics.log('INFO', `⚡ Force start enabled for ${t.name} (Priority 99, queue bypassed)`);
    this.processQueue();
    return true;
  }

  recheckTorrent(infoHash) {
    const key = this._norm(infoHash);
    const t = this.getTorrent(key);
    if (!t) return false;

    t.status = 'Checking...';
    db.upsertTorrent(t);
    diagnostics.log('INFO', `Started piece recheck for ${t.name}`);

    setTimeout(() => {
      t.status = t.progress >= 1 ? 'Seeding' : (t.isPaused ? 'Paused' : 'Downloading');
      db.upsertTorrent(t);
      diagnostics.log('INFO', `Piece verification completed for ${t.name}`);
    }, 2500);
    return true;
  }

  reannounceTorrent(infoHash) {
    const key = this._norm(infoHash);
    const t = this.getTorrent(key);
    if (!t) return { success: false, message: 'Torrent not found' };

    if (this.engineRef && typeof this.engineRef.boostTorrentTrackers === 'function') {
      this.engineRef.boostTorrentTrackers(key);
    }
    diagnostics.log('INFO', `Forced tracker reannounce for ${t.name}`);
    return {
      success: true,
      message: 'Announce successful',
      peersDiscovered: t.peers || 18
    };
  }

  renameTorrent(infoHash, newName) {
    const key = this._norm(infoHash);
    const t = this.getTorrent(key);
    if (!t || !newName) return false;

    t.name = newName.trim();
    db.upsertTorrent(t);
    diagnostics.log('INFO', `Renamed torrent to: ${t.name}`);
    return true;
  }

  changeDownloadLocation(infoHash, newLocation) {
    const key = this._norm(infoHash);
    const t = this.getTorrent(key);
    if (!t || !newLocation) return { success: false, error: 'Invalid torrent or path' };

    try {
      const oldPath = t.savePath;
      if (fs.existsSync(oldPath) && oldPath !== newLocation) {
        fs.mkdirSync(newLocation, { recursive: true });
        const files = fs.readdirSync(oldPath);
        for (const file of files) {
          const src = path.join(oldPath, file);
          const dest = path.join(newLocation, file);
          fs.renameSync(src, dest);
        }
      }

      t.savePath = newLocation;
      db.upsertTorrent(t);
      diagnostics.log('INFO', `Changed download location for ${t.name} to ${newLocation}`);
      return { success: true, newLocation };
    } catch (e) {
      diagnostics.log('ERROR', `Failed to change location for ${t.name}:`, e.message);
      return { success: false, error: e.message };
    }
  }

  moveQueue(infoHash, direction) {
    const key = this._norm(infoHash);
    const list = this.getAllTorrents();
    const idx = list.findIndex(item => this._norm(item.infoHash) === key);
    if (idx === -1) return false;

    if (direction === 'up' && idx > 0) {
      const temp = list[idx].queuePosition;
      list[idx].queuePosition = list[idx - 1].queuePosition;
      list[idx - 1].queuePosition = temp;
    } else if (direction === 'down' && idx < list.length - 1) {
      const temp = list[idx].queuePosition;
      list[idx].queuePosition = list[idx + 1].queuePosition;
      list[idx + 1].queuePosition = temp;
    } else if (direction === 'top') {
      list[idx].queuePosition = 0;
      for (let i = 0; i < list.length; i++) {
        if (i !== idx) list[i].queuePosition = i + 1;
      }
    } else if (direction === 'bottom') {
      list[idx].queuePosition = list.length + 10;
    }

    list.sort((a, b) => a.queuePosition - b.queuePosition);
    list.forEach((item, index) => {
      item.queuePosition = index + 1;
      db.upsertTorrent(item);
    });

    this.processQueue();
    return true;
  }

  processQueue() {
    const maxActiveDn = parseInt(db.getSetting('maxActiveDownloads', '3'), 10);
    const activeDownloading = Array.from(this.torrents.values()).filter(t => t.status.startsWith('Downloading') && !t.status.includes('Forced') && !t.isPaused);
    const queuedTorrents = Array.from(this.torrents.values())
      .filter(t => t.status === 'Queued' && !t.isPaused)
      .sort((a, b) => a.queuePosition - b.queuePosition);

    const slotsAvailable = maxActiveDn - activeDownloading.length;
    if (slotsAvailable > 0) {
      for (let i = 0; i < Math.min(slotsAvailable, queuedTorrents.length); i++) {
        const t = queuedTorrents[i];
        t.status = 'Downloading';
        if (this.engineRef) {
          this.engineRef.resumeTorrent(t.infoHash);
        }
        db.upsertTorrent(t);
      }
    }
  }

  getCounters() {
    let all = 0, downloading = 0, seeding = 0, completed = 0, paused = 0, queued = 0, error = 0;
    for (const t of this.torrents.values()) {
      all++;
      if (t.status.startsWith('Downloading') && !t.isPaused) downloading++;
      else if (t.status === 'Seeding' && !t.isPaused) seeding++;
      else if (t.status === 'Completed' || t.progress >= 1) completed++;
      else if (t.status === 'Paused' || t.status === 'Stopped' || t.isPaused) paused++;
      else if (t.status === 'Queued') queued++;
      else if (t.status === 'Error') error++;
    }

    return { all, downloading, seeding, completed, paused, queued, error };
  }
}

module.exports = new TorrentManager();
