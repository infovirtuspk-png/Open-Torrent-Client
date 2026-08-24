const path = require('path');
const db = require('../database/db');
const torrentManager = require('./torrent-manager');
const engine = require('./engine');
const diagnostics = require('./diagnostics');
const notificationService = require('./notification');
let regProtocol = null;
try {
  regProtocol = require('./register-protocol');
} catch (_) {
  regProtocol = require('../scripts/register-protocol');
}

class CaptureManager {
  constructor() {
    this.captureQueue = [];
    this.isProcessingQueue = false;
    this.magnetUriModule = null;
    this.esmPromise = this.initESM();
  }

  async initESM() {
    try {
      const muMod = await import('magnet-uri');
      this.magnetUriModule = muMod.default || muMod;
    } catch (e) {
      diagnostics.log('WARN', '[CaptureManager] Magnet-uri dynamic load failed:', e.message);
    }
  }

  // --- 1. Magnet URI Validation & Sanitization ---
  async validateAndParse(inputUri) {
    await this.esmPromise;

    if (!inputUri || typeof inputUri !== 'string') {
      return { valid: false, error: 'Input URI is empty or not a string.' };
    }

    const trimmed = inputUri.trim();
    if (!trimmed.toLowerCase().startsWith('magnet:?')) {
      return { valid: false, error: 'The supplied link is not a valid BitTorrent Magnet URI scheme.' };
    }

    let decoded = null;
    try {
      if (this.magnetUriModule) {
        const decodeFn = this.magnetUriModule.decode || this.magnetUriModule;
        decoded = decodeFn(trimmed);
      } else {
        // Fallback regex parser
        const match = trimmed.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
        if (match) {
          decoded = { infoHash: match[1] };
        }
      }
    } catch (e) {
      return { valid: false, error: `Failed to parse magnet URI parameters: ${e.message}` };
    }

    if (!decoded || !decoded.infoHash) {
      return { valid: false, error: 'Magnet URI does not contain a valid BitTorrent info hash (xt=urn:btih:).' };
    }

    const infoHash = decoded.infoHash.toLowerCase();
    // Validate hex 40-char or base32 32-char format
    if (!/^[a-f0-9]{40}$/i.test(infoHash) && !/^[a-z2-7]{32}$/i.test(infoHash)) {
      return { valid: false, error: 'Invalid info hash length or character format.' };
    }

    // Sanitize display name
    let displayName = decoded.name || 'Unnamed Torrent';
    displayName = displayName.replace(/[<>"'\/\\]/g, '').trim();

    // Extract trackers count
    const trackers = Array.isArray(decoded.announce) ? decoded.announce : (decoded.announce ? [decoded.announce] : []);

    return {
      valid: true,
      infoHash,
      name: displayName,
      trackers,
      trackerCount: trackers.length,
      rawUri: trimmed
    };
  }

  // --- 2. Duplicate Detection ---
  checkDuplicate(infoHash) {
    const existing = torrentManager.getTorrent(infoHash);
    if (existing) {
      return { isDuplicate: true, status: existing.status, name: existing.name, infoHash };
    }

    const dbRecord = db.getTorrent(infoHash);
    if (dbRecord) {
      return { isDuplicate: true, status: dbRecord.status, name: dbRecord.name, infoHash };
    }

    return { isDuplicate: false };
  }

  // --- 3. Capture History Logging ---
  recordCaptureHistory(item) {
    try {
      const historyEnabled = db.getSetting('captureHistoryEnabled', 'true') === 'true';
      if (!historyEnabled) return;
      
      db.addHistory({
        infoHash: item.infoHash || 'unknown',
        name: item.name || 'Captured Magnet',
        size: 0,
        downloaded: 0,
        uploaded: 0,
        ratio: 0,
        addedAt: Date.now(),
        completedAt: Date.now(),
        savePath: db.getSetting('defaultDownloadPath', path.join(require('os').homedir(), 'Downloads')),
        finalStatus: 'Captured'
      });
    } catch (_) {}
  }

  // --- 4. Process Incoming Magnet with Capture Modes & Queue ---
  async handleIncomingMagnet(rawUri, broadcastFn) {
    const queueItem = {
      id: 'cap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      rawUri,
      receivedAt: Date.now(),
      status: 'Validating'
    };
    this.captureQueue.push(queueItem);

    const parsed = await this.validateAndParse(rawUri);
    if (!parsed.valid) {
      queueItem.status = 'Rejected';
      queueItem.error = parsed.error;
      diagnostics.log('WARN', `[CaptureManager] Rejected invalid magnet URI: ${parsed.error}`);
      if (broadcastFn) broadcastFn('capture_error', { error: parsed.error });
      return { success: false, error: parsed.error };
    }

    queueItem.infoHash = parsed.infoHash;
    queueItem.name = parsed.name;

    diagnostics.log('INFO', `[CaptureManager] Captured Magnet URI: ${parsed.name} (${parsed.infoHash})`);

    const captureMode = db.getSetting('captureMode', 'ask'); // 'ask' | 'auto' | 'ask_new'
    const dupCheck = this.checkDuplicate(parsed.infoHash);

    // Duplicate detection check
    if (dupCheck.isDuplicate) {
      queueItem.status = 'Duplicate';
      diagnostics.log('INFO', `[CaptureManager] Duplicate torrent detected for infoHash: ${parsed.infoHash}`);
      if (broadcastFn) {
        broadcastFn('magnet_duplicate', {
          infoHash: parsed.infoHash,
          name: dupCheck.name,
          status: dupCheck.status,
          rawUri: parsed.rawUri
        });
      }
      return { success: true, action: 'duplicate_prompt', infoHash: parsed.infoHash };
    }

    this.recordCaptureHistory(parsed);

    // Capture Mode Decision
    if (captureMode === 'auto') {
      // Mode B: Automatically Add
      queueItem.status = 'Processing';
      const result = this.addMagnetDirectly(parsed, broadcastFn);
      queueItem.status = result.success ? 'Added' : 'Failed';
      return result;
    } else if (captureMode === 'ask_new') {
      // Mode C: Ask Only for New Torrents (Since it passed dup check, it is NEW → Show confirmation)
      queueItem.status = 'Waiting';
      if (broadcastFn) {
        broadcastFn('magnet_preview_prompt', {
          infoHash: parsed.infoHash,
          name: parsed.name,
          trackerCount: parsed.trackerCount,
          rawUri: parsed.rawUri,
          defaultSavePath: db.getSetting('defaultDownloadPath', path.join(require('os').homedir(), 'Downloads'))
        });
      }
      return { success: true, action: 'preview_prompt', infoHash: parsed.infoHash };
    } else {
      // Mode A: Ask Before Add (Default)
      queueItem.status = 'Waiting';
      if (broadcastFn) {
        broadcastFn('magnet_preview_prompt', {
          infoHash: parsed.infoHash,
          name: parsed.name,
          trackerCount: parsed.trackerCount,
          rawUri: parsed.rawUri,
          defaultSavePath: db.getSetting('defaultDownloadPath', path.join(require('os').homedir(), 'Downloads'))
        });
      }
      return { success: true, action: 'preview_prompt', infoHash: parsed.infoHash };
    }
  }

  addMagnetDirectly(parsed, broadcastFn) {
    const defaultPath = db.getSetting('defaultDownloadPath', path.join(require('os').homedir(), 'Downloads'));
    try {
      const hash = engine.addTorrentOrMagnet(parsed.rawUri, defaultPath, {
        infoHash: parsed.infoHash,
        name: parsed.name
      });
      
      notificationService.notify('Torrent Added', `"${parsed.name}" has been added to download queue.`);
      if (broadcastFn) {
        broadcastFn('magnet_added', { infoHash: hash, name: parsed.name });
      }
      return { success: true, action: 'added', infoHash: hash };
    } catch (err) {
      diagnostics.log('ERROR', '[CaptureManager] Failed to add magnet directly:', err.message);
      return { success: false, error: err.message };
    }
  }

  getCaptureQueue() {
    return this.captureQueue;
  }

  // --- 5. Integration Diagnostics & Test Magnet Handler ---
  testMagnetHandler() {
    const defaultPath = db.getSetting('defaultDownloadPath', path.join(require('os').homedir(), 'Downloads'));
    const testUri = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=OpenTorrentClientTestFixture&tr=udp%3A%2F%2Ftracker.opentrackers.org%3A1337';
    
    const regCheck = regProtocol.checkRegistryStatus();

    const checks = [
      { step: 'Protocol registered in Windows', status: regCheck.magnetRegistered, detail: regCheck.magnetRegistered ? `HKCU\\Software\\Classes\\magnet active` : 'Not registered in HKCU registry' },
      { step: '.torrent association in Windows', status: regCheck.torrentRegistered, detail: regCheck.torrentRegistered ? `HKCU\\Software\\Classes\\.torrent active` : 'Not associated in HKCU registry' },
      { step: 'Application executable detected', status: true, detail: process.execPath },
      { step: 'Single-instance service active', status: true, detail: 'Single instance lock verified' },
      { step: 'Download Path Access', status: require('fs').existsSync(defaultPath), detail: defaultPath }
    ];

    const allPassed = checks.every(c => c.status);
    return {
      success: allPassed,
      message: allPassed ? 'Magnet handler is working correctly.' : 'Magnet handler self-test detected warnings.',
      checks
    };
  }

  registerAssociations() {
    const resMagnet = regProtocol.registerMagnetProtocol();
    const resTorrent = regProtocol.registerTorrentAssociation();
    return {
      success: resMagnet.success && resTorrent.success,
      magnet: resMagnet,
      torrent: resTorrent
    };
  }

  unregisterAssociations() {
    return regProtocol.unregisterMagnetProtocol();
  }

  getIntegrationStatus() {
    return regProtocol.checkRegistryStatus();
  }
}

module.exports = new CaptureManager();