export class SettingsUI {
  constructor() {
    this.form = document.getElementById('settingsForm');
    this.init();
  }

  async init() {
    if (!this.form) return;
    this._bindSubNavTabs();
    await this.loadSettings();
    this._bindFormSubmit();
    this._bindIntegrationButtons();
    this.updateIntegrationStatusDisplay();
  }

  // ─── Sub-Nav Tab Navigation ────────────────────────────────────────────────
  _bindSubNavTabs() {
    const tabs = document.querySelectorAll('.settings-tab-btn[data-settings-tab]');
    const panes = document.querySelectorAll('.settings-tab-pane');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-settings-tab');

        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');
      });
    });
  }

  // ─── Save ───────────────────────────────────────────────────────────────────
  _bindFormSubmit() {
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const get   = (id) => document.getElementById(id);
      const chk   = (id) => (get(id)?.checked ? 'true' : 'false');
      const val   = (id) => get(id)?.value || '';
      const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || '';

      const settings = {
        // General
        detectClipboardMagnet: chk('setDetectClipboard'),
        theme:                 val('setTheme'),
        // Tray
        minimizeToTray:        chk('setMinimizeToTray'),
        closeToTray:           chk('setCloseToTray'),
        showCloseToTrayNotif:  chk('setShowCloseToTrayNotif'),
        startWithWindows:      chk('setStartWithWindows'),
        startMinimized:        chk('setStartMinimized'),
        startInTray:           chk('setStartInTray'),
        restoreTorrentStates:  chk('setRestoreStates'),
        // Capture
        captureMode:           radio('radioCaptureMode'),
        // Notifications
        enableNotifications:   chk('setEnableNotifications'),
        notifTorrentAdded:     chk('setNotifAdded'),
        notifDownloadComplete: chk('setNotifComplete'),
        notifTorrentError:     chk('setNotifError'),
        notifMetadataReceived: chk('setNotifMeta'),
        notifTrackerError:     chk('setNotifTracker'),
        notifSeedingStarted:   chk('setNotifSeeding'),
        // Bandwidth
        globalDownloadLimitKB: val('setGlobalDnLimit'),
        globalUploadLimitKB:   val('setGlobalUpLimit'),
        maxActiveDownloads:    val('setMaxActiveDn'),
        // Power
        preventSleepDownloading: chk('setPrevSleepDn'),
        preventSleepSeeding:     chk('setPrevSleepSeed'),
        pauseOnMetered:          chk('setPauseMetered')
      };

      const res = await window.api.saveSettings(settings);
      if (res.success) {
        document.documentElement.setAttribute('data-theme', settings.theme);
        this._showToast('Settings saved successfully!', 'success');
      } else {
        this._showToast('Failed to save settings.', 'error');
      }
    });
  }

  // ─── Integration Test & Register Buttons ────────────────────────────────────
  _bindIntegrationButtons() {
    const btnTest = document.getElementById('btnTestIntegration');
    if (btnTest) {
      btnTest.addEventListener('click', async () => {
        const report = await window.api.testMagnetHandler();
        const el = document.getElementById('integrationTestReport');
        if (el) {
          el.style.display = 'block';
          el.innerHTML = `
            <strong class="${report.success ? 'text-success' : 'text-warning'}">${report.message}</strong>
            <ul class="mb-0 ps-3 mt-1">
              ${report.checks.map(c =>
                `<li>${c.status ? '✔' : '✖'} ${c.step} — <span class="text-muted">${c.detail}</span></li>`
              ).join('')}
            </ul>
          `;
        }
      });
    }

    const btnRegister = document.getElementById('btnRegisterAssociations');
    if (btnRegister) {
      btnRegister.addEventListener('click', async () => {
        await window.api.registerMagnetHandler();
        this._showToast('Windows Magnet Protocol & .torrent associations registered!', 'success');
        await this.updateIntegrationStatusDisplay();
      });
    }

    const btnUnregister = document.getElementById('btnUnregisterAssociations');
    if (btnUnregister) {
      btnUnregister.addEventListener('click', async () => {
        if (window.api.unregisterMagnetHandler) {
          await window.api.unregisterMagnetHandler();
          this._showToast('Windows Magnet Protocol association reset.', 'warning');
          await this.updateIntegrationStatusDisplay();
        }
      });
    }

    const btnOpenDownloads = document.getElementById('btnOpenDownloadsFolder');
    if (btnOpenDownloads) {
      btnOpenDownloads.addEventListener('click', () => window.api.openDownloadsFolder());
    }

    const btnNetTest = document.getElementById('btnTestNetworkConnectivity');
    if (btnNetTest) {
      btnNetTest.addEventListener('click', async () => {
        if (window.api.getNetworkDiagnostics) {
          const diag = await window.api.getNetworkDiagnostics();
          const report = `=======================================\nNETWORK & PORT CONNECTIVITY DIAGNOSTICS\n=======================================\nHostname      : ${diag.hostname}\nListening Port: ${diag.listeningPort} (BitTorrent TCP/UDP)\nDHT Network   : ${diag.dhtStatus}\nDownload Limit: ${diag.downloadLimitKB > 0 ? diag.downloadLimitKB + ' KB/s' : 'Unlimited'}\nUpload Limit  : ${diag.uploadLimitKB > 0 ? diag.uploadLimitKB + ' KB/s' : 'Unlimited'}\n\nActive Network Interfaces:\n` +
            diag.activeNetworkInterfaces.map(i => ` - ${i.interface}: ${i.ip} (MAC: ${i.mac})`).join('\n');
          alert(report);
        }
      });
    }
  }

  async updateIntegrationStatusDisplay() {
    try {
      const status = await window.api.checkIntegrationStatus();
      const badge = document.getElementById('badgeMagnetRegStatus');
      const protoTxt = document.getElementById('statusMagnetProtoText');
      const assocTxt = document.getElementById('statusTorrentAssocText');

      if (badge) {
        if (status.isDefaultMagnet) {
          badge.className = 'badge bg-success px-2 py-1';
          badge.textContent = '● Magnet: Registered';
        } else {
          badge.className = 'badge bg-warning text-dark px-2 py-1';
          badge.textContent = '⚠ Magnet: Not Default';
        }
      }

      if (protoTxt) {
        protoTxt.textContent = status.isDefaultMagnet ? 'Active (HKCU)' : 'Not Associated';
        protoTxt.className = status.isDefaultMagnet ? 'text-success' : 'text-warning';
      }

      if (assocTxt) {
        assocTxt.textContent = status.isDefaultTorrent ? 'Active (HKCU)' : 'Not Associated';
        assocTxt.className = status.isDefaultTorrent ? 'text-success' : 'text-warning';
      }
    } catch (_) {}
  }

  // ─── Load Settings from DB ───────────────────────────────────────────────────
  async loadSettings() {
    const s = await window.api.getSettings();
    if (!s) return;

    const chk = (id, key, def = 'true') => {
      const el = document.getElementById(id);
      if (el) el.checked = (s[key] ?? def) === 'true';
    };
    const setVal = (id, key, def = '') => {
      const el = document.getElementById(id);
      if (el) el.value = s[key] ?? def;
    };

    // Apply theme immediately
    if (s.theme) document.documentElement.setAttribute('data-theme', s.theme);
    setVal('setTheme', 'theme', 'dark');

    // General
    chk('setDetectClipboard', 'detectClipboardMagnet');

    // Tray
    chk('setMinimizeToTray',       'minimizeToTray');
    chk('setCloseToTray',          'closeToTray');
    chk('setShowCloseToTrayNotif', 'showCloseToTrayNotif');
    chk('setStartWithWindows',     'startWithWindows', 'false');
    chk('setStartMinimized',       'startMinimized',   'false');
    chk('setStartInTray',          'startInTray',      'false');
    chk('setRestoreStates',        'restoreTorrentStates');

    // Capture Mode
    const captureMode = s.captureMode || 'ask';
    const radio = document.querySelector(`input[name="radioCaptureMode"][value="${captureMode}"]`);
    if (radio) radio.checked = true;

    // Notifications
    chk('setEnableNotifications', 'enableNotifications');
    chk('setNotifAdded',          'notifTorrentAdded');
    chk('setNotifComplete',       'notifDownloadComplete');
    chk('setNotifError',          'notifTorrentError');
    chk('setNotifMeta',           'notifMetadataReceived');
    chk('setNotifTracker',        'notifTrackerError', 'false');
    chk('setNotifSeeding',        'notifSeedingStarted', 'false');

    // Bandwidth
    setVal('setGlobalDnLimit', 'globalDownloadLimitKB', '0');
    setVal('setGlobalUpLimit', 'globalUploadLimitKB',   '0');
    setVal('setMaxActiveDn',   'maxActiveDownloads',    '3');

    // Power
    chk('setPrevSleepDn',   'preventSleepDownloading', 'false');
    chk('setPrevSleepSeed', 'preventSleepSeeding',      'false');
    chk('setPauseMetered',  'pauseOnMetered',            'false');

    await this.updateIntegrationStatusDisplay();
  }

  _showToast(msg, type = 'success') {
    const existing = document.getElementById('settingsToast');
    if (existing) existing.remove();

    const t = document.createElement('div');
    t.id = 'settingsToast';
    t.style.cssText = `
      position: fixed; bottom: 40px; right: 24px; z-index: 9999;
      background: ${type === 'success' ? '#10b981' : (type === 'warning' ? '#f59e0b' : '#ef4444')};
      color: #fff; padding: 10px 20px; border-radius: 8px;
      font-size: 0.9rem; font-weight: 600; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      animation: modalPop 0.2s ease;
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
}