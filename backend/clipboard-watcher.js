const { clipboard } = require('electron');
const db = require('../database/db');

class ClipboardWatcher {
  constructor() {
    this.timer = null;
    this.lastText = '';
    this.onMagnetFound = null;
  }

  start(callback) {
    this.onMagnetFound = callback;
    if (this.timer) clearInterval(this.timer);

    this.timer = setInterval(() => {
      const enabled = db.getSetting('detectClipboardMagnet', 'true') === 'true';
      if (!enabled) return;

      try {
        const text = clipboard.readText();
        if (text && text !== this.lastText) {
          this.lastText = text;
          if (text.trim().startsWith('magnet:?xt=urn:btih:')) {
            if (this.onMagnetFound) {
              this.onMagnetFound(text.trim());
            }
          }
        }
      } catch (err) {
        // Ignore clipboard access errors
      }
    }, 2000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = new ClipboardWatcher();
